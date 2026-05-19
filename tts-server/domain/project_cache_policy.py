import hashlib
import json
import re
from pathlib import Path
from typing import Any


def normalize_project_text(value: str) -> str:
    return " ".join(value.split())


def derive_project_title(text: str) -> str:
    return "Novy projekt"


def slugify_project_value(value: str, fallback: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized[:40] or fallback


def build_project_cache_key(
    *,
    text: str,
    voice: str,
    language: str,
    settings: dict[str, Any],
    model_identity: str,
):
    payload = {
        "text": normalize_project_text(text),
        "voice": voice,
        "language": language,
        "model_identity": model_identity,
    }
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_synced_project_blocks(
    *,
    previous_blocks: list[dict[str, Any]],
    blocks: list[dict[str, Any]],
    language: str,
    settings: dict[str, Any],
    model_identity: str,
):
    next_blocks: list[dict[str, Any]] = []
    block_content_changed = False

    for index, block in enumerate(blocks):
        cache_key = build_project_cache_key(
            text=block["text"],
            voice=block["voice"],
            language=language,
            settings=settings,
            model_identity=model_identity,
        )
        previous_block = previous_blocks[index] if index < len(previous_blocks) else None
        reused = (
            previous_block
            and normalize_project_text(previous_block.get("text", "")) == normalize_project_text(block["text"])
            and previous_block.get("voice") == block["voice"]
        )
        if not reused:
            block_content_changed = True
        next_blocks.append(
            {
                "index": index,
                "text": block["text"],
                "voice": block["voice"],
                "cache_key": cache_key,
                "status": previous_block["status"] if reused else "queued",
                "error": previous_block.get("error") if reused else None,
                "audio_path": previous_block.get("audio_path") if reused else None,
                "audio_ready": previous_block.get("audio_ready", False) if reused else False,
                "duration_ms": previous_block.get("duration_ms") if reused else None,
                "sample_rate": previous_block.get("sample_rate") if reused else None,
                "start_ms": previous_block.get("start_ms") if reused else None,
                "end_ms": previous_block.get("end_ms") if reused else None,
            }
        )

    if previous_blocks and len(previous_blocks) != len(next_blocks):
        block_content_changed = True

    return next_blocks, block_content_changed


def build_project_block_filename(block_index: int, voice: str, text: str):
    voice_slug = slugify_project_value(Path(voice).stem, "voice")
    text_slug = slugify_project_value(normalize_project_text(text)[:48], f"block-{block_index + 1}")
    return f"{block_index + 1:02d}-{voice_slug}-{text_slug}.wav"
