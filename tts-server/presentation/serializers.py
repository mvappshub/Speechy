def serialize_project(project: dict):
    return {
        "id": project["id"],
        "title": project["title"],
        "text": project["text"],
        "language": project["language"],
        "pinned": project.get("pinned", False),
        "selected_voice": project["selected_voice"],
        "settings": project["settings"],
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
        "download_ready": project["download_ready"],
        "status": project["status"],
        "progress": project["progress"],
        "blocks": [
            {
                "index": block["index"],
                "text": block["text"],
                "voice": block["voice"],
                "cache_key": block["cache_key"],
                "status": block["status"],
                "audio_ready": block["audio_ready"],
                "start_ms": block["start_ms"],
                "end_ms": block["end_ms"],
                "error": block["error"],
            }
            for block in project["blocks"]
        ],
    }


def serialize_render_status(job: dict):
    return {
        "id": job["id"],
        "status": job["status"],
        "progress": {
            "done": job["completed_blocks"],
            "total": job["total_blocks"],
        },
        "audio_ready": job["status"] == "done" and bool(job["final_audio_path"]),
        "download_ready": job["status"] == "done" and bool(job["final_audio_path"]),
        "timeline": job["timeline"],
        "blocks": [
            {
                "index": block["index"],
                "text": block["text"],
                "status": block["status"],
                "audio_ready": bool(block["audio_path"]) and block["status"] == "done",
                "start_ms": block["start_ms"],
                "end_ms": block["end_ms"],
                "error": block["error"],
            }
            for block in job["blocks"]
        ],
        "error": job["error"],
    }
