import asyncio
import contextlib
import os
import tempfile
import uuid
from pathlib import Path
from time import time
from typing import TYPE_CHECKING, Any

from domain.text_chunking import split_text_into_chunks
from domain.types import Job

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
        self.jobs: dict[str, Job] = {}
        self.max_active_jobs = max_active_jobs
        self.ttl_seconds = ttl_seconds
        self.storage_dir = storage_dir or Path(tempfile.gettempdir()) / "omnivoice-jobs"
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._semaphore = asyncio.Semaphore(max_active_jobs if max_active_jobs > 0 else 1)

    def create_job(self, text: str, options: Any) -> str:
        self.cleanup_expired_jobs()
        blocks = split_text_into_chunks(text, max_chars=self.runtime.long_form_chunk_chars)
        if not blocks:
            raise ValueError("Text is empty")
        if self._active_job_count() >= self.max_active_jobs:
            raise ValueError("Too many active render jobs. Please wait for the current jobs to finish.")

        payload = options.model_dump()
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "text": text,
            "voice": payload["voice"],
            "language": payload.get("language", "cs"),
            "speed": payload.get("speed", 1.0),
            "total_blocks": len(blocks),
            "completed_blocks": 0,
            "timeline": [],
            "final_audio_path": None,
            "error": None,
            "created_at": time(),
            "finished_at": None,
            "blocks": [
                {"index": index, "text": block_text, "status": "queued", "error": None, "audio_path": None}
                for index, block_text in enumerate(blocks)
            ],
        }
        self._tasks[job_id] = asyncio.create_task(self._run_job(job_id, payload))
        return job_id

    async def _run_job(self, job_id: str, payload: dict[str, Any]):
        job = self.jobs.get(job_id)
        if not job:
            return

        async with self._semaphore:
            job["status"] = "running"
            options = self._build_inference_options(payload)
            loop = asyncio.get_event_loop()
            try:
                prompt = await loop.run_in_executor(
                    None,
                    self.runtime.create_voice_clone_prompt,
                    options.voice,
                    getattr(options, "preprocess_prompt", True),
                )
            except Exception as exc:
                job["status"] = "error"
                job["error"] = f"Voice prompt creation failed: {repr(exc)}"
                job["finished_at"] = time()
                return
            rendered_blocks: list[dict[str, Any]] = []

            for block in job["blocks"]:
                block["status"] = "running"
                try:
                    waveform, sample_rate = await loop.run_in_executor(
                        None,
                        self._render_block,
                        block["text"],
                        options,
                        prompt,
                    )
                    audio_path = self._write_block_audio(job_id, block["index"], waveform, sample_rate)
                    block["audio_path"] = str(audio_path)
                    block["status"] = "done"
                    job["completed_blocks"] += 1
                    rendered_blocks.append(
                        {
                            "text": block["text"],
                            "waveform": waveform,
                            "sample_rate": sample_rate,
                        }
                    )
                except Exception as exc:
                    block["status"] = "error"
                    block["error"] = repr(exc)
                    job["status"] = "error"
                    job["error"] = f"Block {block['index']} failed: {repr(exc)}"
                    job["finished_at"] = time()
                    return

            try:
                final_waveform, sample_rate, timeline = await loop.run_in_executor(
                    None,
                    self.runtime.concatenate_rendered_blocks,
                    rendered_blocks,
                )
                audio_bytes = await loop.run_in_executor(
                    None,
                    self.runtime.write_final_wav,
                    final_waveform,
                    sample_rate,
                )
            except Exception as exc:
                job["status"] = "error"
                job["error"] = f"Final audio assembly failed: {repr(exc)}"
                job["finished_at"] = time()
                return

            final_audio_path = self._write_final_audio(job_id, audio_bytes)
            job["timeline"] = timeline
            job["final_audio_path"] = str(final_audio_path)
            job["status"] = "done"
            job["finished_at"] = time()

    def get_job(self, job_id: str):
        job = self.jobs.get(job_id)
        if not job:
            raise KeyError(job_id)
        return {
            "id": job["id"],
            "status": job["status"],
            "voice": job["voice"],
            "text": job["text"],
            "total_blocks": job["total_blocks"],
            "completed_blocks": job["completed_blocks"],
            "timeline": list(job["timeline"]),
            "final_audio_path": job["final_audio_path"],
            "error": job["error"],
            "created_at": job["created_at"],
            "finished_at": job["finished_at"],
        }

    def get_final_audio(self, job_id: str) -> bytes:
        job = self.jobs.get(job_id)
        if not job:
            raise KeyError(job_id)
        if job["status"] != "done" or not job["final_audio_path"]:
            raise ValueError(job["status"])
        return self.runtime.read_final_wav(Path(job["final_audio_path"]))

    async def wait_for_job(self, job_id: str):
        task = self._tasks.get(job_id)
        if task:
            await task

    async def shutdown(self):
        for task in self._tasks.values():
            task.cancel()
        for task in self._tasks.values():
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()
        self.cleanup_expired_jobs(force=True)

    def cleanup_expired_jobs(self, force: bool = False):
        now = time()
        expired_ids = [
            job_id
            for job_id, job in self.jobs.items()
            if force or (job["finished_at"] is not None and now - job["finished_at"] >= self.ttl_seconds)
        ]
        for job_id in expired_ids:
            self._delete_job_files(job_id, self.jobs[job_id])
            self.jobs.pop(job_id, None)
            self._tasks.pop(job_id, None)

    def _active_job_count(self) -> int:
        return sum(1 for job in self.jobs.values() if job["status"] in {"queued", "running"})

    def _write_block_audio(self, job_id: str, block_index: int, waveform, sample_rate: int) -> Path:
        job_dir = self.storage_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        target = job_dir / f"block-{block_index}.wav"
        target.write_bytes(self.runtime.write_final_wav(waveform, sample_rate))
        return target

    def _write_final_audio(self, job_id: str, audio: bytes) -> Path:
        job_dir = self.storage_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        target = job_dir / "final.wav"
        target.write_bytes(audio)
        return target

    def _delete_job_files(self, job_id: str, job: Job):
        for block in job["blocks"]:
            audio_path = block.get("audio_path")
            if audio_path and os.path.exists(audio_path):
                with contextlib.suppress(OSError):
                    os.remove(audio_path)
        final_audio_path = job.get("final_audio_path")
        if final_audio_path and os.path.exists(final_audio_path):
            with contextlib.suppress(OSError):
                os.remove(final_audio_path)
        job_dir = self.storage_dir / job_id
        if job_dir.exists():
            with contextlib.suppress(OSError):
                job_dir.rmdir()

    def _build_inference_options(self, payload: dict[str, Any]):
        from infrastructure.xtts_runtime import InferenceOptions

        return InferenceOptions(**payload)

    def _render_block(self, text: str, options: Any, prompt):
        return self.runtime.render_single_block(
            text=text,
            voice_name=options.voice,
            language=getattr(options, "language", "cs"),
            speed=getattr(options, "speed", 1.0),
            voice_clone_prompt=prompt,
            options=options,
        )
