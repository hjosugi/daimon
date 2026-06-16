# Codex Context: Daimon ML Service Workspace

このworkspaceは `daimon/ml-service` 単独で開かれる想定です。Daimon全体では、ここはPython ML microserviceです。

## Project Overview

Daimon は、投稿本文の意味ベクトルと POV(Point of View / 観点)を使って、近い投稿だけでなく「遠いが共通の観点を持つ投稿」を見つけるSNSプロトタイプです。

全体構成:

```text
frontend/      React UI (:5173)
api/           Go API (:8000)
ml-service/    Python ML service (:8001)  ← this workspace
backend/       legacy FastAPI + seed + Alembic
PostgreSQL     system of record
Qdrant         vector search index
Redis          optional cache
```

This service exposes only the ML tasks the Go API should not own:

- text embedding
- POV phrase extraction

Do not add product API, database writes, Qdrant writes, auth, or feed logic here.

## API Surface

Defined in `app.py`:

```text
GET  /health
POST /embed  {"text": "..."} -> {"vector": [...384 floats...]}
POST /povs   {"text": "..."} -> {"povs": [...]}
```

The Go API calls this service through `EMBED_URL`, usually `http://localhost:8001`.

## Embedding Model

Current model:

```text
paraphrase-multilingual-MiniLM-L12-v2
```

Important properties:

- multilingual, including Japanese
- 384 dimensions
- CPU-safe for local development
- Qdrant collection expects 384 dimensions

Changing this model may require:

- re-embedding every existing post
- rebuilding/reseeding Qdrant
- checking vector dimension in `api/internal/qdrant/qdrant.go`
- checking seed and batch jobs

Do not casually switch to a 768-dimensional model.

## Long Text Embedding

Long posts are chunked and mean-pooled:

```text
MAX_SEQ_LEN = 512
CHUNK_CHARS = 1200
MAX_CHUNKS = 48
```

This is intentional. Daimon allows long/deep posts, and embedding only the first tokens would make search quality bad.

## POV Extraction

`/povs` detects Japanese vs English and tries spaCy:

- `ja_core_news_sm`
- `en_core_web_sm`

If spaCy models are missing, it falls back to regex extraction.

Output should remain:

- unique
- short enough for POV UI
- max 5 suggestions
- each POV <= 300 chars

## Runtime

Install dependencies:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m spacy download ja_core_news_sm
python -m spacy download en_core_web_sm
```

Run service:

```bash
. .venv/bin/activate
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

Health check:

```bash
curl http://localhost:8001/health
```

Embedding smoke test:

```bash
curl -s http://localhost:8001/embed \
  -H 'Content-Type: application/json' \
  -d '{"text":"余韻のある作品だった"}'
```

POV smoke test:

```bash
curl -s http://localhost:8001/povs \
  -H 'Content-Type: application/json' \
  -d '{"text":"テンポは遅いが余韻が強い"}'
```

## Docker

The root `compose.yml` builds this service as `ml` and exposes port `8001`.

From repo root:

```bash
make deps-up
```

or:

```bash
docker compose up -d ml
```

## Performance Rules

- Keep model loading lazy or startup-warmed, not per request.
- Do not instantiate `SentenceTransformer` inside every handler call.
- Keep CPU as the default execution mode.
- Bound long-text chunk count.
- Keep response payload small.
- Avoid adding heavy dependencies unless they materially improve extraction or embedding quality.

## Common Pitfalls

- Do not change vector dimension without coordinating Qdrant and reseed.
- Do not add persistence here; PostgreSQL is owned by the Go API stack.
- Do not add frontend-facing product routes here.
- Do not make `/povs` authoritative; the user should still choose/edit POVs.
- Do not assume spaCy models are installed; fallback should remain safe.
