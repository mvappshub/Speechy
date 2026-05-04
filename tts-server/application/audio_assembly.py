from pathlib import Path
from typing import Any


class ProjectAudioAssembler:
    def __init__(self, project_store, runtime):
        self.project_store = project_store
        self.runtime = runtime

    def assemble_project_audio(self, project_id: str):
        project = self.project_store.get_project(project_id)
        if not project["blocks"]:
            raise ValueError("Project is empty")
        if any(block["status"] != "done" or not block["audio_path"] for block in project["blocks"]):
            raise ValueError("Project is not fully rendered")

        rendered_blocks: list[dict[str, Any]] = []
        for block in project["blocks"]:
            waveform, sample_rate = self.runtime.read_wav(Path(block["audio_path"]))
            rendered_blocks.append(
                {
                    "index": block["index"],
                    "text": block["text"],
                    "waveform": waveform,
                    "sample_rate": sample_rate,
                }
            )

        final_waveform, sample_rate, timeline = self.runtime.concatenate_rendered_blocks(rendered_blocks)
        audio_bytes = self.runtime.write_final_wav(final_waveform, sample_rate)
        self.project_store.set_final_audio(project_id, audio_bytes)
        for timeline_block in timeline:
            self.project_store.update_project_block(
                project_id,
                timeline_block["index"],
                status="done",
                audio_path=project["blocks"][timeline_block["index"]]["audio_path"],
                duration_ms=timeline_block["end_ms"] - timeline_block["start_ms"],
                sample_rate=sample_rate,
                error=None,
            )
