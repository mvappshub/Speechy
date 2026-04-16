import io
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from application.job_service import JobService

if TYPE_CHECKING:
    from infrastructure.xtts_runtime import InferenceOptions, XttsRuntime

BASE_DIR = Path(__file__).resolve().parents[1]


def _default_runtime():
    from infrastructure.xtts_runtime import XttsRuntime

    return XttsRuntime(BASE_DIR)


def _default_jobs(runtime: "XttsRuntime"):
    return JobService(runtime, storage_dir=BASE_DIR / "tmp-jobs")


class RenderRequest(BaseModel):
    text: str
    voice: str = "speaker.wav"
    language: str = "cs"
    speed: float = Field(default=1.0, ge=0.7, le=1.3)


class ProjectSyncRequest(RenderRequest):
    project_id: str | None = None
    block_voices: list[str] | None = None


def create_app(runtime: "XttsRuntime | None" = None, jobs: JobService | None = None):
    runtime_instance = runtime
    jobs_instance = jobs

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal runtime_instance, jobs_instance
        runtime_instance = runtime_instance or _default_runtime()
        jobs_instance = jobs_instance or _default_jobs(runtime_instance)
        app.state.runtime = runtime_instance
        app.state.jobs = jobs_instance
        try:
            yield
        finally:
            if hasattr(jobs_instance, "shutdown"):
                await jobs_instance.shutdown()

    app = FastAPI(title="Czech OmniVoice API", version="3.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_runtime():
        return app.state.runtime if hasattr(app.state, "runtime") else runtime_instance

    def get_jobs():
        return app.state.jobs if hasattr(app.state, "jobs") else jobs_instance

    def parse_options(payload: dict):
        from infrastructure.xtts_runtime import InferenceOptions

        return InferenceOptions(**payload)

    @app.get("/api/health")
    async def health():
        runtime = get_runtime()
        return {
            "status": "ok",
            "model": runtime.model_name,
            "mode": "progressive",
            "gpu": runtime.gpu_info,
            "default_voice": runtime.voice_store.default_voice_name,
            "defaults": runtime.default_inference,
            "long_form_chunk_chars": runtime.long_form_chunk_chars,
            "sync_text_limit": runtime.sync_text_limit,
        }

    @app.get("/api/voices")
    async def get_voices():
        runtime = get_runtime()
        return {
            "default_voice": runtime.voice_store.default_voice_name,
            "voices": [runtime.voice_store.serialize(path) for path in runtime.voice_store.list_voice_paths()],
        }

    @app.post("/api/voices")
    async def upload_voice(file: UploadFile = File(...)):
        runtime = get_runtime()
        filename = Path(file.filename or "").name
        if not filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="Only WAV voice files are supported.")
        content = await file.read()
        if len(content) < 1024:
            raise HTTPException(status_code=400, detail="Uploaded WAV file is too small.")
        saved = runtime.voice_store.save_upload(filename, content)
        return {"voice": runtime.voice_store.serialize(saved)}

    @app.post("/api/render")
    async def start_render(req: RenderRequest):
        jobs = get_jobs()
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")
        try:
            job_id = jobs.create_job(
                req.text,
                parse_options(
                    {
                        "voice": req.voice,
                        "language": req.language,
                        "speed": req.speed,
                    }
                ),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return {"id": job_id, "status": "queued"}

    def serialize_project(project: dict):
        return {
            "id": project["id"],
            "title": project["title"],
            "text": project["text"],
            "language": project["language"],
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

    @app.get("/api/projects")
    async def list_projects():
        jobs = get_jobs()
        return jobs.list_projects()

    @app.post("/api/projects/sync")
    async def sync_project(req: ProjectSyncRequest):
        jobs = get_jobs()
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")
        try:
            project = jobs.sync_project(
                req.project_id,
                req.text,
                parse_options(
                    {
                        "voice": req.voice,
                        "language": req.language,
                        "speed": req.speed,
                    }
                ),
                block_voices=req.block_voices,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return serialize_project(jobs.get_project(project["id"]))

    @app.get("/api/projects/{project_id}")
    async def get_project(project_id: str):
        jobs = get_jobs()
        try:
            project = jobs.get_project(project_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Project not found")
        return serialize_project(project)

    @app.post("/api/projects/{project_id}/render")
    async def render_project(project_id: str):
        jobs = get_jobs()
        try:
            job_id = jobs.render_project(project_id)
            project = jobs.get_project(project_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Project not found")
        return {
            "project": serialize_project(project),
            "job_id": job_id,
            "status": "queued" if job_id else "ready",
        }

    @app.get("/api/projects/{project_id}/blocks/{block_index}/audio")
    async def get_project_block_audio(project_id: str, block_index: int):
        jobs = get_jobs()
        try:
            audio_path = jobs.project_store.get_block_audio_path(project_id, block_index)
        except KeyError:
            raise HTTPException(status_code=404, detail="Block not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Block status is {exc}")
        return StreamingResponse(io.BytesIO(Path(audio_path).read_bytes()), media_type="audio/wav")

    @app.get("/api/projects/{project_id}/download")
    async def download_project_audio(project_id: str):
        jobs = get_jobs()
        try:
            audio_path = jobs.project_store.get_final_audio_path(project_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Project not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Project download is {exc}")
        return StreamingResponse(
            io.BytesIO(Path(audio_path).read_bytes()),
            media_type="audio/wav",
            headers={"Content-Disposition": f'attachment; filename=\"{project_id}.wav\"'},
        )

    @app.get("/api/render/{job_id}")
    async def get_render_status(job_id: str):
        jobs = get_jobs()
        try:
            job = jobs.get_job(job_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Job not found")

        return JSONResponse(
            {
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
        )

    @app.get("/api/render/{job_id}/blocks/{block_index}/audio")
    async def get_render_block_audio(job_id: str, block_index: int):
        jobs = get_jobs()
        try:
            audio = jobs.get_block_audio(job_id, block_index)
        except KeyError:
            raise HTTPException(status_code=404, detail="Block not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Block status is {exc}")
        return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")

    @app.get("/api/render/{job_id}/audio")
    async def get_render_audio(job_id: str):
        jobs = get_jobs()
        try:
            audio = jobs.get_final_audio(job_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Job not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Render status is {exc}")
        return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")

    @app.get("/api/render/{job_id}/download")
    async def download_render_audio(job_id: str):
        jobs = get_jobs()
        try:
            audio = jobs.get_final_audio(job_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Job not found")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Render status is {exc}")
        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/wav",
            headers={"Content-Disposition": f'attachment; filename="{job_id}.wav"'},
        )

    return app


app = create_app()
