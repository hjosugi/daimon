import os
import subprocess
import sys
import threading
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
os.environ.setdefault("EMBEDDING_DEVICE", "cpu")

from app.logger import setup_logging, logger

setup_logging()
logger.info("Starting Daimon API (CPU mode)")

app = FastAPI(title="Daimon API", version="0.1.0")

# Configure CORS before adding routers
environment = os.getenv("ENVIRONMENT", "development").lower()
cors_origins_env = os.getenv("CORS_ORIGINS", "")

if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
elif environment == "development":
    # In development, allow common localhost ports
    # Include both localhost and 127.0.0.1 variants for common dev ports
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:8080",
    ]
else:
    # Production: require explicit CORS_ORIGINS
    origins = []

logger.info(f"CORS origins: {origins} (environment: {environment})")

# Add logging middleware for CORS debugging (development only)
# if environment == "development":
#     class CORSDebugMiddleware(BaseHTTPMiddleware):
#         async def dispatch(self, request: Request, call_next):
#             if request.method == "OPTIONS":
#                 origin = request.headers.get("origin")
#                 logger.info(f"OPTIONS preflight request - Origin: {origin}, Path: {request.url.path}, Allowed origins: {origins}")
#             response = await call_next(request)
#             if request.method == "OPTIONS":
#                 logger.info(f"OPTIONS response status: {response.status_code}")
#             return response
    
#     app.add_middleware(CORSDebugMiddleware)

# CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
#     allow_headers=["*"],
#     expose_headers=["*"],
#     max_age=3600,  # Cache preflight requests for 1 hour
# )

@app.get("/health")
def health_check():
    return {"status": "ok"}

try:
    from app.routers import posts, auth
    app.include_router(posts.router)
    app.include_router(auth.router)
except Exception as e:
    logger.error(f"Failed to import routers: {e}", exc_info=True)
    raise

@app.get("/")
def read_root():
    return {"message": "Welcome to Daimon API"}

def download_spacy_models_if_needed():
    try:
        import warnings
        warnings.filterwarnings("ignore", message=".*numpy.dtype size changed.*")
        
        import spacy
        models = ["ja_core_news_sm", "en_core_web_sm"]
        for model_name in models:
            try:
                spacy.load(model_name)
                logger.info(f"spaCy model '{model_name}' already installed")
            except (OSError, ImportError):
                logger.info(f"Downloading spaCy model '{model_name}'...")
                try:
                    result = subprocess.run(
                        [sys.executable, "-m", "spacy", "download", model_name],
                        capture_output=True,
                        timeout=300
                    )
                    if result.returncode == 0:
                        logger.info(f"Successfully downloaded '{model_name}'")
                    else:
                        logger.warning(f"Failed to download '{model_name}', will use fallback")
                except Exception as download_error:
                    logger.warning(f"Error downloading '{model_name}': {download_error}, will use fallback")
    except Exception as e:
        error_msg = str(e)
        if "numpy.dtype size changed" in error_msg:
            logger.debug(f"numpy compatibility warning (non-critical): {error_msg}")
        else:
            logger.warning(f"Error checking/downloading spaCy models: {e}, will use fallback")

@app.on_event("startup")
async def startup_event():
    try:
        thread = threading.Thread(target=download_spacy_models_if_needed, daemon=True)
        thread.start()
    except Exception as e:
        logger.warning(f"Could not start model download thread: {e}")
