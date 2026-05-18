import hashlib
import json
import re
import shutil
import uuid
from pathlib import Path
from time import time
from typing import Any


def _normalize_text(value: str) -> str:
    return " ".join(value.split())


def _derive_title(text: str) -> str:
    return "Novy projekt"


def _slugify(value: str, fallback: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:40] or fallback


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
        next_blocks: list[dict[str, Any]] = []
        block_content_changed = False

        for index, block in enumerate(blocks):
          cache_key = self.build_cache_key(
              text=block["text"],
              voice=block["voice"],
              language=language,
              settings=settings,
          )
          previous_block = previous_blocks[index] if index < len(previous_blocks) else None
          reused = (
              previous_block
              and _normalize_text(previous_block.get("text", "")) == _normalize_text(block["text"])
              and previous_block.get("voice") == block["voice"]
          )
          if not reused:
              block_content_changed = True
          next_blocks.append(
              {
                  "index": index,
                  "text": block["text"],
                  "voice": block["voice"],
                  "cache_key": cache_key,
                  "status": previous_block["status"] if reused else "queued",
                  "error": previous_block.get("error") if reused else None,
                  "audio_path": previous_block.get("audio_path") if reused else None,
                  "audio_ready": previous_block.get("audio_ready", False) if reused else False,
                  "duration_ms": previous_block.get("duration_ms") if reused else None,
                  "sample_rate": previous_block.get("sample_rate") if reused else None,
                  "start_ms": previous_block.get("start_ms") if reused else None,
                  "end_ms": previous_block.get("end_ms") if reused else None,
              }
          )

        if previous and len(previous_blocks) != len(next_blocks):
            block_content_changed = True

        project = {
            "id": resolved_id,
            "title": previous["title"] if previous else _derive_title(text),
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

        self.recompute_timeline_data(project)
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
                    "preview": _normalize_text(project["text"])[:96],
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
        self.recompute_timeline_data(project)
        self._save_project(project)
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
        self.recompute_timeline_data(project)
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
        self.recompute_timeline_data(project)
        self._save_project(project)

    def recompute_timeline_data(self, project: dict[str, Any]):
        current_ms = 0
        gaps_detected = False
        for block in project["blocks"]:
            duration_ms = block.get("duration_ms")
            is_ready = block["status"] == "done" and duration_ms is not None and block.get("audio_path")
            if gaps_detected or not is_ready:
                block["start_ms"] = None
                block["end_ms"] = None
                gaps_detected = True
            else:
                block["start_ms"] = current_ms
                block["end_ms"] = current_ms + int(duration_ms)
                current_ms = block["end_ms"]
            block["audio_ready"] = bool(block.get("audio_path")) and block["status"] == "done"

        project["total_blocks"] = len(project["blocks"])
        project["completed_blocks"] = sum(1 for block in project["blocks"] if block["status"] == "done")
        project["download_ready"] = bool(project.get("final_audio_path"))

    def build_cache_key(self, *, text: str, voice: str, language: str, settings: dict[str, Any]):
        payload = {
            "text": _normalize_text(text),
            "voice": voice,
            "language": language,
            "model_identity": self.model_identity,
        }
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

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
        voice_slug = _slugify(Path(voice).stem, "voice")
        text_slug = _slugify(_normalize_text(text)[:48], f"block-{block_index + 1}")
        return f"{block_index + 1:02d}-{voice_slug}-{text_slug}.wav"

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
