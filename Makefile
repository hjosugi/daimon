# Daimon — one-command local setup & dev (run from repo root).
#
#   make fresh   ★★ FROM ZERO (Docker): wipe data → build → seed → run UI
#   make docker  Containerized stack: db + qdrant + redis + ml + Go API via compose
#   make seed    Load test data via the Go seeder (make seed ARGS="--posts 50000")
#   make web     Frontend dev server only (use alongside make docker)
#   make dev     Run the Go API (:8000) + frontend (:5173) on the host
#   make batch   Run the precompute batch (timeline/suggest) into Redis
#   make down / make clean   Stop infra / also remove node_modules
#
# The ONLY Python in the stack is the ML microservice (ml-service/: embeddings +
# spaCy POV extraction). Everything else — API, seeding, schema — is Go. The
# schema is bootstrapped by the Go API on boot (and by the seeder), so there is
# no separate migration step.

SHELL := /bin/bash
PNPM_VERSION := 9.15.0
POSTS ?= 12000

# Auto-detect a Compose provider (works for Docker and Podman/CachyOS setups).
COMPOSE := $(shell \
  if docker compose version >/dev/null 2>&1; then echo "docker compose"; \
  elif command -v podman-compose >/dev/null 2>&1; then echo "podman-compose"; \
  elif podman compose version >/dev/null 2>&1; then echo "podman compose"; \
  elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; \
  else echo "docker compose"; fi)

# Resolve pnpm even when its mise shim isn't on the (non-interactive) PATH yet.
PNPM := $(shell command -v pnpm >/dev/null 2>&1 && echo pnpm || echo "mise exec -- pnpm")

# Resolve uv for the Python ML microservice.
UV := $(shell command -v uv >/dev/null 2>&1 && echo uv || echo "mise exec -- uv")

# Env for host-run Go commands: point them at the compose-published ports.
LOCAL_DB  := DATABASE_URL=postgresql://daimon:daimon@localhost:5432/daimon
LOCAL_SVC := QDRANT_URL=http://localhost:6333 EMBED_URL=http://localhost:8001 REDIS_URL=redis://localhost:6379

.PHONY: all fresh setup infra infra-db deps-up batch wait-db wait-ml frontend frontend-ensure ensure-pnpm ml-setup ml-dev seed seed-large dev docker docker-logs docker-down web down clean

# All-in-one (host API): bring up deps, run the Go API + frontend on the host.
all: dev

setup: infra wait-db frontend
	@echo ""
	@echo "✅ Setup complete. Next: 'make dev'  (or 'make docker' + 'make web')"

ml-setup:
	cd ml-service && $(UV) sync --locked

ml-dev:
	cd ml-service && $(UV) run uvicorn app:app --host 0.0.0.0 --port 8001 --reload

infra:
	@echo "Using compose provider: $(COMPOSE)"
	$(COMPOSE) up -d

# Start ONLY Postgres.
infra-db:
	@echo "Using compose provider: $(COMPOSE)"
	$(COMPOSE) up -d db

# Start only the dependencies (db + qdrant + redis + ml) — for running the Go
# API on the host (so :8000 stays free for go run / a debugger).
deps-up:
	$(COMPOSE) up -d db qdrant redis ml

# Run the precompute batch (timeline feeds + popular/related POVs) into Redis.
batch:
	cd api && $(LOCAL_DB) $(LOCAL_SVC) go run ./cmd/batch

# Portable readiness checks: wait for the published TCP ports (no compose exec,
# which differs between Docker and Podman).
wait-db:
	@echo "⏳ Waiting for Postgres on 127.0.0.1:5432 ..."
	@until (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; do sleep 1; done
	@echo "✅ Postgres ready."

# The ML service only answers /health once its model is warm (loaded in the
# FastAPI lifespan), so this also guarantees embeddings are ready.
wait-ml:
	@echo "⏳ Waiting for ML service on :8001 (model warm-up) ..."
	@until curl -sf http://localhost:8001/health >/dev/null 2>&1; do sleep 2; done
	@echo "✅ ML ready."

frontend: ensure-pnpm
	cd frontend && $(PNPM) install

frontend-ensure: ensure-pnpm
	@test -d frontend/node_modules || (cd frontend && $(PNPM) install)

# Seed realistic test data: users (@example.com / password123) + ~12k posts with
# real embeddings (via the ML service) + POVs + likes/comments. Override e.g.:
#   make seed ARGS="--posts 50000"
#   make seed ARGS="--fresh"
seed: infra wait-db wait-ml
	cd api && $(LOCAL_DB) $(LOCAL_SVC) go run ./cmd/seed $(ARGS)

# Scale seed with SYNTHETIC vectors (no ML service) — for load/latency testing
# at high volume. Default 1,000,000 posts; override with ARGS.
seed-large: infra wait-db
	cd api && $(LOCAL_DB) $(LOCAL_SVC) go run ./cmd/seed --posts 1000000 --fake-vectors --no-comments $(ARGS)

# Provide pnpm at the pinned version. Prefer mise (this repo's toolchain),
# then corepack, then a global npm install as a last resort.
ensure-pnpm:
	@command -v pnpm >/dev/null 2>&1 && exit 0; \
	  echo "pnpm not found — provisioning..."; \
	  if command -v mise >/dev/null 2>&1; then mise use -g pnpm@$(PNPM_VERSION); \
	  elif command -v corepack >/dev/null 2>&1; then corepack enable && corepack prepare pnpm@$(PNPM_VERSION) --activate; \
	  else npm install -g pnpm@$(PNPM_VERSION); fi

# Run the Go API (:8000) + frontend (:5173) on the host (deps via compose).
dev: deps-up wait-db frontend-ensure
	@echo "Starting Go API (:8000) + frontend (:5173). Ctrl-C stops both."
	@trap 'kill 0' INT TERM; \
	  ( cd api && $(LOCAL_DB) $(LOCAL_SVC) PORT=8000 go run ./cmd/server ) & \
	  ( cd frontend && $(PNPM) dev ) & \
	  wait

# ★ Everything from zero (Docker). Wipes ALL local data (Postgres + Qdrant
# volumes), rebuilds images, seeds test data, then runs the UI.
# Override seeded count: `make fresh POSTS=50000`.
fresh:
	@echo "⚠️  Wiping containers + volumes (all local Postgres + Qdrant data)..."
	-$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d --build
	@echo "⏳ Waiting for Go API (build + schema bootstrap; ML image bakes models)..."
	@until curl -sf http://localhost:8000/health >/dev/null 2>&1; do sleep 3; done
	@$(MAKE) wait-ml
	@echo "🌱 Seeding $(POSTS) posts (users @example.com / password123)..."
	cd api && $(LOCAL_DB) $(LOCAL_SVC) go run ./cmd/seed --posts $(POSTS)
	@echo "🎨 Starting frontend (:5173). Ctrl-C stops the UI; api keeps running in Docker."
	@$(MAKE) web

# Fully containerized stack: db + qdrant + redis + ml + Go API in Docker/Podman.
# (Frontend stays on the host — run `make web` in another terminal.)
docker:
	$(COMPOSE) up -d --build
	@echo "✅ db + qdrant + redis + ml + Go API (:8000) are up. Logs: 'make docker-logs'."
	@echo "   Start the UI with: make web   (frontend :5173)"

docker-logs:
	$(COMPOSE) logs -f api ml

docker-down:
	$(COMPOSE) down

# Frontend dev server only (use alongside `make docker`).
web: frontend-ensure
	cd frontend && $(PNPM) dev

down:
	$(COMPOSE) down

clean: down
	rm -rf frontend/node_modules
