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
