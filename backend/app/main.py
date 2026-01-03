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
async def health_check():
    """Health check endpoint that verifies database connectivity"""
    try:
        from app.database import get_db
        from sqlalchemy import text
        
        # Test database connection
        db = next(get_db())
        try:
            db.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as db_error:
            logger.error(f"Database connection failed: {db_error}")
            db_status = "error"
        finally:
            db.close()
        
        # Test Qdrant connection if configured
        qdrant_status = "not_checked"
        try:
            from app.services.qdrant_service import qdrant_service
            # Simple check - just verify the service is initialized
            if hasattr(qdrant_service, 'client') and qdrant_service.client is not None:
                qdrant_status = "available"
            else:
                qdrant_status = "not_configured"
        except Exception as e:
            logger.warning(f"Qdrant health check failed: {e}")
            qdrant_status = "error"
        
        if db_status == "error":
            response = JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "error", "database": db_status, "qdrant": qdrant_status}
            )
            # Add CORS headers even for health check errors
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "*"
            return response
        
        return {"status": "ok", "database": db_status, "qdrant": qdrant_status}
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        response = JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "error", "detail": str(e)}
        )
        # Add CORS headers even for health check errors
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

try:
    from app.routers import posts, auth
    app.include_router(posts.router)
    app.include_router(auth.router)
    logger.info("Routers loaded successfully")
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
    """Startup event handler - initializes services and downloads models"""
    logger.info("Application startup - initializing services...")
    try:
        # Test database connection
        from app.database import get_db, DATABASE_URL
        from sqlalchemy import text
        from urllib.parse import urlparse
        
        # Log database connection info (without password)
        try:
            parsed = urlparse(DATABASE_URL)
            db_info = f"{parsed.scheme}://{parsed.username}:***@{parsed.hostname}:{parsed.port or 5432}{parsed.path}"
            logger.info(f"Connecting to database: {db_info}")
        except Exception:
            logger.warning("Could not parse DATABASE_URL for logging")
        
        db = next(get_db())
        try:
            db.execute(text("SELECT 1"))
            logger.info("Database connection successful")
        except Exception as db_error:
            error_msg = str(db_error)
            # Provide helpful error messages
            if "no password supplied" in error_msg.lower():
                logger.error(
                    "Database connection failed: Password missing in DATABASE_URL. "
                    "Please verify Secret Manager configuration. "
                    "Expected format: postgresql://user:password@host:port/database"
                )
            elif "connection refused" in error_msg.lower():
                logger.error(
                    f"Database connection failed: Connection refused. "
                    f"Please verify database host and port are correct."
                )
            else:
                logger.error(f"Database connection failed during startup: {db_error}", exc_info=True)
        finally:
            db.close()
        
        # Test Qdrant connection if configured
        try:
            from app.services.qdrant_service import qdrant_service
            if hasattr(qdrant_service, 'client') and qdrant_service.client is not None:
                logger.info("Qdrant connection available")
            else:
                logger.warning("Qdrant not configured")
        except Exception as qdrant_error:
            logger.warning(f"Qdrant connection check failed: {qdrant_error}")
        
        # Start spaCy model download in background
        thread = threading.Thread(target=download_spacy_models_if_needed, daemon=True)
        thread.start()
        logger.info("Application startup completed")
    except Exception as e:
        logger.error(f"Startup event failed: {e}", exc_info=True)
        # Don't raise - allow app to start even if some services fail
