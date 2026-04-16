from typing import TypedDict


class TimelineBlock(TypedDict):
    index: int
    text: str
    start_ms: int
    end_ms: int


class RenderBlock(TypedDict):
    index: int
    text: str
    status: str
    error: str | None
    audio_path: str | None


class Job(TypedDict):
    id: str
    status: str
    voice: str
    text: str
    language: str
    speed: float
    total_blocks: int
    completed_blocks: int
    timeline: list[TimelineBlock]
    final_audio_path: str | None
    error: str | None
    created_at: float
    finished_at: float | None
    blocks: list[RenderBlock]
