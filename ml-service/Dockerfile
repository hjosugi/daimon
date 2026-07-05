FROM python:3.12-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.11.21 /uv /usr/local/bin/uv

WORKDIR /app
ENV HF_HOME=/opt/models/hf
ENV SENTENCE_TRANSFORMERS_HOME=/opt/models/st
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Pre-bake the models so the first request needs no download.
RUN .venv/bin/python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')" \
    && .venv/bin/python -c "import spacy; spacy.load('ja_core_news_sm'); spacy.load('en_core_web_sm')"

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HF_HOME=/opt/models/hf
ENV SENTENCE_TRANSFORMERS_HOME=/opt/models/st
ENV PATH=/app/.venv/bin:$PATH

COPY --from=build /app/.venv ./.venv
COPY --from=build /opt/models /opt/models
COPY . .

EXPOSE 8001
ENV PORT=8001
ENV PYTHONUNBUFFERED=1
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
