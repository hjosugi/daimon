# Multi-stage build for smaller image size
FROM python:3.12-slim as builder

# Install system dependencies required for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY requirements.txt ./

# Install dependencies
RUN uv pip install --system -r requirements.txt

# Production stage
FROM python:3.12-slim

# Install runtime system dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv in production stage for re-installing dependencies
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY requirements.txt ./

# Re-install dependencies in production stage to ensure binary compatibility
# This avoids issues with C extensions copied from builder stage
RUN uv pip install --system -r requirements.txt

# Copy application code
COPY . .

# Note: spaCy models are not downloaded during build to avoid pydantic v1 compatibility issues
# Models will be downloaded on first use by the application, or can be downloaded manually
# The application code handles missing models gracefully with fallback extraction

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run the application
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
