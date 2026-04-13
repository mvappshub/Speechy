"""
Czech TTS Server using facebook/mms-tts-ces model from HuggingFace.
Runs locally on port 8000. Provides a REST API for text-to-speech synthesis.
"""

import io
import uuid
import asyncio
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import scipy.io.wavfile as wavfile
import torch

# ── Load the model at startup ──────────────────────────────────────────────
from transformers import VitsModel, AutoTokenizer

MODEL_NAME = "facebook/mms-tts-ces"

print(f"[TTS] Loading model {MODEL_NAME} ...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = VitsModel.from_pretrained(MODEL_NAME)
model.eval()
print(f"[TTS] Model loaded successfully on {'CUDA' if torch.cuda.is_available() else 'CPU'}")

# ── FastAPI app ────────────────────────────────────────────────────────────
app = FastAPI(title="Czech TTS API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ──────────────────────────────────────────────
class SynthesizeRequest(BaseModel):
    text: str
    speed: float = 1.0   # 0.5 - 2.0

class SynthesizeResponse(BaseModel):
    id: str
    status: str

# ── In-memory job storage ──────────────────────────────────────────────────
jobs: dict[str, dict] = {}

# ── Synthesis function ─────────────────────────────────────────────────────
def synthesize_audio(text: str, speed: float = 1.0) -> bytes:
    """Synthesize Czech text to WAV audio bytes using MMS-TTS-CES."""
    inputs = tokenizer(text, return_tensors="pt")

    with torch.no_grad():
        # speaking_rate controls speed (1.0 = normal)
        output = model(**inputs, speaking_rate=speed)

    waveform = output.waveform.squeeze().cpu().numpy()

    # Normalize to 16-bit PCM
    waveform = waveform / (np.max(np.abs(waveform)) + 1e-8)
    waveform_int16 = (waveform * 32767).astype(np.int16)

    # Write to WAV in memory
    buf = io.BytesIO()
    wavfile.write(buf, rate=model.config.sampling_rate, data=waveform_int16)
    buf.seek(0)
    return buf.read()

# ── API endpoints ──────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME}

@app.post("/api/synthesize")
async def synthesize(req: SynthesizeRequest):
    """
    Synchronous TTS: send text, receive WAV audio directly.
    Good for short texts (< ~500 chars).
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    try:
        audio_bytes = synthesize_audio(req.text, req.speed)
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={"Content-Disposition": "attachment; filename=tts_output.wav"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/synthesize-async", response_model=SynthesizeResponse)
async def synthesize_async(req: SynthesizeRequest):
    """
    Async TTS: start a job, poll /api/job/{id} for status, then download.
    Good for longer texts.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing", "text": req.text, "speed": req.speed}

    # Run synthesis in background thread
    asyncio.create_task(_run_job(job_id, req.text, req.speed))

    return SynthesizeResponse(id=job_id, status="processing")

async def _run_job(job_id: str, text: str, speed: float):
    try:
        loop = asyncio.get_event_loop()
        audio_bytes = await loop.run_in_executor(None, synthesize_audio, text, speed)
        jobs[job_id] = {
            "status": "done",
            "audio": audio_bytes,
            "text": text,
            "speed": speed,
        }
    except Exception as e:
        jobs[job_id] = {"status": "error", "error": str(e), "text": text, "speed": speed}

@app.get("/api/job/{job_id}")
async def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job["status"],
        "error": job.get("error"),
    }

@app.get("/api/job/{job_id}/audio")
async def get_job_audio(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Job status is {job['status']}")
    return StreamingResponse(
        io.BytesIO(job["audio"]),
        media_type="audio/wav",
    )

# ── Run ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
