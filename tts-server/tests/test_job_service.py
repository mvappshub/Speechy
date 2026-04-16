import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[1]))

from application.job_service import JobService


class FakeRuntime:
    long_form_chunk_chars = 40

    def __init__(self):
        self.block_lengths: list[int] = []

    def create_voice_clone_prompt(self, voice_name: str, preprocess_prompt: bool = True):
        return {"voice": voice_name, "preprocess_prompt": preprocess_prompt}

    def render_single_block(
        self,
        text: str,
        voice_name: str,
        language: str = "cs",
        speed: float = 1.0,
        voice_clone_prompt=None,
        options=None,
    ):
        self.block_lengths.append(len(text))
        return [0.1] * max(1, len(text)), 10

    def concatenate_rendered_blocks(self, rendered_blocks):
        timeline = []
        start_ms = 0
        samples: list[float] = []

        for index, block in enumerate(rendered_blocks):
            duration_ms = int((len(block["waveform"]) / block["sample_rate"]) * 1000)
            timeline.append(
                {
                    "index": index,
                    "text": block["text"],
                    "start_ms": start_ms,
                    "end_ms": start_ms + duration_ms,
                }
            )
            start_ms += duration_ms
            samples.extend(block["waveform"])

        return samples, rendered_blocks[0]["sample_rate"], timeline

    def write_final_wav(self, waveform, sample_rate: int) -> bytes:
        return f"wav:{sample_rate}:{len(waveform)}".encode("utf-8")

    def read_final_wav(self, path: Path) -> bytes:
        return path.read_bytes()


class PromptFailureRuntime(FakeRuntime):
    def create_voice_clone_prompt(self, voice_name: str, preprocess_prompt: bool = True):
        raise ImportError("missing runtime dependency")


class JobServiceTests(unittest.IsolatedAsyncioTestCase):
    def make_options(self, voice="speaker.wav", language="cs", speed=1.0):
        payload = {"voice": voice, "language": language, "speed": speed}
        return SimpleNamespace(voice=voice, model_dump=lambda: payload)

    def make_service(self, temp_dir: str, *, max_active_jobs: int, ttl_seconds: int):
        service = JobService(
            runtime=FakeRuntime(),
            storage_dir=Path(temp_dir),
            max_active_jobs=max_active_jobs,
            ttl_seconds=ttl_seconds,
        )
        service._build_inference_options = lambda payload: SimpleNamespace(**payload)
        return service

    async def test_rejects_empty_text(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            with self.assertRaises(ValueError):
                service.create_job("   \n\n ", self.make_options())

    async def test_completed_job_creates_final_audio_and_timeline(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)
            job_id = service.create_job("Prvni veta. Druha veta.", self.make_options("speaker.wav"))

            await service.wait_for_job(job_id)

            job = service.jobs[job_id]
            self.assertEqual(job["status"], "done")
            self.assertTrue(job["final_audio_path"])
            self.assertTrue(Path(job["final_audio_path"]).exists())
            self.assertEqual(job["completed_blocks"], job["total_blocks"])
            self.assertTrue(job["timeline"])
            self.assertEqual(job["timeline"][0]["index"], 0)

            audio = service.get_final_audio(job_id)
            self.assertIn(b"wav:", audio)

    async def test_running_job_reports_block_progress(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)
            job_id = service.create_job(
                "Prvni veta. Druha veta. Treti veta uz vytvori dalsi blok.",
                self.make_options(),
            )

            await service.wait_for_job(job_id)

            status = service.get_job(job_id)
            self.assertEqual(status["status"], "done")
            self.assertEqual(status["completed_blocks"], status["total_blocks"])
            self.assertGreaterEqual(status["total_blocks"], 2)

    async def test_cleanup_expired_jobs_removes_final_audio(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=0)
            job_id = service.create_job("Prvni veta. Druha veta.", self.make_options())

            await service.wait_for_job(job_id)

            audio_path = Path(service.jobs[job_id]["final_audio_path"])
            self.assertTrue(audio_path.exists())

            service.cleanup_expired_jobs()

            self.assertNotIn(job_id, service.jobs)
            self.assertFalse(audio_path.exists())

    async def test_prompt_failure_marks_job_as_error(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = JobService(
                runtime=PromptFailureRuntime(),
                storage_dir=Path(temp_dir),
                max_active_jobs=2,
                ttl_seconds=60,
            )
            service._build_inference_options = lambda payload: SimpleNamespace(**payload)

            job_id = service.create_job("Prvni veta.", self.make_options())

            await service.wait_for_job(job_id)

            job = service.get_job(job_id)
            self.assertEqual(job["status"], "error")
            self.assertIn("Voice prompt creation failed", job["error"])
