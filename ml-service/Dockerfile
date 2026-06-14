FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
ENV HF_HOME=/opt/models/hf
ENV SENTENCE_TRANSFORMERS_HOME=/opt/models/st

COPY requirements.txt ./
RUN uv pip install --system -r requirements.txt

# Pre-bake the models so the first request needs no download.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" \
    && python -m spacy download ja_core_news_sm \
    && python -m spacy download en_core_web_sm

COPY . .

EXPOSE 8001
ENV PORT=8001
ENV PYTHONUNBUFFERED=1
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
