from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "presentation.http:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(BASE_DIR / folder) for folder in ("presentation", "application", "domain", "infrastructure")],
    )
