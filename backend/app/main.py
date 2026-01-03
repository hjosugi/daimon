import os
import subprocess
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import posts, auth
from app.logger import setup_logging, logger

setup_logging()
logger.info("Starting Daimon API")

# Download spaCy models on startup if they don't exist (background task)
def download_spacy_models_if_needed():
    """Download spaCy models if they don't exist."""
    try:
        import spacy
        models = ["ja_core_news_sm", "en_core_web_sm"]
        for model_name in models:
            try:
                spacy.load(model_name)
                logger.info(f"spaCy model '{model_name}' already installed")
            except OSError:
                logger.info(f"Downloading spaCy model '{model_name}'...")
                # Use subprocess to avoid pydantic v1 import issues
                result = subprocess.run(
                    [sys.executable, "-m", "spacy", "download", model_name],
                    capture_output=True,
                    timeout=300
                )
                if result.returncode == 0:
                    logger.info(f"Successfully downloaded '{model_name}'")
                else:
                    logger.warning(f"Failed to download '{model_name}', will use fallback")
    except Exception as e:
        logger.warning(f"Error checking/downloading spaCy models: {e}, will use fallback")

# Download models in background (non-blocking)
try:
    import threading
    thread = threading.Thread(target=download_spacy_models_if_needed, daemon=True)
    thread.start()
except Exception as e:
    logger.warning(f"Could not start model download thread: {e}")

# Database initialization is handled by Alembic migrations
# Run 'alembic upgrade head' to apply migrations

app = FastAPI(title="Daimon API", version="0.1.0")

app.include_router(posts.router)
app.include_router(auth.router)


# CORS Setup
# Allow origins from environment variable (comma-separated) or default to localhost
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    # Default to localhost for development
    origins = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",   # Alternative dev server
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Daimon API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
