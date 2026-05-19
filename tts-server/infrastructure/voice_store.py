import os
from pathlib import Path
import uuid


class VoiceStore:
    def __init__(self, base_dir: Path, default_voice_name: str):
        self.base_dir = base_dir
        self.bundled_voices_dir = base_dir / "voices"
        configured_voices_dir = os.environ.get("TTS_SERVER_VOICES_DIR", "").strip()
        self.voices_dir = Path(configured_voices_dir) if configured_voices_dir else self.bundled_voices_dir
        self.legacy_voices = [base_dir / "speaker.wav", base_dir / "speaker2.wav"]
        self.default_voice_name = default_voice_name
        self.voices_dir.mkdir(parents=True, exist_ok=True)

    def list_voice_paths(self) -> list[Path]:
        voices = []
        seen: set[str] = set()
        candidate_dirs = [self.voices_dir]
        if self.bundled_voices_dir != self.voices_dir:
            candidate_dirs.append(self.bundled_voices_dir)
        wav_files: list[Path] = []
        for voice_dir in candidate_dirs:
            if not voice_dir.exists() or not voice_dir.is_dir():
                continue
            wav_files.extend(
                f for f in voice_dir.iterdir() if f.is_file() and f.suffix.lower() == ".wav"
            )
        for candidate in [*sorted(wav_files), *self.legacy_voices]:
            if candidate.exists() and candidate.is_file():
                key = str(candidate.resolve()).lower()
                if key not in seen:
                    voices.append(candidate)
                    seen.add(key)
        return voices

    def resolve(self, voice_name: str | None) -> Path:
        requested = voice_name or self.default_voice_name
        for candidate in self.list_voice_paths():
            if candidate.name == requested:
                return candidate
        raise FileNotFoundError(f"Voice '{requested}' was not found.")

    def transcript_path_for_voice(self, voice_path: Path) -> Path:
        return voice_path.with_suffix(".txt")

    def load_transcript(self, voice_path: Path) -> str | None:
        transcript_path = self.transcript_path_for_voice(voice_path)
        if not transcript_path.exists() or not transcript_path.is_file():
            return None

        content = transcript_path.read_text(encoding="utf-8").strip()
        return content or None

    def serialize(self, path: Path) -> dict[str, str | int | bool]:
        return {
            "name": path.name,
            "path": str(path),
            "size": path.stat().st_size,
            "is_default": path.name == self.default_voice_name,
            "has_transcript": self.load_transcript(path) is not None,
        }

    def save_upload(self, filename: str, content: bytes) -> Path:
        safe_name = Path(filename).name
        output_name = f"{Path(safe_name).stem}-{uuid.uuid4().hex[:8]}.wav"
        output_path = self.voices_dir / output_name
        output_path.write_bytes(content)
        return output_path
