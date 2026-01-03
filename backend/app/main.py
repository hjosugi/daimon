import os
import subprocess
import sys
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import posts, auth
from app.logger import setup_logging, logger

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
os.environ.setdefault("EMBEDDING_DEVICE", "cpu")

setup_logging()
logger.info("Starting Daimon API (CPU mode)")

def download_spacy_models_if_needed():
    try:
        import spacy
        models = ["ja_core_news_sm", "en_core_web_sm"]
        for model_name in models:
            try:
                spacy.load(model_name)
                logger.info(f"spaCy model '{model_name}' already installed")
            except OSError:
                logger.info(f"Downloading spaCy model '{model_name}'...")
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

try:
    thread = threading.Thread(target=download_spacy_models_if_needed, daemon=True)
    thread.start()
except Exception as e:
    logger.warning(f"Could not start model download thread: {e}")

app = FastAPI(title="Daimon API", version="0.1.0")

app.include_router(posts.router)
app.include_router(auth.router)

cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",")]
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
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
