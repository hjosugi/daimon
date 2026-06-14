# Daimon

Daimon は、投稿テキストの意味ベクトルと POV (Point of View) タグを使って、価値観の近さや「遠いけれど共通点がある」投稿を見つける SNS プロトタイプです。

単なるキーワード検索ではなく、以下を組み合わせます。

- 投稿本文を Sentence Transformers で 384 次元ベクトルにする
- Qdrant で近傍検索して候補投稿を取る
- PostgreSQL を正本として本文、ユーザー、POV、いいね、コメントを保持する
- Sense-Distance ランキングで、近い投稿だけでなく bridge 投稿も混ぜる

## まず知ること

このリポジトリには実行経路が 2 つあります。

| 経路 | 主な用途 | 構成 |
| --- | --- | --- |
| Docker / Go API | 推奨のアプリ実行経路 | `api/` + `ml-service/` + PostgreSQL + Qdrant + Redis |
| Python FastAPI | 旧実装・検証・seed/migration 周辺 | `backend/` + PostgreSQL + Qdrant |

現在の `compose.yml` は Go API を `:8000`、Python ML microservice を `:8001` で起動します。`backend/` はまだ seed、Alembic、FastAPI 版の参照実装として残っています。

## ディレクトリ

| Path | 役割 |
| --- | --- |
| `frontend/` | React + Vite + TypeScript の UI |
| `api/` | Go の HTTP API。認証、投稿、検索、タイムライン、ランキングの本体 |
| `ml-service/` | Python ML microservice。embedding と POV 抽出だけを担当 |
| `backend/` | Python FastAPI 版、Alembic migration、seed script |
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

これはローカルの Docker volume を消して、DB / Qdrant / Redis / ML / Go API を build し、seed data を入れて、frontend を起動します。

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

Python FastAPI 版で動かす場合:

```bash
make all
```

個別に進める場合:

```bash
make infra
make backend
make migrate
make seed
make dev
```

Go API をホストでデバッグしたい場合は、依存サービスだけを先に起動します。

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
4. ML service が `all-MiniLM-L6-v2` で 384 次元 vector を返す
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

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/CONTENT_MODERATION.md](docs/CONTENT_MODERATION.md)

ローカル詳細メモ:

- `docs/ARCHITECTURE.local.md`
- `docs/ML_VECTOR.local.md`

`*.local.md` は `.gitignore` 済みです。実装の細かい読み解き、試行錯誤、環境固有のメモはここに置けます。

## よく使うコマンド

```bash
make fresh        # まっさらから Docker stack + seed + frontend
make docker       # Docker stack 起動
make web          # frontend のみ起動
make docker-logs  # api / ml logs
make seed         # realistic seed data
make seed-large   # synthetic vectors で高負荷 seed
make down         # compose down
make clean        # venv / node_modules も削除
```

## Qdrant local mode

Python FastAPI 経路では、Qdrant server を使わず qdrant-client の local mode でも動かせます。

```bash
make infra-db
make seed QDRANT_PATH=qdrant_local
make dev QDRANT_PATH=qdrant_local
```

注意:

- local mode は brute-force なので大規模用途では使わない
- `QDRANT_PATH` は同時に複数プロセスから開かない
- 本番や大規模検証は Qdrant server / Qdrant Cloud を使う

## CI/CD

`.github/workflows/` に CI/CD の設定があります。主に backend / frontend の lint、typecheck、test、build、Docker 検証、deploy を想定しています。

