import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Any

from application.legacy_render_service import LegacyRenderService
from application.audio_assembly import ProjectAudioAssembler
from application.project_render_service import ProjectRenderService
from application.task_registry import TaskRegistry
from domain.text_chunking import split_text_into_chunks
from infrastructure.project_store import ProjectStore

if TYPE_CHECKING:
    from infrastructure.xtts_runtime import XttsRuntime


class JobService:
    def __init__(
        self,
        runtime: "XttsRuntime",
        storage_dir: Path | None = None,
        max_active_jobs: int = 2,
        ttl_seconds: int = 900,
    ):
        self.runtime = runtime
        self.max_active_jobs = max_active_jobs
        self.ttl_seconds = ttl_seconds
        self.storage_dir = storage_dir or Path(tempfile.gettempdir()) / "omnivoice-jobs"
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.task_registry = TaskRegistry(max_active_jobs)
        self.legacy_render_service = LegacyRenderService(
            runtime=self.runtime,
            storage_dir=self.storage_dir,
            task_registry=self.task_registry,
            max_active_jobs=max_active_jobs,
            ttl_seconds=ttl_seconds,
        )
        self.jobs = self.legacy_render_service.jobs
        self.project_store = ProjectStore(
            self.storage_dir,
            getattr(runtime, "model_name", "runtime"),
        )
        self.project_audio_assembler = ProjectAudioAssembler(self.project_store, self.runtime)
        self.project_render_service = ProjectRenderService(
            runtime=self.runtime,
            project_store=self.project_store,
            task_registry=self.task_registry,
            audio_assembler=self.project_audio_assembler,
            storage_dir=self.storage_dir,
        )

    def create_job(self, text: str, options: Any) -> str:
        return self.legacy_render_service.create_job(text, options)

    async def _run_job(self, job_id: str, payload: dict[str, Any]):
        await self.legacy_render_service._run_job(job_id, payload)

    def get_job(self, job_id: str):
        return self.legacy_render_service.get_job(job_id)

    def get_final_audio(self, job_id: str) -> bytes:
        return self.legacy_render_service.get_final_audio(job_id)

    def get_block_audio(self, job_id: str, block_index: int) -> bytes:
        return self.legacy_render_service.get_block_audio(job_id, block_index)

    async def wait_for_job(self, job_id: str):
        await self.legacy_render_service.wait_for_job(job_id)

    async def shutdown(self):
        await self.task_registry.shutdown()
        self.cleanup_expired_jobs(force=True)

    def cleanup_expired_jobs(self, force: bool = False):
        self.legacy_render_service.cleanup_expired_jobs(force=force)

    def _active_job_count(self) -> int:
        return self.legacy_render_service._active_job_count()

    def _write_block_audio(self, job_id: str, block_index: int, waveform, sample_rate: int) -> Path:
        return self.legacy_render_service._write_block_audio(job_id, block_index, waveform, sample_rate)

    def _write_final_audio(self, job_id: str, audio: bytes) -> Path:
        return self.legacy_render_service._write_final_audio(job_id, audio)

    def _delete_job_files(self, job_id: str, job):
        self.legacy_render_service._delete_job_files(job_id, job)

    def _build_inference_options(self, payload: dict[str, Any]):
        return self.legacy_render_service._build_inference_options(payload)

    def _render_block(self, text: str, options: Any, prompt):
        return self.legacy_render_service._render_block(text, options, prompt)

    def sync_project(
        self,
        project_id: str | None,
        text: str,
        options: Any,
        *,
        blocks: list[dict[str, str]] | None = None,
        block_voices: list[str] | None = None,
    ):
        resolved_blocks = blocks or [
            {"text": block_text}
            for block_text in split_text_into_chunks(text, max_chars=self.runtime.long_form_chunk_chars)
        ]
        if not resolved_blocks:
            raise ValueError("Text is empty")
        payload = options.model_dump()
        assigned_voices = block_voices or []
        return self.project_store.sync_project(
            project_id,
            text=text,
            language=payload.get("language", "cs"),
            settings={"speed": payload.get("speed", 1.0)},
            selected_voice=payload["voice"],
            blocks=[
                {
                    "text": block["text"],
                    "voice": block.get("voice") or (assigned_voices[index] if index < len(assigned_voices) else payload["voice"]),
                }
                for index, block in enumerate(resolved_blocks)
            ],
        )

    def list_projects(self):
        return self.project_store.list_projects()

    def create_project(self, *, title: str | None = None):
        project = self.project_store.create_project(
            title=title,
            selected_voice=self.runtime.voice_store.default_voice_name,
        )
        return self.get_project(project["id"])

    def update_project_metadata(
        self,
        project_id: str,
        *,
        title: str | None = None,
        pinned: bool | None = None,
    ):
        return self.project_store.update_project_metadata(project_id, title=title, pinned=pinned)

    def delete_project(self, project_id: str):
        self.task_registry.cancel_project(project_id)
        return self.project_store.delete_project(project_id)

    def get_project(self, project_id: str):
        project = self.project_store.get_project(project_id)
        active_task = self.task_registry.project_task(project_id)
        has_error = any(block["status"] == "error" for block in project["blocks"])
        if has_error:
            project["status"] = "error"
        else:
            project["status"] = "running" if active_task and not active_task.done() else "ready"
        project["progress"] = {
            "done": project["completed_blocks"],
            "total": project["total_blocks"],
        }
        return project

    def render_project(self, project_id: str):
        return self.project_render_service.render_project(project_id)

    async def wait_for_project(self, project_id: str):
        await self.project_render_service.wait_for_project(project_id)

    async def _run_project(self, project_id: str):
        await self.project_render_service._run_project(project_id)

    def _assemble_project_audio(self, project_id: str):
        self.project_audio_assembler.assemble_project_audio(project_id)

    def _log_project_render_error(
        self,
        *,
        project_id: str,
        block_index: int,
        step: str,
        error_trace: str,
    ):
        self.project_render_service._log_project_render_error(
            project_id=project_id,
            block_index=block_index,
            step=step,
            error_trace=error_trace,
        )
