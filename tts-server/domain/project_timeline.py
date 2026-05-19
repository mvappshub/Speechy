from typing import Any


def recompute_project_timeline(project: dict[str, Any]):
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
    return project
