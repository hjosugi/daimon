# Daimon — one-command local setup & dev (run from repo root).
#
#   make setup   Infra (Postgres + Qdrant) + backend deps + DB migration + frontend deps
#   make dev     Run backend (:8000) and frontend (:5173) together
#   make down    Stop infra
#   make clean   Stop infra and remove .venv / node_modules
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

.PHONY: setup infra wait-db backend frontend ensure-pnpm dev down clean

setup: infra wait-db backend frontend
	@echo ""
	@echo "✅ Setup complete. Next: 'make dev'  (backend :8000 + frontend :5173)"

infra:
	@echo "Using compose provider: $(COMPOSE)"
	$(COMPOSE) up -d

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
	cd backend && ./.venv/bin/alembic upgrade head

frontend: ensure-pnpm
	cd frontend && $(PNPM) install

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

down:
	$(COMPOSE) down

clean: down
	rm -rf backend/.venv frontend/node_modules
