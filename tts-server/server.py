import os
from pathlib import Path
from infrastructure.model_cache import configure_model_cache
BASE_DIR = Path(__file__).resolve().parent
configure_model_cache(BASE_DIR)
if __name__ == "__main__":
    import uvicorn
    reload_enabled = os.environ.get("TTS_SERVER_RELOAD", "").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run(
        "presentation.http:app",
        host="0.0.0.0",
        port=int(os.environ.get("TTS_SERVER_PORT") or os.environ.get("PORT") or "8000"),
        reload=reload_enabled,
        reload_dirs=[str(BASE_DIR / folder) for folder in ("presentation", "application", "domain", "infrastructure")],
    )
