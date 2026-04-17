import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
if __name__ == "__main__":
    import uvicorn
    reload_enabled = os.environ.get("TTS_SERVER_RELOAD", "").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run(
        "presentation.http:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled,
        reload_dirs=[str(BASE_DIR / folder) for folder in ("presentation", "application", "domain", "infrastructure")],
    )
