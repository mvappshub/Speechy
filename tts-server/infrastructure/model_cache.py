import os
from pathlib import Path


def configure_model_cache(base_dir: Path):
    cache_dir = base_dir / ".model-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(cache_dir / "huggingface"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(cache_dir / "huggingface" / "hub"))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(cache_dir / "huggingface" / "transformers"))
    os.environ.setdefault("TORCH_HOME", str(cache_dir / "torch"))
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
