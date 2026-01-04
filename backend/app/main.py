import os
import subprocess
import sys
import threading
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

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

# CORS - Allow all origins (temporary for production)
# IMPORTANT: CORSMiddleware must be added LAST so it runs FIRST (middleware runs in reverse order)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (temporary)
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add logging middleware for CORS debugging (added after CORS, so runs before CORS)
class CORSDebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            origin = request.headers.get("origin")
            logger.info(f"OPTIONS preflight request - Origin: {origin}, Path: {request.url.path}")
        try:
            response = await call_next(request)
            # Log CORS headers in response
            cors_headers = {k: v for k, v in response.headers.items() if k.lower().startswith('access-control')}
            if cors_headers or request.method == "OPTIONS":
                logger.info(f"{request.method} {request.url.path} - Status: {response.status_code}, CORS headers: {cors_headers}")
            return response
        except Exception as e:
            logger.error(f"Error in request: {e}", exc_info=True)
            # Ensure CORS headers are added even on errors
            error_response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"}
            )
            # Add CORS headers manually
            error_response.headers["Access-Control-Allow-Origin"] = "*"
            error_response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
            error_response.headers["Access-Control-Allow-Headers"] = "*"
            return error_response

app.add_middleware(CORSDebugMiddleware)

# Exception handlers to ensure CORS headers are always present
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    # Add CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
    response.headers["Access-Control-Allow-Headers"] = "*"
    logger.error(f"HTTPException: {exc.status_code} - {exc.detail}")
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )
    # Add CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
    response.headers["Access-Control-Allow-Headers"] = "*"
    logger.error(f"ValidationError: {exc.errors()}")
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
    # Add CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

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
