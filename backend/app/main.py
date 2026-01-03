import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import posts, auth
from app.logger import setup_logging, logger

setup_logging()
logger.info("Starting Daimon API")

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
