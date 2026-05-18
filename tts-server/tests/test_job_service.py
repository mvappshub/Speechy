import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.append(str(Path(__file__).resolve().parents[1]))

from application.job_service import JobService


class FakeRuntime:
    model_name = "fake-runtime"
    long_form_chunk_chars = 40

    def __init__(self):
        self.block_lengths: list[int] = []
        self.prompt_voices: list[str] = []

    def create_voice_clone_prompt(self, voice_name: str, preprocess_prompt: bool = True):
        self.prompt_voices.append(voice_name)
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

    def read_wav(self, path: Path):
        payload = path.read_text(encoding="utf-8")
        _, sample_rate, length = payload.split(":")
        return [0.1] * int(length), int(sample_rate)


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

    async def test_project_replay_reuses_cached_blocks_without_regeneration(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(None, "Prvni veta. Druha veta. Treti veta.", self.make_options())
            render_job_id = service.render_project(project["id"])
            self.assertIsNotNone(render_job_id)

            await service.wait_for_project(project["id"])

            initial_renders = len(service.runtime.block_lengths)
            replay = service.sync_project(project["id"], "Prvni veta. Druha veta. Treti veta.", self.make_options())

            self.assertTrue(all(block["status"] == "done" for block in replay["blocks"]))
            self.assertIsNone(service.render_project(replay["id"]))
            self.assertEqual(len(service.runtime.block_lengths), initial_renders)

    async def test_project_speed_change_reuses_cached_blocks_without_regeneration(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(None, "Prvni veta. Druha veta. Treti veta.", self.make_options(speed=1.0))
            render_job_id = service.render_project(project["id"])
            self.assertIsNotNone(render_job_id)
            await service.wait_for_project(project["id"])

            rendered_before_speed_change = len(service.runtime.block_lengths)
            updated = service.sync_project(
                project["id"],
                "Prvni veta. Druha veta. Treti veta.",
                self.make_options(speed=1.2),
            )

            self.assertTrue(all(block["status"] == "done" for block in updated["blocks"]))
            self.assertTrue(updated["final_audio_path"])
            self.assertIsNone(service.render_project(updated["id"]))
            self.assertEqual(len(service.runtime.block_lengths), rendered_before_speed_change)

    async def test_project_partial_edit_only_regenerates_changed_blocks(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(
                None,
                "Prvni delsi veta. Druha delsi veta. Treti delsi veta.",
                self.make_options(),
            )
            render_job_id = service.render_project(project["id"])
            self.assertIsNotNone(render_job_id)

            await service.wait_for_project(project["id"])

            rendered_before_edit = len(service.runtime.block_lengths)
            updated = service.sync_project(
                project["id"],
                "Prvni delsi veta. Upraveny stredni blok. Treti delsi veta.",
                self.make_options(),
            )

            statuses = [block["status"] for block in updated["blocks"]]
            self.assertIn("queued", statuses)
            self.assertIn("done", statuses)

            second_job_id = service.render_project(updated["id"])
            self.assertIsNotNone(second_job_id)
            await service.wait_for_project(updated["id"])

            rerender_count = len(service.runtime.block_lengths) - rendered_before_edit
            queued_count = sum(1 for status in statuses if status == "queued")
            self.assertEqual(rerender_count, queued_count)

    async def test_changing_one_block_voice_only_regenerates_that_block(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(
                None,
                "Prvni delsi veta. Druha delsi veta. Treti delsi veta.",
                self.make_options(),
                block_voices=["speaker.wav", "speaker.wav", "speaker.wav"],
            )
            initial_job_id = service.render_project(project["id"])
            self.assertIsNotNone(initial_job_id)
            await service.wait_for_project(project["id"])

            renders_before_voice_change = len(service.runtime.block_lengths)
            updated = service.sync_project(
                project["id"],
                "Prvni delsi veta. Druha delsi veta. Treti delsi veta.",
                self.make_options(),
                block_voices=["speaker.wav", "speaker2.wav", "speaker.wav"],
            )

            statuses = [block["status"] for block in updated["blocks"]]
            self.assertEqual(statuses.count("queued"), 1)

            second_job_id = service.render_project(updated["id"])
            self.assertIsNotNone(second_job_id)
            await service.wait_for_project(updated["id"])

            self.assertEqual(len(service.runtime.block_lengths) - renders_before_voice_change, 1)

    async def test_project_render_writes_block_wavs_into_project_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(
                None,
                "Prvni delsi veta. Druha delsi veta. Treti delsi veta.",
                self.make_options(),
                block_voices=["speaker.wav", "speaker2.wav", "speaker.wav"],
            )

            render_job_id = service.render_project(project["id"])
            self.assertIsNotNone(render_job_id)
            await service.wait_for_project(project["id"])

            refreshed = service.get_project(project["id"])
            project_dir = Path(temp_dir) / "projects" / project["id"]
            blocks_dir = project_dir / "blocks"

            self.assertTrue(project_dir.exists())
            self.assertTrue(blocks_dir.exists())
            self.assertTrue((project_dir / "project.json").exists())
            self.assertTrue((project_dir / "final.wav").exists())
            self.assertEqual(len(list(blocks_dir.glob("*.wav"))), len(refreshed["blocks"]))
            self.assertTrue(all(Path(block["audio_path"]).is_file() for block in refreshed["blocks"]))
            self.assertTrue(all(str(Path(block["audio_path"]).parent) == str(blocks_dir) for block in refreshed["blocks"]))

    async def test_delete_project_removes_project_directory_and_block_wavs(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            project = service.sync_project(
                None,
                "Prvni delsi veta. Druha delsi veta.",
                self.make_options(),
            )
            render_job_id = service.render_project(project["id"])
            self.assertIsNotNone(render_job_id)
            await service.wait_for_project(project["id"])

            project_dir = Path(temp_dir) / "projects" / project["id"]
            self.assertTrue(project_dir.exists())

            service.delete_project(project["id"])

            self.assertFalse(project_dir.exists())
            with self.assertRaises(KeyError):
                service.get_project(project["id"])

    async def test_service_startup_cleans_legacy_storage_and_orphan_project_dirs(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            legacy_dir = base / "projects-db"
            orphan_dir = base / "projects" / "orphan-project"
            valid_dir = base / "projects" / "valid-project"
            (legacy_dir / "projects").mkdir(parents=True, exist_ok=True)
            orphan_dir.mkdir(parents=True, exist_ok=True)
            valid_dir.mkdir(parents=True, exist_ok=True)
            (valid_dir / "project.json").write_text(
                '{"id":"valid-project","title":"Valid","text":"","language":"cs","pinned":false,"selected_voice":"speaker.wav","settings":{"speed":1.0},"created_at":1,"updated_at":1,"final_audio_path":null,"download_ready":false,"total_blocks":0,"completed_blocks":0,"blocks":[]}',
                encoding="utf-8",
            )

            service = self.make_service(temp_dir, max_active_jobs=2, ttl_seconds=60)

            self.assertFalse(legacy_dir.exists())
            self.assertFalse(orphan_dir.exists())
            self.assertTrue(valid_dir.exists())
            self.assertEqual(service.get_project("valid-project")["id"], "valid-project")
