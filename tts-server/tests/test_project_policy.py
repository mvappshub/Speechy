import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from domain.project_cache_policy import build_synced_project_blocks
from domain.project_hydration import hydrate_loaded_project
from domain.project_timeline import recompute_project_timeline


class ProjectPolicyTests(unittest.TestCase):
    def test_build_synced_project_blocks_reuses_matching_blocks_and_queues_changed_ones(self):
        previous_blocks = [
            {
                "index": 0,
                "text": "Prvni blok",
                "voice": "speaker.wav",
                "status": "done",
                "error": None,
                "audio_path": "first.wav",
                "audio_ready": True,
                "duration_ms": 1000,
                "sample_rate": 22050,
                "start_ms": 0,
                "end_ms": 1000,
            },
            {
                "index": 1,
                "text": "Druhy blok",
                "voice": "speaker.wav",
                "status": "done",
                "error": None,
                "audio_path": "second.wav",
                "audio_ready": True,
                "duration_ms": 1000,
                "sample_rate": 22050,
                "start_ms": 1000,
                "end_ms": 2000,
            },
        ]

        next_blocks, block_content_changed = build_synced_project_blocks(
            previous_blocks=previous_blocks,
            blocks=[
                {"text": "Prvni blok", "voice": "speaker.wav"},
                {"text": "Zmeneny blok", "voice": "speaker.wav"},
            ],
            language="cs",
            settings={"speed": 1.0},
            model_identity="fake-runtime",
        )

        self.assertTrue(block_content_changed)
        self.assertEqual(next_blocks[0]["status"], "done")
        self.assertEqual(next_blocks[0]["audio_path"], "first.wav")
        self.assertEqual(next_blocks[1]["status"], "queued")
        self.assertIsNone(next_blocks[1]["audio_path"])

    def test_recompute_project_timeline_stops_after_first_gap(self):
        project = {
            "final_audio_path": None,
            "blocks": [
                {"status": "done", "audio_path": "a.wav", "duration_ms": 1000},
                {"status": "queued", "audio_path": None, "duration_ms": None},
                {"status": "done", "audio_path": "c.wav", "duration_ms": 500},
            ],
        }

        recompute_project_timeline(project)

        self.assertEqual(project["blocks"][0]["start_ms"], 0)
        self.assertEqual(project["blocks"][0]["end_ms"], 1000)
        self.assertIsNone(project["blocks"][1]["start_ms"])
        self.assertIsNone(project["blocks"][1]["end_ms"])
        self.assertIsNone(project["blocks"][2]["start_ms"])
        self.assertIsNone(project["blocks"][2]["end_ms"])
        self.assertEqual(project["completed_blocks"], 2)
        self.assertEqual(project["total_blocks"], 3)

    def test_hydrate_loaded_project_populates_legacy_defaults_and_cache_keys(self):
        project = hydrate_loaded_project(
            {
                "id": "project-1",
                "title": "Projekt",
                "text": "Text",
                "language": "cs",
                "selected_voice": "speaker.wav",
                "settings": {"speed": 1.0},
                "created_at": 1.0,
                "updated_at": 2.0,
                "blocks": [
                    {
                        "text": "Prvni blok",
                        "voice": "speaker.wav",
                        "status": "queued",
                    }
                ],
            },
            "fake-runtime",
        )

        self.assertFalse(project["pinned"])
        self.assertIsNone(project["final_audio_path"])
        self.assertFalse(project["download_ready"])
        self.assertEqual(project["total_blocks"], 1)
        self.assertEqual(project["completed_blocks"], 0)
        self.assertEqual(project["blocks"][0]["index"], 0)
        self.assertIsNotNone(project["blocks"][0]["cache_key"])
        self.assertFalse(project["blocks"][0]["audio_ready"])
        self.assertIsNone(project["blocks"][0]["start_ms"])
        self.assertIsNone(project["blocks"][0]["end_ms"])

    def test_hydrate_loaded_project_recomputes_ready_block_timeline(self):
        project = hydrate_loaded_project(
            {
                "id": "project-1",
                "title": "Projekt",
                "text": "Text",
                "language": "cs",
                "selected_voice": "speaker.wav",
                "settings": {"speed": 1.0},
                "created_at": 1.0,
                "updated_at": 2.0,
                "final_audio_path": "final.wav",
                "blocks": [
                    {
                        "text": "Prvni blok",
                        "voice": "speaker.wav",
                        "status": "done",
                        "audio_path": "a.wav",
                        "duration_ms": 1000,
                    },
                    {
                        "text": "Druhy blok",
                        "voice": "speaker.wav",
                        "status": "done",
                        "audio_path": "b.wav",
                        "duration_ms": 500,
                    },
                ],
            },
            "fake-runtime",
        )

        self.assertTrue(project["download_ready"])
        self.assertTrue(project["blocks"][0]["audio_ready"])
        self.assertEqual(project["blocks"][0]["start_ms"], 0)
        self.assertEqual(project["blocks"][0]["end_ms"], 1000)
        self.assertEqual(project["blocks"][1]["start_ms"], 1000)
        self.assertEqual(project["blocks"][1]["end_ms"], 1500)
