import sys
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


class HttpAppTests(unittest.TestCase):
    def setUp(self):
        self.jobs = FakeJobs()
        self.client = TestClient(create_app(runtime=FakeRuntime(), jobs=self.jobs))

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
