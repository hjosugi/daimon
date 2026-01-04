FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

ENV UV_CACHE_DIR=/root/.cache/uv
ENV UV_NO_CACHE=false
ENV UV_SYSTEM_PYTHON=1

# Cache dependencies by copying requirements first
COPY requirements.txt ./
RUN uv pip install --system -r requirements.txt

COPY . .

EXPOSE 8080
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=""
ENV EMBEDDING_DEVICE=cpu

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
