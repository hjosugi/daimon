# Daimon

Daimon is a "Sense Distance" SNS prototype that connects users based on value similarity using Vector Search.

## Architecture

- **Frontend**: React (Vite) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Sentence Transformers (Python)
- **Database**: Qdrant (Vector), PostgreSQL (Relational)
- **Infra**: Docker Compose

## Prerequisites

- Docker & Docker Compose
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)
- Python 3.10+
- `uv` (Python package manager)

## Quick Start

### 1. Start Infrastructure (Background)
```bash
docker compose up -d
```
*Check logs: `docker compose logs -f`*

#### No Qdrant server? (embedded / local mode)

`qdrant-client` ships a built-in **local mode** (pure Python, no server), so you
can run vector search without the Qdrant container — handy for constrained
environments, CI, or quick demos. Set one env var:

```bash
# On-disk (persists across restarts):
QDRANT_PATH=qdrant_local   ./.venv/bin/uvicorn app.main:app --reload --port 8000
# In-memory (ephemeral, e.g. for tests):
QDRANT_LOCAL=1             ./.venv/bin/uvicorn app.main:app --reload --port 8000
```

Or via make (starts Postgres only — no Qdrant container needed):

```bash
make infra-db                              # Postgres only
make seed QDRANT_PATH=qdrant_local         # seed into the local store, then...
make dev  QDRANT_PATH=qdrant_local         # ...run the app against it
```

Notes:
- Local mode is brute-force (no Rust HNSW) — great up to ~100k vectors, not millions.
- The on-disk store is single-process: seed first (let it exit), then run `dev`
  (don't open the same `QDRANT_PATH` from two processes at once).
- Production / large scale still uses a real Qdrant server (`QDRANT_URL`).

### 2. Backend Setup

**For bash/zsh:**
```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
python -m spacy download ja_core_news_sm
python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

**For fish shell:**
```fish
cd backend
uv venv .venv
source .venv/bin/activate.fish
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
python -m spacy download ja_core_news_sm
python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

**Alternative (using uv run directly):**
```bash
cd backend
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
uv run python -m spacy download ja_core_news_sm
uv run python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Database Migration

Database schema is managed using Alembic.

**Initial Setup (when database is empty):**
```bash
cd backend
alembic upgrade head
```

**Creating migrations after model changes:**
```bash
cd backend
# After modifying models, create migration with auto-detection
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head
```

**Checking migration status:**
```bash
# Check current migration state
alembic current

# View migration history
alembic history

# View details of a specific revision
alembic show <revision>
```

**Rolling back migrations:**
```bash
# Rollback to previous migration
alembic downgrade -1

# Rollback all migrations
alembic downgrade base
```

**Resetting database (delete all data):**
```bash
cd backend
# TRUNCATE all tables
docker compose exec -T db psql -U daimon -d daimon << 'SQL'
TRUNCATE TABLE pov_likes CASCADE;
TRUNCATE TABLE povs CASCADE;
TRUNCATE TABLE comments CASCADE;
TRUNCATE TABLE likes CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE posts CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE alembic_version CASCADE;
SQL

# Reapply migrations
alembic stamp base
alembic upgrade head
```

See `backend/alembic/README.md` for details.

### 3.5 Seed Test Data (optional)

Populate the database + Qdrant with realistic test data so the timeline and
Sense-Distance ranking have something to work with. All seeded accounts use
`@example.com` emails and the password `password123`.

```bash
# From repo root (infra must be up; `make seed` brings it up + migrates first):
make seed                       # ~300 users + 12,000 posts (real embeddings)
make seed ARGS="--posts 50000"  # bigger
make seed ARGS="--fresh"        # wipe existing test data first

# High-volume SCALE testing (synthetic vectors, skips the embedding model):
make seed-large                 # 1,000,000 posts with --fake-vectors
```

Or run the script directly for full control:

```bash
cd backend
./.venv/bin/python seed.py --posts 12000 --users 300        # real embeddings
./.venv/bin/python seed.py --posts 1000000 --fake-vectors   # synthetic, fast
./.venv/bin/python seed.py --fresh --no-likes --no-comments
```

**How many is realistic?** Real embeddings are encoded by `all-MiniLM-L6-v2`
at roughly **300–400 texts/sec on an 8-core CPU**, so:

| Posts | Real embeddings (CPU) | Notes |
|------:|----------------------|-------|
| 10k   | ~30 sec              | great for UX / ranking demo |
| 100k  | ~5 min               | comfortable |
| 1M    | ~45–60 min           | practical local ceiling (CPU) |
| 10M+  | hours → use a GPU    | or `--fake-vectors` |
| 100M  | not local            | needs GPU fleet + sharded/managed Qdrant |

For anything past ~1M, use `--fake-vectors` (synthetic clustered vectors, no
model) to stress the Qdrant search path, or move encoding to a GPU.

Login with any seeded account, e.g. `seeduser1@example.com` / `password123`.

### 4. Frontend Setup
```bash
cd frontend
pnpm install
pnpm dev
```

## Monitoring & Logging

- **Application Logs**: FastAPI output appears in the terminal running `uvicorn`. 
  - Level: INFO by default.
  - Structure: `[Date] [Level] [Path] Message`
- **Qdrant Dashboard**: http://localhost:6333/dashboard
  - Monitor collection usage and run search queries visually.
- **Docker Containers**:
  - `docker stats` for resource usage.
  - `docker ps` to verify running services.

## CI/CD

### Continuous Integration (CI)
GitHub Actions workflows are located in `.github/workflows/`:
- **`ci.yml`**: Main CI pipeline
  - Backend: Linting (Ruff), Type checking (mypy), Tests (pytest)
  - Frontend: Linting (Biome), Type checking (TypeScript), Build verification
  - Security: Trivy vulnerability scanning
  - Docker: Compose validation and build testing
- **`dependabot.yml`**: Auto-merge for dependency updates

### Continuous Deployment (CD)
- **`deploy.yml`**: Full deployment pipeline
  - Deploys both backend (Cloud Run) and frontend (Vercel)
  - Automatically runs on push to `main` branch
  - Only runs when `backend/` or `frontend/` directories change
  - Allows individual selection of backend/frontend during manual execution
  - Uses Cloud Build to deploy to Cloud Run
- **`cd.yml`**: Docker Compose testing pipeline
  - Builds and tests Docker Compose
  - Creates GitHub releases on version tags

### Dependabot
Automated dependency updates configured in `.github/dependabot.yml`:
- Weekly updates for npm, pip, GitHub Actions, and Docker
- Auto-merge enabled for security updates

## Development URLs

- Frontend: http://localhost:5173
- Backend Docs: http://localhost:8000/docs
