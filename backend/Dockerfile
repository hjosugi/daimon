FROM python:3.12-slim as builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY requirements.txt ./
RUN uv pip install --system -r requirements.txt

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY requirements.txt ./
RUN uv pip install --system -r requirements.txt

COPY . .

EXPOSE 8080
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
