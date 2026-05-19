import json
import shutil
import uuid
from pathlib import Path
from time import time
from typing import Any

from domain.project_cache_policy import (
    build_project_block_filename,
    build_project_cache_key,
    build_synced_project_blocks,
    derive_project_title,
    normalize_project_text,
)
from domain.project_timeline import recompute_project_timeline


class ProjectStore:
    def __init__(self, base_dir: Path, model_identity: str):
        self.base_dir = base_dir
        self.model_identity = model_identity
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir = self.base_dir / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self._cleanup_legacy_storage()

    def sync_project(
        self,
        project_id: str | None,
        *,
        text: str,
        language: str,
        settings: dict[str, Any],
        blocks: list[dict[str, Any]],
        selected_voice: str,
    ):
        now = time()
        resolved_id = project_id or str(uuid.uuid4())
        previous = self._load_project(resolved_id)
        previous_blocks = previous["blocks"] if previous else []
        next_blocks, block_content_changed = build_synced_project_blocks(
            previous_blocks=previous_blocks,
            blocks=blocks,
            language=language,
            settings=settings,
            model_identity=self.model_identity,
        )

        project = {
            "id": resolved_id,
            "title": previous["title"] if previous else derive_project_title(text),
            "text": text,
            "language": language,
            "pinned": previous["pinned"] if previous else False,
            "selected_voice": selected_voice,
            "settings": settings,
            "created_at": previous["created_at"] if previous else now,
            "updated_at": now,
            "final_audio_path": previous["final_audio_path"] if previous and not block_content_changed else None,
            "download_ready": False,
            "total_blocks": len(next_blocks),
            "completed_blocks": 0,
            "blocks": next_blocks,
        }

        if previous:
            self._delete_stale_block_files(project, previous_blocks, next_blocks)
            if block_content_changed:
                self._delete_final_audio(project["id"])

        recompute_project_timeline(project)
        self._save_project(project)
        return self.get_project(resolved_id)

    def list_projects(self):
        projects: list[dict[str, Any]] = []
        for project_file in self.projects_dir.glob("*/project.json"):
            project = self._read_project_file(project_file)
            projects.append(
                {
                    "id": project["id"],
                    "title": project["title"],
                    "preview": normalize_project_text(project["text"])[:96],
                    "pinned": bool(project.get("pinned", False)),
                    "created_at": project["created_at"],
                    "updated_at": project["updated_at"],
                }
            )
        return sorted(projects, key=lambda item: (not item["pinned"], -item["updated_at"]))[:100]

    def get_project(self, project_id: str):
        project = self._load_project(project_id)
        if not project:
            raise KeyError(project_id)
        recompute_project_timeline(project)
        return project

    def create_project(self, *, title: str | None, selected_voice: str):
        now = time()
        project_id = str(uuid.uuid4())
        project = {
            "id": project_id,
            "title": title.strip() if title and title.strip() else "Novy projekt",
            "text": "",
            "language": "cs",
            "pinned": False,
            "selected_voice": selected_voice,
            "settings": {"speed": 1.0},
            "created_at": now,
            "updated_at": now,
            "final_audio_path": None,
            "download_ready": False,
            "total_blocks": 0,
            "completed_blocks": 0,
            "blocks": [],
        }
        self._save_project(project)
        return self.get_project(project_id)

    def update_project_metadata(
        self,
        project_id: str,
        *,
        title: str | None = None,
        pinned: bool | None = None,
    ):
        project = self.get_project(project_id)
        if title is not None and title.strip():
            project["title"] = title.strip()
        if pinned is not None:
            project["pinned"] = bool(pinned)
        project["updated_at"] = time()
        self._save_project(project)
        return self.get_project(project_id)

    def delete_project(self, project_id: str):
        project = self.get_project(project_id)
        project_dir = self._project_dir(project_id)
        if project_dir.exists():
            shutil.rmtree(project_dir, ignore_errors=True)
        return project

    def update_project_block(
        self,
        project_id: str,
        block_index: int,
        *,
        status: str,
        audio_path: str | None,
        duration_ms: int | None,
        sample_rate: int | None,
        error: str | None,
    ):
        project = self.get_project(project_id)
        try:
            block = project["blocks"][block_index]
        except IndexError as exc:
            raise KeyError(block_index) from exc
        block["status"] = status
        block["audio_path"] = audio_path
        block["audio_ready"] = bool(audio_path) and status == "done"
        block["duration_ms"] = duration_ms
        block["sample_rate"] = sample_rate
        block["error"] = error
        project["updated_at"] = time()
        recompute_project_timeline(project)
        self._save_project(project)

    def set_final_audio(self, project_id: str, audio_bytes: bytes):
        project = self.get_project(project_id)
        target = self._project_dir(project_id) / "final.wav"
        target.write_bytes(audio_bytes)
        project["final_audio_path"] = str(target)
        project["download_ready"] = True
        project["updated_at"] = time()
        self._save_project(project)
        return str(target)

    def get_block_audio_path(self, project_id: str, block_index: int):
        project = self.get_project(project_id)
        try:
            block = project["blocks"][block_index]
        except IndexError as exc:
            raise KeyError(block_index) from exc
        if block["status"] != "done" or not block["audio_path"]:
            raise ValueError(block["status"])
        return block["audio_path"]

    def get_final_audio_path(self, project_id: str):
        project = self.get_project(project_id)
        if not project["final_audio_path"]:
            raise ValueError("missing")
        return project["final_audio_path"]

    def recompute_timeline(self, project_id: str):
        project = self.get_project(project_id)
        recompute_project_timeline(project)
        self._save_project(project)

    def recompute_timeline_data(self, project: dict[str, Any]):
        recompute_project_timeline(project)

    def build_cache_key(self, *, text: str, voice: str, language: str, settings: dict[str, Any]):
        return build_project_cache_key(
            text=text,
            voice=voice,
            language=language,
            settings=settings,
            model_identity=self.model_identity,
        )

    def save_project_block_audio(
        self,
        *,
        project_id: str,
        block_index: int,
        voice: str,
        text: str,
        audio_bytes: bytes,
    ):
        project = self.get_project(project_id)
        filename = self._build_block_filename(block_index, voice, text)
        target = self._project_dir(project_id) / "blocks" / filename
        target.write_bytes(audio_bytes)
        project["updated_at"] = time()
        self._save_project(project)
        return str(target)

    def _build_block_filename(self, block_index: int, voice: str, text: str):
        return build_project_block_filename(block_index, voice, text)

    def _delete_stale_block_files(
        self,
        project: dict[str, Any],
        previous_blocks: list[dict[str, Any]],
        next_blocks: list[dict[str, Any]],
    ):
        next_audio_paths = {block.get("audio_path") for block in next_blocks if block.get("audio_path")}
        for block in previous_blocks:
            if block.get("audio_path") in next_audio_paths:
                continue
            audio_path = block.get("audio_path")
            if audio_path:
                stale_path = Path(audio_path)
                if stale_path.exists():
                    stale_path.unlink()

    def _delete_final_audio(self, project_id: str):
        target = self._project_dir(project_id) / "final.wav"
        if target.exists():
            target.unlink()

    def _project_dir(self, project_id: str):
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "blocks").mkdir(parents=True, exist_ok=True)
        return project_dir

    def _project_file(self, project_id: str):
        return self._project_dir(project_id) / "project.json"

    def _load_project(self, project_id: str):
        project_file = self.projects_dir / project_id / "project.json"
        if not project_file.exists():
            return None
        return self._read_project_file(project_file)

    def _read_project_file(self, project_file: Path):
        project = json.loads(project_file.read_text(encoding="utf-8"))
        project.setdefault("pinned", False)
        project.setdefault("final_audio_path", None)
        project.setdefault("download_ready", False)
        project.setdefault("total_blocks", len(project.get("blocks", [])))
        project.setdefault("completed_blocks", 0)
        for index, block in enumerate(project.get("blocks", [])):
            block.setdefault("index", index)
            block.setdefault("cache_key", self.build_cache_key(
                text=block["text"],
                voice=block["voice"],
                language=project["language"],
                settings=project["settings"],
            ))
            block.setdefault("error", None)
            block.setdefault("audio_path", None)
            block.setdefault("audio_ready", False)
            block.setdefault("duration_ms", None)
            block.setdefault("sample_rate", None)
            block.setdefault("start_ms", None)
            block.setdefault("end_ms", None)
        return project

    def _save_project(self, project: dict[str, Any]):
        project_file = self._project_file(project["id"])
        project_file.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")

    def _cleanup_legacy_storage(self):
        legacy_dir = self.base_dir / "projects-db"
        if legacy_dir.exists():
            shutil.rmtree(legacy_dir, ignore_errors=True)

        for project_dir in self.projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            if not (project_dir / "project.json").exists():
                shutil.rmtree(project_dir, ignore_errors=True)
