import os
from pathlib import Path
from typing import TYPE_CHECKING

from application.job_service import JobService

if TYPE_CHECKING:
    from infrastructure.xtts_runtime import InferenceOptions, XttsRuntime

BASE_DIR = Path(__file__).resolve().parents[1]


def create_runtime():
    from infrastructure.xtts_runtime import XttsRuntime

    return XttsRuntime(BASE_DIR)


def create_jobs(runtime: "XttsRuntime"):
    configured_storage_dir = os.environ.get("TTS_SERVER_STORAGE_DIR", "").strip()
    storage_dir = Path(configured_storage_dir) if configured_storage_dir else BASE_DIR / "tmp-jobs"
    return JobService(runtime, storage_dir=storage_dir)


def parse_inference_options(payload: dict) -> "InferenceOptions":
    from infrastructure.xtts_runtime import InferenceOptions

    return InferenceOptions(**payload)
