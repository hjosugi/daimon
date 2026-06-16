# Codex Context: Daimon API Workspace

このworkspaceは `daimon/api` 単独で開かれる想定です。Daimon全体では、ここが現行の主APIです。

## Project Overview

Daimon は、投稿本文の意味ベクトルと POV(Point of View / 観点)を組み合わせて、近い投稿だけでなく「遠いが共通の観点を持つ投稿」を出すSNSプロトタイプです。

全体構成:

```text
frontend/      React UI (:5173)
api/           Go API (:8000)  ← this workspace
ml-service/    Python ML service (:8001)
PostgreSQL     system of record
Qdrant         vector search index
Redis          optional read-model cache
```

Go API は、認証、投稿、検索、タイムライン、フォロー、保存、POVコメント、ランキングの本体です。Pythonは現行stackでは ML service に限定します。

## What This Workspace Owns

- HTTP routing and handlers: `internal/server/`
- PostgreSQL schema bootstrap: `internal/db/schema.sql`
- named SQL queries: `internal/db/queries/server.sql`
- SQL loader: `internal/db/queries.go`
- Qdrant REST client: `internal/qdrant/`
- ML service client: `internal/embed/`
- Sense-Distance ranking: `internal/ranking/`
- shared vector helpers: `internal/vec/`
- Redis cache wrapper: `internal/cache/`
- server entrypoint: `cmd/server/`
- batch precompute jobs: `cmd/batch/`

## Architecture Rules

- PostgreSQL is the system of record.
- Qdrant is a regenerable search index.
- Redis is optional cache only; correctness must not depend on Redis.
- ML service is accessed over HTTP via `EMBED_URL`; do not add Python logic here.
- Qdrant writes can be best-effort when PostgreSQL has already committed.
- Avoid N+1 queries. Load post metadata, POVs, counts, liked/saved flags in bulk.
- SQL should live in `internal/db/queries/*.sql`, referenced with `dbq.SQL("name")`.
- Do not inline significant SQL in handlers unless there is a strong reason.

## Important Data Model

Current tables:

- `users`
- `sessions`
- `posts`
- `povs`
- `likes`
- `comments`
- `pov_likes`
- `pov_comments`
- `follows`
- `bookmarks`

Current `povs` are still tag-like. The next product direction is `post_pov_assertions`, where a post/POV relation becomes a claim with lean/comment/spoiler/confidence/created_by.

## Ranking

`internal/ranking.RankBySenseDistance` combines:

```text
near   = similarity(user_centroid, post_vector)
far    = 1 - near
common = shares_pov(user, post)
bridge = far * common

score =
  alpha * near
  + (1 - alpha) * bridge
  + common_pov_bonus
  + optional popularity / recency
```

Saves/bookmarks are stronger preference signals than likes and are blended into the user's sense centroid.

## Runtime

From repo root, the usual dependency stack is:

```bash
make deps-up
```

From this workspace:

```bash
DATABASE_URL=postgresql://daimon:daimon@localhost:5432/daimon \
QDRANT_URL=http://localhost:6333 \
EMBED_URL=http://localhost:8001 \
REDIS_URL=redis://localhost:6379 \
go run ./cmd/server
```

API health:

```bash
curl http://localhost:8000/health
```

Batch job:

```bash
DATABASE_URL=postgresql://daimon:daimon@localhost:5432/daimon \
QDRANT_URL=http://localhost:6333 \
EMBED_URL=http://localhost:8001 \
REDIS_URL=redis://localhost:6379 \
go run ./cmd/batch
```

## Validation

Use:

```bash
go test ./...
```

If changing SQL names or query behavior, also run the db query tests:

```bash
go test ./internal/db ./internal/server ./internal/ranking ./internal/vec
```

## API Surface

Main routes are wired in `internal/server/server.go`.

- `/health`
- `/auth/register`
- `/auth/login`
- `/auth/me`
- `/auth/profile`
- `/posts`
- `/posts/timeline`
- `/posts/search`
- `/posts/povs/suggest`
- `/posts/povs/{pov}/comments`
- `/posts/{id}/save`
- `/posts/saved`
- `/users/{id}`
- `/users/{id}/follow`
- `/users/{id}/followers`
- `/users/{id}/follower`

## Product Direction To Preserve

Daimon is not a normal engagement-maximizing SNS.

Preserve these ideas:

- POV comments are not normal comments. They discuss "how this looks from this point of view."
- Ranking should not only show near/agreeable posts.
- Same-axis disagreement is valuable: different reaction, same POV.
- Do not expose complex scores as the main UX.
- Avoid user ranking, follower-count status games, and statistics dashboards as primary surfaces.

## Common Pitfalls

- The stack is Go-only except `ml-service/` (Python). Seeding is `api/cmd/seed`; schema is bootstrapped by the API (`EnsureSchema`). There is no Python `backend/` and no migration step.
- Do not change embedding dimension without planning Qdrant reindex/reseed.
- Do not rely on Redis being present.
- Do not add DB tables without keeping `schema.sql`, queries, seed/migration expectations, and frontend/API types aligned.
- Do not put frontend-only state or UI wording into the API unless it is part of the contract.
