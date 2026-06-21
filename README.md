# Daimon

Daimon は、投稿テキストの意味ベクトルと POV (Point of View) タグを使って、価値観の近さや「遠いけれど共通点がある」投稿を見つける SNS プロトタイプです。

単なるキーワード検索ではなく、以下を組み合わせます。

- 投稿本文を Sentence Transformers で 384 次元ベクトルにする
- Qdrant で近傍検索して候補投稿を取る
- PostgreSQL を正本として本文、ユーザー、POV、いいね、コメントを保持する
- Sense-Distance ランキングで、近い投稿だけでなく bridge 投稿も混ぜる

## まず知ること

スタックは **Go 中心**で、Python は ML が本当に必要なところ（`ml-service/`: embedding +
spaCy POV 抽出）だけに絞っています。API・シード・スキーマ管理はすべて Go です。

`compose.yml` が PostgreSQL / Qdrant / Redis / ML(`:8001`) / Go API(`:8000`) を起動します。
スキーマは Go API が起動時に冪等にブートストラップ（`CREATE TABLE IF NOT EXISTS`）するので、
別途のマイグレーション手順はありません。テストデータは Go のシーダ（`api/cmd/seed`）で投入します。

## ディレクトリ

| Path | 役割 |
| --- | --- |
| `frontend/` | React + Vite + TypeScript の UI |
| `api/` | Go の HTTP API（認証・投稿・検索・タイムライン・ランキング）＋ `cmd/seed`・`cmd/batch` |
| `ml-service/` | **唯一の Python**。embedding と POV 抽出だけを担当 |
| `docs/` | 共有ドキュメント。`*.local.md` は gitignore される詳細メモ用 |
| `compose.yml` | PostgreSQL / Qdrant / Redis / ML / Go API のローカル構成 |

## アーキテクチャ概要

```
Frontend (:5173)
    |
    | REST
    v
Go API (:8000)
    |                 |
    | SQL             | HTTP
    v                 v
PostgreSQL        ML service (:8001)
正本DB              embedding / POV extraction
    |
    | post ids, metadata
    v
Qdrant (:6333)
vector search index
```

重要な考え方はこれです。

- PostgreSQL: System of Record。消えてはいけないデータ、関係、集計の正本
- Qdrant: System of Search。再構築できる検索インデックス
- ML service: Go API から分離した CPU 推論プロセス
- Redis: 任意の read-model cache。未設定なら no-op

投稿作成時は、本文と POV を PostgreSQL に保存し、embedding が取れた場合だけ Qdrant に upsert します。Qdrant 書き込みは best-effort で、壊れても PostgreSQL から再生成できる前提です。

## Quick Start

迷ったらこれです。

```bash
make fresh
```

これはローカルの Docker/Podman volume を消して、DB / Qdrant / Redis / ML / Go API を build し、seed data を入れて、frontend を起動します。

毎回データを消したくない場合:

```bash
make docker
make web
```

開く URL:

- Frontend: http://localhost:5173
- API health: http://localhost:8000/health
- Qdrant dashboard: http://localhost:6333/dashboard

seed 済みユーザーは `seeduser1@example.com` / `password123` のような `@example.com` アカウントです。

## Host 開発

Go API（:8000）と frontend（:5173）をホストで動かす場合（依存は compose）:

```bash
make all      # = make dev: deps-up → Go API + frontend
```

個別に進める場合:

```bash
make deps-up        # db + qdrant + redis + ml を compose で起動
make seed           # Go シーダでテストデータ投入（ML 必須・実埋め込み）
make dev            # Go API + frontend
```

Go API だけをホストでデバッグしたい場合:

```bash
make deps-up
cd api
go run ./cmd/server
```

別ターミナルで:

```bash
make web
```

## ML と Vector の流れ

投稿作成:

1. UI が `POST /posts` を呼ぶ
2. API が本文と POV を validation する
3. API が ML service の `POST /embed` に本文を渡す
4. ML service が `paraphrase-multilingual-MiniLM-L12-v2`（多言語）で 384 次元 vector を返す
5. API が PostgreSQL に投稿と POV を保存する
6. API が Qdrant `posts` collection に `{post_id, user_id, tags, created_at}` と vector を upsert する

タイムライン:

1. UI が `POST /posts/timeline` を呼ぶ
2. API が query text を embedding する
3. Qdrant から類似候補を 100-200 件取る
4. PostgreSQL から本文、POV、like/comment count を bulk load する
5. ユーザー自身の投稿 vector から centroid を作る
6. `rank_by_sense_distance` / `RankBySenseDistance` で並べ替える
7. UI に `match_reason.reason`, `sense_distance`, `is_bridge` を返す

ランキングの中心式:

```text
near   = cos(user_centroid, post_vector)
far    = 1 - near
bridge = far * has_common_pov
base   = alpha * near + (1 - alpha) * bridge + 0.15 * has_common_pov
```

最後に MMR (Maximal Marginal Relevance) で似すぎた候補を間引きます。

## 詳細ドキュメント

共有用:

- [docs/README.md](docs/README.md)
- [docs/PRODUCT_AND_UX.md](docs/PRODUCT_AND_UX.md)
- [docs/THEORY_TO_FEATURES.md](docs/THEORY_TO_FEATURES.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/CONTENT_MODERATION.md](docs/CONTENT_MODERATION.md)
- [docs/CONCEPT_AND_RESEARCH.txt](docs/CONCEPT_AND_RESEARCH.txt)
- [docs/DAIMON_PROJECT_DESCRIPTION.txt](docs/DAIMON_PROJECT_DESCRIPTION.txt)

ローカル詳細メモ:

- `docs/ARCHITECTURE.local.md`
- `docs/ML_VECTOR.local.md`

`*.local.md` は `.gitignore` 済みです。実装の細かい読み解き、試行錯誤、環境固有のメモはここに置けます。

## よく使うコマンド

```bash
make fresh        # まっさらから Docker/Podman stack + seed + frontend
make docker       # Docker/Podman stack 起動
make web          # frontend のみ起動
make docker-logs  # api / ml logs
make seed         # realistic seed data
make seed-large   # synthetic vectors で高負荷 seed
make down         # compose down
make clean        # venv / node_modules も削除
```

## CI/CD

CI は GitHub Actions の `.github/workflows/ci.yml` で管理します。

- `api`: `go test ./...` と `cmd/server` / `cmd/batch` の build
- `frontend`: `pnpm install --frozen-lockfile`、Biome check、Vite production build
- `ml-service`: `uv sync --locked` と FastAPI app の import smoke test
- `deploy-config`: `compose.yml` と `cloudbuild.yaml` の最低限の形を検証

依存更新は `.github/dependabot.yml` が frontend(npm) / api(gomod) / ml(uv) / GitHub Actions / Docker を管理します。

本番 deploy は `cloudbuild.yaml` から Cloud Run に出します。

- frontend: Vercel (`vercel.json`)
- API: Cloud Run service `daimon-api`
- ML: Cloud Run service `daimon-ml`

Cloud Build trigger には少なくとも `_QDRANT_URL` を設定してください。API deploy は Secret Manager の `database-url` と `qdrant-api-key` を参照します。ML service は API からだけ呼ぶ前提で、Cloud Run ingress は `internal` にしています。

現時点では Bazel は導入していません。Go / pnpm / uv / Docker の境界が明確で、Bazel を入れるより GitHub Actions の job 分割と Cloud Build の image build に寄せる方が運用が軽いです。モノレポが大きくなり、生成物や多言語キャッシュを統一したくなった段階で再検討します。
