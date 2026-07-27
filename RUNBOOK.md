# Daimon Runbook

この runbook は現在の構成に合わせた運用手順です。API、schema bootstrap、seed、batch は Go で動き、Python は `ml-service/` の embedding / POV 抽出だけに使います。Python backend、`backend/cloudbuild.yaml`、Alembic migration はありません。

## Local Startup

完全に作り直す場合:

```bash
task fresh
```

既存データを残して container stack を起動する場合:

```bash
task docker
task web
```

Go API を host で動かす場合:

```bash
make deps-up
cd api
DATABASE_URL=postgresql://daimon:daimon@localhost:5432/daimon \
EMBED_URL=http://localhost:8001 \
REDIS_URL=redis://localhost:6379 \
go run ./cmd/server
```

Schema は Go API 起動時に `api/internal/db/schema.sql` から冪等に bootstrap されます。手動 migration コマンドは不要です。

## Local Checks

主要な health check:

```bash
curl -sf http://localhost:8000/livez
curl -sf http://localhost:8000/readyz
curl -sf http://localhost:8001/health
```

`/livez` はAPIプロセスの生存確認だけを行います。`/health` と `/readyz` は
PostgreSQLへ `Ping` し、接続できなければ `503` を返します。

Seed data を投入する場合:

```bash
task seed
```

High-volume seed を synthetic vector で投入する場合:

```bash
task seed-large ARGS="--posts 100000"
```

Logs:

```bash
task docker-logs
```

Stack を止める場合:

```bash
task down
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

API handler integration tests run automatically in CI against a PostgreSQL
service. To run them locally, start a disposable database and set
`DAIMON_TEST_DATABASE_URL`:

```bash
docker run --rm --name daimon-test-postgres \
  -e POSTGRES_USER=daimon \
  -e POSTGRES_PASSWORD=daimon \
  -e POSTGRES_DB=daimon_test \
  -p 55432:5432 postgres:16

(cd api && DAIMON_TEST_DATABASE_URL=postgresql://daimon:daimon@localhost:55432/daimon_test?sslmode=disable go test ./internal/server)
```

## Cloud Deploy

本番 deploy は root の `cloudbuild.yaml` から Cloud Run へ出します。

必要な Cloud Build substitution:

- `_CORS_ORIGINS`: Browser caller origins

本番Go APIのURLは `https://daimon-api-629174432708.asia-northeast1.run.app` です。
旧FastAPI serviceの `https://daimon-629174432708.asia-northeast1.run.app` を
frontendの `VITE_API_BASE_URL` に設定しないでください。

必要な Secret Manager secrets:

- `database-url`: API が使う Postgres connection string

Supabase を使う場合、`database-url` には Cloud Run からIPv4で接続できる
Session pooler URLを保存します。実値やDBパスワードはリポジトリへcommitせず、
ローカルでは `.env.example` を `.env` にコピーし、productionではSecret
Managerだけを正本にします。

手動実行例:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_CORS_ORIGINS=https://daimon-sandy.vercel.app
```

Cloud Build は `daimon-api` / `daimon-ml` を `$SHORT_SHA` と `latest` の両方で push します。次回 build は `latest` を pull し、`--cache-from` で Docker layer cache を再利用します。

2026-07-05 の local Podman/Docker 互換 build では、`daimon-ml` の model-bake layer は warm build で cache hit し、`docker build --cache-from daimon-ml-ci -t daimon-ml-ci-warm ./ml-service` は 27.35 秒で完了しました。同じ context での image size は、旧 single-stage baseline が 4.35 GB、新 multi-stage runtime image が 2.42 GB でした。

Deploy 後の確認:

```bash
gcloud run services describe daimon-ml --region=asia-northeast1 --format='value(status.url)'
gcloud run services describe daimon-api --region=asia-northeast1 --format='value(status.url)'
curl -sf "$(gcloud run services describe daimon-api --region=asia-northeast1 --format='value(status.url)')/health"
```

Cloud Run はAPI、MLともに最小0・最大1、request-based billingで運用します。
アクセスがない間はゼロ台まで縮退し、急な負荷でも1台を超えないため、低コストを
優先した構成です。MLを使う最初のリクエストではcold startが発生します。

GitHub Actions の `Production smoke` は本番frontendのSPA deep link、API readiness、
現行Go APIのroute contractを6時間ごとに確認します。`/readyz` はPostgreSQLにも
接続するため、Supabase Free projectの低活動によるpauseを避けるための日次DB
activityも兼ねます。URLを変更する場合はrepository
variablesの `PRODUCTION_FRONTEND_URL` と `PRODUCTION_API_URL` を設定してください。

`daimon-ml` は匿名呼び出しを拒否し、API と worker の service account だけに
`roles/run.invoker` を付与します。API の `EMBED_URL` は Cloud Build が ML service
URL を取得して deploy 時に設定し、Google 署名 ID token を付けて呼び出します。

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
```

`post_vectors` は PostgreSQL 内の再構築可能な検索 index です。小規模運用では
exact cosine scan を使い、外部 vector database の固定費と障害点を増やしません。

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
