import io
import sys
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from pydantic import BaseModel, Field

from infrastructure.gpu import ensure_gpu_ready
from infrastructure.voice_store import VoiceStore


class InferenceOptions(BaseModel):
    speed: float = Field(default=1.0, ge=0.7, le=1.3)
    voice: str = "speaker.wav"
    language: str = "cs"
    num_step: int = Field(default=32, ge=1, le=128)
    guidance_scale: float = Field(default=2.0, ge=0.0, le=10.0)
    denoise: bool = True
    preprocess_prompt: bool = True
    postprocess_output: bool = True


class XttsRuntime:
    model_name = "k2-fsa/OmniVoice"
    sync_text_limit = 500
    long_form_chunk_chars = 170
    default_inference = {
        "language": "cs",
        "speed": 1.0,
        "num_step": 32,
        "guidance_scale": 2.0,
        "denoise": True,
        "preprocess_prompt": True,
        "postprocess_output": True,
    }

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.voice_store = VoiceStore(base_dir, "speaker.wav")
        self.gpu_info = ensure_gpu_ready()
        self._model = None

    @property
    def sample_rate(self) -> int:
        model = self._ensure_model()
        return int(model.sampling_rate)

    def build_tts_kwargs(self, options: InferenceOptions | None = None) -> dict[str, Any]:
        resolved = self.default_inference.copy()
        if options:
            resolved.update(options.model_dump())
        return resolved

    def create_voice_clone_prompt(self, voice_name: str, preprocess_prompt: bool = True):
        model = self._ensure_model()
        voice_path = self.voice_store.resolve(voice_name)
        transcript = self.voice_store.load_transcript(voice_path)

        if transcript is not None:
            return model.create_voice_clone_prompt(
                ref_audio=str(voice_path),
                ref_text=transcript,
                preprocess_prompt=preprocess_prompt,
            )

        try:
            return model.create_voice_clone_prompt(
                ref_audio=str(voice_path),
                ref_text=None,
                preprocess_prompt=preprocess_prompt,
            )
        except Exception as exc:
            transcript_path = self.voice_store.transcript_path_for_voice(voice_path)
            raise RuntimeError(
                "No transcript sidecar was found for "
                f"'{voice_path.name}'. OmniVoice ASR fallback failed. "
                f"Add a UTF-8 transcript sidecar at '{transcript_path.name}' or install "
                "compatible torchcodec + FFmpeg shared runtime for transcript-less voices. "
                f"Original error: {exc}"
            ) from exc

    def render_single_block(
        self,
        text: str,
        voice_name: str,
        language: str = "cs",
        speed: float = 1.0,
        voice_clone_prompt=None,
        options: InferenceOptions | None = None,
    ) -> tuple[np.ndarray, int]:
        resolved = self.build_tts_kwargs(options)
        model = self._ensure_model()
        prompt = voice_clone_prompt or self.create_voice_clone_prompt(
            voice_name,
            preprocess_prompt=resolved["preprocess_prompt"],
        )
        generation_config = self._build_generation_config(resolved)
        audio = model.generate(
            text=text,
            language=language or resolved["language"],
            speed=speed,
            voice_clone_prompt=prompt,
            generation_config=generation_config,
        )[0]
        waveform = np.asarray(audio, dtype=np.float32)
        if waveform.ndim > 1:
            waveform = waveform.squeeze()
        return waveform, self.sample_rate

    def concatenate_rendered_blocks(self, rendered_blocks: list[dict[str, Any]]):
        if not rendered_blocks:
            raise ValueError("No rendered blocks were provided.")

        sample_rate = rendered_blocks[0]["sample_rate"]
        timeline = []
        combined: list[np.ndarray] = []
        current_sample = 0

        for index, block in enumerate(rendered_blocks):
            block_rate = int(block["sample_rate"])
            if block_rate != sample_rate:
                raise ValueError("Rendered blocks must share the same sample rate.")

            waveform = np.asarray(block["waveform"], dtype=np.float32).squeeze()
            start_ms = int((current_sample / sample_rate) * 1000)
            current_sample += int(waveform.shape[-1])
            end_ms = int((current_sample / sample_rate) * 1000)
            timeline.append(
                {
                    "index": index,
                    "text": block["text"],
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                }
            )
            combined.append(waveform)

        return np.concatenate(combined), sample_rate, timeline

    def write_final_wav(self, waveform, sample_rate: int) -> bytes:
        audio = np.asarray(waveform, dtype=np.float32).squeeze()
        with io.BytesIO() as buffer:
            sf.write(buffer, audio, sample_rate, format="WAV")
            return buffer.getvalue()

    def read_final_wav(self, path: Path) -> bytes:
        return path.read_bytes()

    def read_wav(self, path: Path):
        waveform, sample_rate = sf.read(path, dtype="float32")
        return waveform, int(sample_rate)

    def _build_generation_config(self, resolved: dict[str, Any]):
        omnivoice = self._load_omnivoice_symbols()
        return omnivoice["OmniVoiceGenerationConfig"](
            num_step=resolved["num_step"],
            guidance_scale=resolved["guidance_scale"],
            denoise=resolved["denoise"],
            preprocess_prompt=resolved["preprocess_prompt"],
            postprocess_output=resolved["postprocess_output"],
        )

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        omnivoice = self._load_omnivoice_symbols()
        self._model = omnivoice["OmniVoice"].from_pretrained(
            self.model_name,
            load_asr=True,
            torch_dtype=omnivoice["torch"].float16,
            device_map="cuda",
        )
        return self._model

    def _load_omnivoice_symbols(self) -> dict[str, Any]:
        repo_root = self.base_dir.parent if self.base_dir.name == "tts-server" else self.base_dir
        vendor_root = repo_root / "OmniVoice"
        if str(vendor_root) not in sys.path:
            sys.path.insert(0, str(vendor_root))

        import torch
        from omnivoice.models.omnivoice import OmniVoice, OmniVoiceGenerationConfig

        return {
            "torch": torch,
            "OmniVoice": OmniVoice,
            "OmniVoiceGenerationConfig": OmniVoiceGenerationConfig,
        }
