# Daimon Runbook

この runbook は現在の構成に合わせた運用手順です。API、schema bootstrap、seed、batch は Go で動き、Python は `ml-service/` の embedding / POV 抽出だけに使います。Python backend、`backend/cloudbuild.yaml`、Alembic migration はありません。

## Local Startup

完全に作り直す場合:

```bash
make fresh
```

既存データを残して container stack を起動する場合:

```bash
make docker
make web
```

Go API を host で動かす場合:

```bash
make deps-up
cd api
DATABASE_URL=postgresql://daimon:daimon@localhost:5432/daimon \
QDRANT_URL=http://localhost:6333 \
EMBED_URL=http://localhost:8001 \
REDIS_URL=redis://localhost:6379 \
go run ./cmd/server
```

Schema は Go API 起動時に `api/internal/db/schema.sql` から冪等に bootstrap されます。手動 migration コマンドは不要です。

## Local Checks

主要な health check:

```bash
curl -sf http://localhost:8000/health
curl -sf http://localhost:8001/health
curl -sf http://localhost:6333/healthz
```

Seed data を投入する場合:

```bash
make seed
```

High-volume seed を synthetic vector で投入する場合:

```bash
make seed-large ARGS="--posts 100000"
```

Logs:

```bash
make docker-logs
```

Stack を止める場合:

```bash
make down
```

Volume ごと消す場合:

```bash
docker compose -f compose.yml down -v --remove-orphans
```

## CI Gates

GitHub Actions の `.github/workflows/ci.yml` は以下を検証します。

- API: `go test ./...`, `go vet ./...`, server / batch build
- Frontend: `pnpm install --frozen-lockfile`, Biome lint, Vite build
- ML service: `uv sync --locked`, `uv run ruff check .`, `uv run pytest`, FastAPI import smoke test
- Deploy config: `docker compose -f compose.yml config`, `cloudbuild.yaml` shape check, API / ML Docker image build

ローカルで同じ系統の確認をする場合:

```bash
(cd api && go test ./... && go vet ./...)
(cd frontend && pnpm install --frozen-lockfile && pnpm run lint && pnpm run build)
(cd ml-service && uv sync --locked --no-install-project && uv run ruff check . && uv run pytest)
docker compose -f compose.yml config >/dev/null
docker build --pull -t daimon-api-ci ./api
docker build --pull -t daimon-ml-ci ./ml-service
```

## Cloud Deploy

本番 deploy は root の `cloudbuild.yaml` から Cloud Run へ出します。

必要な Cloud Build substitutions:

- `_QDRANT_URL`: Qdrant Cloud URL
- `_CORS_ORIGINS`: Browser caller origins

必要な Secret Manager secrets:

- `database-url`: API が使う Postgres connection string
- `qdrant-api-key`: API が使う Qdrant Cloud API key

手動実行例:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_QDRANT_URL=https://example.qdrant.io:6333,_CORS_ORIGINS=https://daimon-sandy.vercel.app
```

Cloud Build は `daimon-api` / `daimon-ml` を `$SHORT_SHA` と `latest` の両方で push します。次回 build は `latest` を pull し、`--cache-from` で Docker layer cache を再利用します。

2026-07-05 の local Podman/Docker 互換 build では、`daimon-ml` の model-bake layer は warm build で cache hit し、`docker build --cache-from daimon-ml-ci -t daimon-ml-ci-warm ./ml-service` は 27.35 秒で完了しました。同じ context での image size は、旧 single-stage baseline が 4.35 GB、新 multi-stage runtime image が 2.42 GB でした。

Deploy 後の確認:

```bash
gcloud run services describe daimon-ml --region=asia-northeast1 --format='value(status.url)'
gcloud run services describe daimon-api --region=asia-northeast1 --format='value(status.url)'
curl -sf "$(gcloud run services describe daimon-api --region=asia-northeast1 --format='value(status.url)')/health"
```

`daimon-ml` は internal ingress のため、外部端末から直接 health check できない構成です。API の `EMBED_URL` は Cloud Build が ML service URL を取得して deploy 時に設定します。

## Incident Triage

API が起動しない場合:

```bash
gcloud run services logs read daimon-api --region=asia-northeast1 --limit=200
```

ML service が起動しない、または embedding が失敗する場合:

```bash
gcloud run services logs read daimon-ml --region=asia-northeast1 --limit=200
```

Local stack の API が待機したままの場合は、`compose.yml` の healthcheck 対象を順に確認します。

```bash
docker compose -f compose.yml ps
curl -sf http://localhost:8001/health
curl -sf http://localhost:6333/healthz
```

Qdrant index は PostgreSQL の投稿データから再構築できる検索 index です。PostgreSQL が正本で、Qdrant write は best-effort です。

Session tokens are stored as SHA-256 hashes in `sessions.id`. The rollout from
plaintext tokens intentionally invalidates existing sessions; users can log in
again. Expired sessions are removed by the scheduled `cmd/batch` job through
`auth.delete_expired_sessions`.

## Rollback

Cloud Run revision を戻す場合:

```bash
gcloud run revisions list --service=daimon-api --region=asia-northeast1
gcloud run services update-traffic daimon-api --region=asia-northeast1 --to-revisions=REVISION_NAME=100
```

ML service も同じ手順で `daimon-ml` の revision traffic を戻します。
