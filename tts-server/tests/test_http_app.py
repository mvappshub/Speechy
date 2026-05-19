import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from presentation.http import create_app


class FakeVoicePath:
    def __init__(self, name: str):
        self.name = name


class FakeVoiceStore:
    default_voice_name = "speaker.wav"

    def list_voice_paths(self):
        return [FakeVoicePath("speaker.wav"), FakeVoicePath("speaker2.wav")]

    def serialize(self, path):
        return {
            "name": path.name,
            "path": f"/voices/{path.name}",
            "size": 2048,
            "is_default": path.name == self.default_voice_name,
            "has_transcript": path.name == "speaker.wav",
        }


class FakeRuntime:
    model_name = "k2-fsa/OmniVoice"
    gpu_info = {"device": "fake"}
    long_form_chunk_chars = 123
    sync_text_limit = 456
    default_inference = {"language": "cs", "speed": 1.0}
    voice_store = FakeVoiceStore()


class FakeJobs:
    def __init__(self, temp_dir: Path):
        self.deleted_project_id = None
        self.block_audio_path = temp_dir / "block-0.wav"
        self.block_audio_path.write_bytes(b"project-block-audio")
        self.final_audio_path = temp_dir / "final.wav"
        self.final_audio_path.write_bytes(b"project-final-audio")
        self.project_store = self
        self.synced_project = {
            "id": "project-1",
            "title": "Ahoj svete.",
            "text": "Ahoj svete.",
            "language": "cs",
            "selected_voice": "speaker.wav",
            "settings": {"speed": 1.0},
            "created_at": 1.0,
            "updated_at": 2.0,
            "final_audio_path": str(self.final_audio_path),
            "download_ready": True,
            "total_blocks": 2,
            "completed_blocks": 2,
            "status": "ready",
            "progress": {"done": 2, "total": 2},
            "blocks": [
                {
                    "index": 0,
                    "text": "Ahoj",
                    "voice": "speaker.wav",
                    "cache_key": "cache-0",
                    "status": "done",
                    "error": None,
                    "audio_path": str(self.block_audio_path),
                    "audio_ready": True,
                    "duration_ms": 500,
                    "sample_rate": 22050,
                    "start_ms": 0,
                    "end_ms": 500,
                },
                {
                    "index": 1,
                    "text": "svete.",
                    "voice": "speaker.wav",
                    "cache_key": "cache-1",
                    "status": "done",
                    "error": None,
                    "audio_path": str(temp_dir / "block-1.wav"),
                    "audio_ready": True,
                    "duration_ms": 500,
                    "sample_rate": 22050,
                    "start_ms": 500,
                    "end_ms": 1000,
                },
            ],
        }
        self.created_project = {
            **self.synced_project,
            "id": "project-created",
            "title": "Novy projekt",
        }

    def create_job(self, text, options):
        self.created = {"text": text, "options": options.model_dump()}
        return "job-1"

    def get_job(self, job_id):
        return {
            "id": job_id,
            "status": "done",
            "voice": "speaker.wav",
            "text": "Ahoj svete.",
            "total_blocks": 2,
            "completed_blocks": 2,
            "timeline": [
                {"index": 0, "text": "Ahoj", "start_ms": 0, "end_ms": 500},
                {"index": 1, "text": "svete.", "start_ms": 500, "end_ms": 1000},
            ],
            "blocks": [
                {
                    "index": 0,
                    "text": "Ahoj",
                    "status": "done",
                    "error": None,
                    "audio_path": "/tmp/block-0.wav",
                    "start_ms": 0,
                    "end_ms": 500,
                },
                {
                    "index": 1,
                    "text": "svete.",
                    "status": "running",
                    "error": None,
                    "audio_path": None,
                    "start_ms": None,
                    "end_ms": None,
                },
            ],
            "final_audio_path": "/tmp/final.wav",
            "error": None,
            "created_at": 1.0,
            "finished_at": 2.0,
        }

    def get_final_audio(self, job_id):
        return b"audio"

    def get_block_audio(self, job_id, block_index):
        if block_index == 0:
            return b"block-audio"
        raise ValueError("running")

    def list_projects(self):
        return [{"id": "project-1", "title": "Ahoj svete.", "preview": "Ahoj svete.", "created_at": 1.0, "updated_at": 2.0}]

    def create_project(self, title=None):
        self.create_project_title = title
        return {
            **self.created_project,
            "title": title or self.created_project["title"],
        }

    def sync_project(self, project_id, text, options):
        self.synced = {"project_id": project_id, "text": text, "options": options.model_dump()}
        return self.synced_project

    def get_project(self, project_id):
        if project_id == "missing-project":
            raise KeyError(project_id)
        return self.synced_project

    def update_project_metadata(self, project_id, *, title=None, pinned=None):
        if project_id == "missing-project":
            raise KeyError(project_id)
        self.updated_project = {"project_id": project_id, "title": title, "pinned": pinned}
        project = dict(self.synced_project)
        if title is not None:
            project["title"] = title
        if pinned is not None:
            project["pinned"] = pinned
        return project

    def render_project(self, project_id):
        if project_id == "missing-project":
            raise KeyError(project_id)
        self.rendered_project = project_id
        return None

    def delete_project(self, project_id):
        if project_id == "missing-project":
            raise KeyError(project_id)
        self.deleted_project_id = project_id

    def get_block_audio_path(self, project_id, block_index):
        if project_id == "project-1" and block_index == 0:
            return str(self.block_audio_path)
        if project_id == "project-1" and block_index == 1:
            raise ValueError("running")
        raise KeyError(block_index)

    def get_final_audio_path(self, project_id):
        if project_id == "project-1":
            return str(self.final_audio_path)
        raise KeyError(project_id)


class HttpAppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.jobs = FakeJobs(Path(self.temp_dir.name))
        self.client = TestClient(create_app(runtime=FakeRuntime(), jobs=self.jobs))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health_reports_omnivoice_progressive_mode(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["model"], "k2-fsa/OmniVoice")
        self.assertEqual(payload["mode"], "progressive")
        self.assertEqual(payload["defaults"]["language"], "cs")

    def test_voices_endpoint_returns_available_voices(self):
        response = self.client.get("/api/voices")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["default_voice"], "speaker.wav")
        self.assertEqual(len(payload["voices"]), 2)
        self.assertTrue(payload["voices"][0]["has_transcript"])

    def test_render_start_creates_job(self):
        response = self.client.post(
            "/api/render",
            json={"text": "Ahoj svete.", "voice": "speaker.wav"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": "job-1", "status": "queued"})
        self.assertEqual(self.jobs.created["options"]["language"], "cs")

    def test_render_status_exposes_progress_and_flags(self):
        response = self.client.get("/api/render/job-1")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], "job-1")
        self.assertEqual(payload["progress"], {"done": 2, "total": 2})
        self.assertTrue(payload["audio_ready"])
        self.assertTrue(payload["download_ready"])
        self.assertEqual(len(payload["timeline"]), 2)
        self.assertEqual(payload["blocks"][0]["status"], "done")
        self.assertTrue(payload["blocks"][0]["audio_ready"])
        self.assertFalse(payload["blocks"][1]["audio_ready"])

    def test_render_audio_returns_final_wav(self):
        response = self.client.get("/api/render/job-1/audio")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"audio")
        self.assertEqual(response.headers["content-type"], "audio/wav")

    def test_render_download_returns_attachment(self):
        response = self.client.get("/api/render/job-1/download")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"audio")
        self.assertIn("attachment", response.headers["content-disposition"])

    def test_block_audio_returns_a_ready_wav_before_the_full_render_finishes(self):
        response = self.client.get("/api/render/job-1/blocks/0/audio")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"block-audio")
        self.assertEqual(response.headers["content-type"], "audio/wav")

    def test_projects_endpoint_returns_recent_projects(self):
        response = self.client.get("/api/projects")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]["id"], "project-1")

    def test_project_create_returns_serialized_project(self):
        response = self.client.post("/api/projects", json={"title": "Muj projekt"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], "project-created")
        self.assertEqual(payload["title"], "Muj projekt")
        self.assertEqual(self.jobs.create_project_title, "Muj projekt")

    def test_project_sync_persists_reader_state(self):
        response = self.client.post(
            "/api/projects/sync",
            json={"text": "Ahoj svete.", "voice": "speaker.wav", "project_id": "project-1"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], "project-1")
        self.assertEqual(self.jobs.synced["project_id"], "project-1")

    def test_project_sync_rejects_blank_text(self):
        response = self.client.post(
            "/api/projects/sync",
            json={"text": "   ", "voice": "speaker.wav"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Text is empty")

    def test_get_project_returns_404_for_missing_project(self):
        response = self.client.get("/api/projects/missing-project")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Project not found")

    def test_project_update_returns_serialized_project(self):
        response = self.client.patch(
            "/api/projects/project-1",
            json={"title": "Upraveny projekt", "pinned": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["title"], "Upraveny projekt")
        self.assertTrue(payload["pinned"])
        self.assertEqual(
            self.jobs.updated_project,
            {"project_id": "project-1", "title": "Upraveny projekt", "pinned": True},
        )

    def test_project_update_returns_404_for_missing_project(self):
        response = self.client.patch(
            "/api/projects/missing-project",
            json={"title": "Upraveny projekt"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Project not found")

    def test_project_delete_returns_ok(self):
        response = self.client.delete("/api/projects/project-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        self.assertEqual(self.jobs.deleted_project_id, "project-1")

    def test_project_delete_returns_404_for_missing_project(self):
        response = self.client.delete("/api/projects/missing-project")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Project not found")

    def test_project_render_returns_existing_project_when_all_blocks_are_ready(self):
        response = self.client.post("/api/projects/project-1/render")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["project"]["id"], "project-1")

    def test_project_block_audio_returns_ready_wav_file(self):
        response = self.client.get("/api/projects/project-1/blocks/0/audio")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"project-block-audio")
        self.assertEqual(response.headers["content-type"], "audio/wav")

    def test_project_block_audio_returns_400_for_block_that_is_not_ready(self):
        response = self.client.get("/api/projects/project-1/blocks/1/audio")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Block status is running")

    def test_project_block_audio_returns_404_for_missing_block(self):
        response = self.client.get("/api/projects/project-1/blocks/99/audio")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Block not found")

    def test_project_download_returns_attachment_file(self):
        response = self.client.get("/api/projects/project-1/download")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"project-final-audio")
        self.assertIn("attachment", response.headers["content-disposition"])

    def test_project_download_returns_404_for_missing_project(self):
        response = self.client.get("/api/projects/missing-project/download")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Project not found")
