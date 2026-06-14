# Daimon — one-command local setup & dev (run from repo root).
#
#   make all     ★ All-in-one: infra + deps (if missing) + migrate + run. Idempotent.
#   make setup   Full (re)install: infra + backend deps (fresh venv) + frontend deps + migrate
#   make dev     Run backend (:8000) and frontend (:5173) together
#   make migrate Apply DB migrations (alembic upgrade head)
#   make down    Stop infra
#   make clean   Stop infra and remove .venv / node_modules
#
# Quick start on a fresh machine:  make all
#
# Backend is pinned to Python 3.12: sentence-transformers / psycopg2-binary
# have no wheels for 3.13+, so a newer interpreter would build from source.

SHELL := /bin/bash
PY_VERSION := 3.12
PNPM_VERSION := 9.15.0

# Auto-detect a Compose provider (works for Docker and Podman/CachyOS setups).
COMPOSE := $(shell \
  if docker compose version >/dev/null 2>&1; then echo "docker compose"; \
  elif command -v podman-compose >/dev/null 2>&1; then echo "podman-compose"; \
  elif podman compose version >/dev/null 2>&1; then echo "podman compose"; \
  elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; \
  else echo "docker compose"; fi)

# Resolve pnpm even when its mise shim isn't on the (non-interactive) PATH yet.
PNPM := $(shell command -v pnpm >/dev/null 2>&1 && echo pnpm || echo "mise exec -- pnpm")

# Run WITHOUT a Qdrant server: pass QDRANT_PATH (on-disk) or QDRANT_LOCAL=1
# (in-memory) to any target, e.g.  `make dev QDRANT_PATH=qdrant_local`.
# Exported so the backend/seed processes inherit it.
export QDRANT_PATH ?=
export QDRANT_LOCAL ?=

.PHONY: all setup infra infra-db wait-db backend backend-ensure frontend frontend-ensure ensure-pnpm migrate seed seed-large dev docker docker-logs docker-down web down clean

# All-in-one. Installs deps only if missing, so it's safe to run every day.
all: infra wait-db backend-ensure frontend-ensure migrate dev

setup: infra wait-db backend frontend migrate
	@echo ""
	@echo "✅ Setup complete. Next: 'make dev'  (or just 'make all')"

infra:
	@echo "Using compose provider: $(COMPOSE)"
	$(COMPOSE) up -d

# Start ONLY Postgres (for environments running Qdrant in local/embedded mode).
infra-db:
	@echo "Using compose provider: $(COMPOSE)"
	$(COMPOSE) up -d db

# Portable readiness check: wait for Postgres' published TCP port (no compose
# exec, which differs between Docker and Podman).
wait-db:
	@echo "⏳ Waiting for Postgres on 127.0.0.1:5432 ..."
	@until (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; do sleep 1; done
	@echo "✅ Postgres ready."

backend:
	cd backend && uv venv --clear --python $(PY_VERSION) .venv
	cd backend && uv pip install -r requirements.txt
	cd backend && ./.venv/bin/python -m spacy download ja_core_news_sm
	cd backend && ./.venv/bin/python -m spacy download en_core_web_sm

# Build the backend venv only if it doesn't exist yet (no wipe, fast re-runs).
backend-ensure:
	@test -x backend/.venv/bin/uvicorn || $(MAKE) backend

frontend: ensure-pnpm
	cd frontend && $(PNPM) install

# Install frontend deps only if node_modules is missing.
frontend-ensure: ensure-pnpm
	@test -d frontend/node_modules || (cd frontend && $(PNPM) install)

# Apply DB migrations (needs Postgres up).
migrate:
	cd backend && ./.venv/bin/alembic upgrade head

# Seed realistic test data: users (@example.com / password123) + ~12k posts
# with real embeddings + POVs + likes/comments. Override count e.g.:
#   make seed ARGS="--posts 50000"
#   make seed ARGS="--fresh"
seed: infra wait-db backend-ensure migrate
	cd backend && ./.venv/bin/python seed.py $(ARGS)

# Scale seed with SYNTHETIC vectors (no embedding model) — for load/latency
# testing at high volume. Default 1,000,000 posts; override with ARGS.
seed-large: infra wait-db backend-ensure migrate
	cd backend && ./.venv/bin/python seed.py --posts 1000000 --fake-vectors --no-comments $(ARGS)

# Provide pnpm at the pinned version. Prefer mise (this repo's toolchain),
# then corepack, then a global npm install as a last resort.
ensure-pnpm:
	@command -v pnpm >/dev/null 2>&1 && exit 0; \
	  echo "pnpm not found — provisioning..."; \
	  if command -v mise >/dev/null 2>&1; then mise use -g pnpm@$(PNPM_VERSION); \
	  elif command -v corepack >/dev/null 2>&1; then corepack enable && corepack prepare pnpm@$(PNPM_VERSION) --activate; \
	  else npm install -g pnpm@$(PNPM_VERSION); fi

dev:
	@echo "Starting backend (:8000) + frontend (:5173). Ctrl-C stops both."
	@trap 'kill 0' INT TERM; \
	  ( cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000 ) & \
	  ( cd frontend && $(PNPM) dev ) & \
	  wait

# Fully containerized backend: db + qdrant + backend all in Docker/Podman.
# (Frontend stays on the host — run `make web` in another terminal.)
docker:
	$(COMPOSE) up -d --build
	@echo "✅ db + qdrant + backend (:8000) are up. Logs: 'make docker-logs'."
	@echo "   Start the UI with: make web   (frontend :5173)"

docker-logs:
	$(COMPOSE) logs -f backend

docker-down:
	$(COMPOSE) down

# Frontend dev server only (use alongside `make docker`).
web: frontend-ensure
	cd frontend && $(PNPM) dev

down:
	$(COMPOSE) down

clean: down
	rm -rf backend/.venv frontend/node_modules
