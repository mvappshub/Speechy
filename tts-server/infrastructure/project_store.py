import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from time import time
from typing import Any


def _normalize_text(value: str) -> str:
    return " ".join(value.split())


def _derive_title(text: str) -> str:
    normalized = _normalize_text(text)
    if not normalized:
        return "Novy projekt"
    return normalized[:48]


class ProjectStore:
    def __init__(self, base_dir: Path, model_identity: str):
        self.base_dir = base_dir
        self.model_identity = model_identity
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = self.base_dir / "cache"
        self.projects_dir = self.base_dir / "projects"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.base_dir / "projects.db"
        self._init_db()

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
        previous = self._fetch_project_row(resolved_id)
        previous_block_keys = self._fetch_project_block_keys(resolved_id)
        next_block_keys: list[str] = []
        final_audio_path = previous["final_audio_path"] if previous else None

        with self._connection() as conn:
            created_at = previous["created_at"] if previous else now
            conn.execute(
                """
                INSERT INTO projects (
                    id, title, text, language, selected_voice, settings_json, output_metadata_json,
                    final_audio_path, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    text=excluded.text,
                    language=excluded.language,
                    selected_voice=excluded.selected_voice,
                    settings_json=excluded.settings_json,
                    output_metadata_json=excluded.output_metadata_json,
                    final_audio_path=excluded.final_audio_path,
                    updated_at=excluded.updated_at
                """,
                (
                    resolved_id,
                    _derive_title(text),
                    text,
                    language,
                    selected_voice,
                    json.dumps(settings, sort_keys=True),
                    json.dumps({}, sort_keys=True),
                    final_audio_path,
                    created_at,
                    now,
                ),
            )
            conn.execute("DELETE FROM project_blocks WHERE project_id = ?", (resolved_id,))

            for index, block in enumerate(blocks):
                cache_key = self.build_cache_key(
                    text=block["text"],
                    voice=block["voice"],
                    language=language,
                    settings=settings,
                )
                next_block_keys.append(cache_key)
                cached = self.get_cached_block(cache_key, conn=conn)
                conn.execute(
                    """
                    INSERT INTO project_blocks (
                        project_id, block_index, text, voice, cache_key, status, error, audio_path,
                        duration_ms, sample_rate, start_ms, end_ms
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        resolved_id,
                        index,
                        block["text"],
                        block["voice"],
                        cache_key,
                        "done" if cached else "queued",
                        None,
                        cached["audio_path"] if cached else None,
                        cached["duration_ms"] if cached else None,
                        cached["sample_rate"] if cached else None,
                        None,
                        None,
                    ),
                )

            if previous_block_keys != next_block_keys:
                conn.execute(
                    "UPDATE projects SET final_audio_path = NULL, updated_at = ? WHERE id = ?",
                    (now, resolved_id),
                )

        self.recompute_timeline(resolved_id)
        return self.get_project(resolved_id)

    def list_projects(self):
        with self._connection() as conn:
            rows = conn.execute(
                """
                SELECT id, title, text, updated_at, created_at
                FROM projects
                ORDER BY updated_at DESC
                LIMIT 20
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "preview": _normalize_text(row["text"])[:96],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def get_project(self, project_id: str):
        with self._connection() as conn:
            project = self._fetch_project_row(project_id, conn=conn)
            if not project:
                raise KeyError(project_id)
            blocks = conn.execute(
                """
                SELECT block_index, text, voice, cache_key, status, error, audio_path, duration_ms,
                       sample_rate, start_ms, end_ms
                FROM project_blocks
                WHERE project_id = ?
                ORDER BY block_index ASC
                """,
                (project_id,),
            ).fetchall()

        completed_blocks = sum(1 for block in blocks if block["status"] == "done")
        return {
            "id": project["id"],
            "title": project["title"],
            "text": project["text"],
            "language": project["language"],
            "selected_voice": project["selected_voice"],
            "settings": json.loads(project["settings_json"]),
            "created_at": project["created_at"],
            "updated_at": project["updated_at"],
            "final_audio_path": project["final_audio_path"],
            "download_ready": bool(project["final_audio_path"]),
            "total_blocks": len(blocks),
            "completed_blocks": completed_blocks,
            "blocks": [
                {
                    "index": block["block_index"],
                    "text": block["text"],
                    "voice": block["voice"],
                    "cache_key": block["cache_key"],
                    "status": block["status"],
                    "error": block["error"],
                    "audio_path": block["audio_path"],
                    "audio_ready": bool(block["audio_path"]) and block["status"] == "done",
                    "duration_ms": block["duration_ms"],
                    "sample_rate": block["sample_rate"],
                    "start_ms": block["start_ms"],
                    "end_ms": block["end_ms"],
                }
                for block in blocks
            ],
        }

    def get_cached_block(self, cache_key: str, *, conn: sqlite3.Connection | None = None):
        owner = conn or self._connect()
        close_owner = conn is None
        try:
            row = owner.execute(
                """
                SELECT cache_key, audio_path, duration_ms, sample_rate
                FROM cached_blocks
                WHERE cache_key = ?
                """,
                (cache_key,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            if close_owner:
                owner.close()

    def save_cached_block(
        self,
        *,
        cache_key: str,
        text: str,
        voice: str,
        language: str,
        settings: dict[str, Any],
        audio_bytes: bytes,
        duration_ms: int,
        sample_rate: int,
    ):
        target = self.cache_dir / f"{cache_key}.wav"
        if not target.exists():
            target.write_bytes(audio_bytes)

        with self._connection() as conn:
            conn.execute(
                """
                INSERT INTO cached_blocks (
                    cache_key, text, voice, language, settings_json, model_identity,
                    audio_path, duration_ms, sample_rate, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    audio_path=excluded.audio_path,
                    duration_ms=excluded.duration_ms,
                    sample_rate=excluded.sample_rate
                """,
                (
                    cache_key,
                    text,
                    voice,
                    language,
                    json.dumps(settings, sort_keys=True),
                    self.model_identity,
                    str(target),
                    duration_ms,
                    sample_rate,
                    time(),
                ),
            )
        return str(target)

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
        with self._connection() as conn:
            conn.execute(
                """
                UPDATE project_blocks
                SET status = ?, audio_path = ?, duration_ms = ?, sample_rate = ?, error = ?
                WHERE project_id = ? AND block_index = ?
                """,
                (status, audio_path, duration_ms, sample_rate, error, project_id, block_index),
            )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (time(), project_id))
        self.recompute_timeline(project_id)

    def set_final_audio(self, project_id: str, audio_bytes: bytes):
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        target = project_dir / "final.wav"
        target.write_bytes(audio_bytes)
        with self._connection() as conn:
            conn.execute(
                "UPDATE projects SET final_audio_path = ?, updated_at = ? WHERE id = ?",
                (str(target), time(), project_id),
            )
        return str(target)

    def get_block_audio_path(self, project_id: str, block_index: int):
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT audio_path, status
                FROM project_blocks
                WHERE project_id = ? AND block_index = ?
                """,
                (project_id, block_index),
            ).fetchone()
        if not row:
            raise KeyError(block_index)
        if row["status"] != "done" or not row["audio_path"]:
            raise ValueError(row["status"])
        return row["audio_path"]

    def get_final_audio_path(self, project_id: str):
        project = self.get_project(project_id)
        if not project["final_audio_path"]:
            raise ValueError("missing")
        return project["final_audio_path"]

    def recompute_timeline(self, project_id: str):
        with self._connection() as conn:
            blocks = conn.execute(
                """
                SELECT block_index, duration_ms, status
                FROM project_blocks
                WHERE project_id = ?
                ORDER BY block_index ASC
                """,
                (project_id,),
            ).fetchall()

            current_ms = 0
            gaps_detected = False
            for block in blocks:
                duration_ms = block["duration_ms"]
                is_ready = block["status"] == "done" and duration_ms is not None
                if gaps_detected or not is_ready:
                    start_ms = None
                    end_ms = None
                    gaps_detected = True
                else:
                    start_ms = current_ms
                    end_ms = current_ms + int(duration_ms)
                    current_ms = end_ms
                conn.execute(
                    """
                    UPDATE project_blocks
                    SET start_ms = ?, end_ms = ?
                    WHERE project_id = ? AND block_index = ?
                    """,
                    (start_ms, end_ms, project_id, block["block_index"]),
                )

    def build_cache_key(self, *, text: str, voice: str, language: str, settings: dict[str, Any]):
        payload = {
            "text": _normalize_text(text),
            "voice": voice,
            "language": language,
            "settings": settings,
            "model_identity": self.model_identity,
        }
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _fetch_project_row(self, project_id: str, *, conn: sqlite3.Connection | None = None):
        owner = conn or self._connect()
        close_owner = conn is None
        try:
            return owner.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        finally:
            if close_owner:
                owner.close()

    def _fetch_project_block_keys(self, project_id: str):
        with self._connection() as conn:
            rows = conn.execute(
                """
                SELECT cache_key
                FROM project_blocks
                WHERE project_id = ?
                ORDER BY block_index ASC
                """,
                (project_id,),
            ).fetchall()
        return [row["cache_key"] for row in rows]

    def _connect(self):
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _init_db(self):
        with self._connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    text TEXT NOT NULL,
                    language TEXT NOT NULL,
                    selected_voice TEXT NOT NULL,
                    settings_json TEXT NOT NULL,
                    output_metadata_json TEXT NOT NULL,
                    final_audio_path TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS project_blocks (
                    project_id TEXT NOT NULL,
                    block_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    voice TEXT NOT NULL,
                    cache_key TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error TEXT,
                    audio_path TEXT,
                    duration_ms INTEGER,
                    sample_rate INTEGER,
                    start_ms INTEGER,
                    end_ms INTEGER,
                    PRIMARY KEY (project_id, block_index)
                );

                CREATE TABLE IF NOT EXISTS cached_blocks (
                    cache_key TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    voice TEXT NOT NULL,
                    language TEXT NOT NULL,
                    settings_json TEXT NOT NULL,
                    model_identity TEXT NOT NULL,
                    audio_path TEXT NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    sample_rate INTEGER NOT NULL,
                    created_at REAL NOT NULL
                );
                """
            )
