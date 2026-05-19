from typing import Any

from domain.project_cache_policy import build_project_cache_key
from domain.project_timeline import recompute_project_timeline


def hydrate_loaded_project(project: dict[str, Any], model_identity: str) -> dict[str, Any]:
    project.setdefault("pinned", False)
    project.setdefault("final_audio_path", None)
    project.setdefault("download_ready", False)
    project.setdefault("total_blocks", len(project.get("blocks", [])))
    project.setdefault("completed_blocks", 0)

    for index, block in enumerate(project.get("blocks", [])):
        block.setdefault("index", index)
        block.setdefault(
            "cache_key",
            build_project_cache_key(
                text=block["text"],
                voice=block["voice"],
                language=project["language"],
                settings=project["settings"],
                model_identity=model_identity,
            ),
        )
        block.setdefault("error", None)
        block.setdefault("audio_path", None)
        block.setdefault("audio_ready", False)
        block.setdefault("duration_ms", None)
        block.setdefault("sample_rate", None)
        block.setdefault("start_ms", None)
        block.setdefault("end_ms", None)

    return recompute_project_timeline(project)
