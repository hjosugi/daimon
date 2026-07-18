<!-- i18n: language-switcher -->
[English](README.md) | [日本語](README.ja.md)

# Daimon

Daimon は、投稿テキストの意味ベクトルと POV（視点）タグを使って、価値観の近さや「遠いけれど共通点がある」投稿を見つける SNS プロトタイプです。

単なるキーワード検索ではなく、以下を組み合わせます。

- 投稿本文を Sentence Transformers で 384 次元ベクトルに変換
- Qdrant で近傍検索し候補投稿を取得
- PostgreSQL を基盤として本文、ユーザー、POV、いいね、コメントを保持
- Sense-Distance ランキングで、近い投稿だけでなく bridge 投稿も混ぜる

## まず知ること

スタックは **Go 中心**で、Python は ML が本当に必要な部分（`ml-service/`: embedding + spaCy POV 抽出）だけに絞っています。API・シード・スキーマ管理はすべて Go です。

`compose.yml` が PostgreSQL / Qdrant / Redis / ML(`:8001`) / Go API(`:8000`) を起動します。
スキーマは Go API が起動時に冪等にブートストラップ（`CREATE TABLE IF NOT EXISTS`）するため、
別途のマイグレーション手順はありません。テストデータは Go のシーダ（`api/cmd/seed`）で投入します。

## ディレクトリ

| パス | 役割 |
| --- | --- |
| `frontend/` | React + Vite + TypeScript の UI |
| `api/` | Go の HTTP API（認証・投稿・検索・タイムライン・ランキング）＋ `cmd/seed`・`cmd/batch` |
| `ml-service/` | **唯一の Python**。embedding と POV 抽出だけを担当 |
| `docs/` | 共有ドキュメント。`*.local.md` は gitignore される詳細メモ用 |
| `compose.yml` | PostgreSQL / Qdrant / Redis / ML / Go API のローカル構成 |

## アーキテクチャ概要

```
フロントエンド (:5173)
    |
    | REST
    v
Go API (:8000)
    |                 |
    | SQL             | HTTP
    v                 v
PostgreSQL        MLサービス (:8001)
正本DB              embedding / POV抽出
    |
    | 投稿ID、メタデータ
    v
Qdrant (:6333)
ベクトル検索インデックス
```

重要な考え方はこれです。

- PostgreSQL: システム・オブ・レコード。消えてはいけないデータ、関係、集計の正本
- Qdrant: 検索システム。再構築可能な検索インデックス
- MLサービス: Go API から分離した CPU 推論プロセス
- Redis: 任意のリードモデルキャッシュ。未設定なら何もしない（no-op）

投稿作成時は、本文と POV を PostgreSQL に保存し、embedding が取得できた場合だけ Qdrant に upsert します。Qdrant への書き込みはベストエフォートで、壊れても PostgreSQL から再生成できる前提です。

## Quick Start

迷ったらこれ。

```bash
make fresh
```

これはローカルの Docker/Podman ボリュームを削除し、DB / Qdrant / Redis / ML / Go API をビルドして、シードデータを投入し、フロントエンドを起動します。

毎回データを消したくない場合は:

```bash
make docker
make web
```

開く URL:

- フロントエンド: http://localhost:5173
- API ライフサイクル確認: http://localhost:8000/livez
- API 健康状態（PostgreSQL チェック）: http://localhost:8000/health または `/readyz`
- Qdrant ダッシュボード: http://localhost:6333/dashboard

シード済みユーザーは `seeduser1@example.com` / `password123` のような `@example.com` アカウントです。

## ホスト開発

Go API（:8000）とフロントエンド（:5173）をホストで動かす場合（依存は compose）:

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

## ML とベクトルの流れ

投稿作成:

1. UI が `POST /posts` を呼ぶ
2. API が本文と POV をバリデーション
3. API が ML service の `POST /embed` に本文を渡す
4. ML service が `paraphrase-multilingual-MiniLM-L12-v2`（多言語）で 384 次元ベクトルを返す
5. API が PostgreSQL に投稿と POV を保存
6. API が Qdrant の `posts` コレクションに `{post_id, user_id, tags, created_at}` とベクトルをアップサート

タイムライン:

1. UI が `POST /posts/timeline` を呼ぶ
2. API がクエリテキストを embedding
3. Qdrant から類似候補を 100-200 件取得
4. PostgreSQL から本文、POV、いいね・コメント数を一括ロード
5. ユーザー自身の投稿ベクトルからセントロイドを作成
6. `rank_by_sense_distance` / `RankBySenseDistance` で並べ替え
7. UI に `match_reason.reason`, `sense_distance`, `is_bridge` を返す

ランキングの中心式:

```text
near   = cos(user_centroid, post_vector)
far    = 1 - near
bridge = far * has_common_pov
base   = alpha * near + (1 - alpha) * bridge + 0.15 * has_common_pov
```

最後に MMR（最大マージナルリレバンス）で似すぎた候補を間引きます。

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

`*.local.md` は `.gitignore` 済みです。実装の詳細な読み解き、試行錯誤、環境固有のメモはここに置けます。

## よく使うコマンド

```bash
make fresh        # まっさらから Docker/Podman stack + seed + frontend
make docker       # Docker/Podman stack 起動
make web          # frontend のみ起動
make docker-logs  # API / ML のログ確認
make seed         # 実用的なシードデータ投入
make seed-large   # 合成ベクトルを用いた高負荷シード
make down         # compose の停止
make clean        # venv / node_modules も削除
```

## CI/CD

CI は GitHub Actions の `.github/workflows/ci.yml` で管理します。

- `api`: `go test ./...`、`go vet ./...`、`cmd/server` / `cmd/batch` のビルド
- `frontend`: `pnpm install --frozen-lockfile`、Biome チェック、Vite 本番ビルド
- `ml-service`: `uv sync --locked`、`ruff check`、pytest、FastAPI アプリのインポートスモークテスト
- `deploy-config`: `compose.yml` / `cloudbuild.yaml` / Vercel SPA リライトの検証と API / ML Docker イメージビルド
- `production-smoke`: 本番フロントエンド、SPA のディープリンク、DBの準備状況、Go API のルート契約の定期確認

依存関係の更新は `.github/dependabot.yml` がフロントエンド（npm）、API（gomod）、ML（uv）、GitHub Actions、Dockerを管理します。

本番デプロイは `cloudbuild.yaml` から Cloud Run に出します。

- フロントエンド: Vercel (`vercel.json`)
- API: Cloud Run サービス `daimon-api`
- ML: Cloud Run サービス `daimon-ml`

Cloud Build トリガーには少なくとも `_QDRANT_URL` を設定してください。API のデプロイは Secret Manager の `database-url` と `qdrant-api-key` を参照します。MLサービスは API からのみ呼び出す想定で、Cloud Run の ingress は `internal` に設定しています。

現時点では Bazel は導入していません。Go / pnpm / uv / Docker の境界が明確で、Bazel を導入するよりも GitHub Actions のジョブ分割と Cloud Build のイメージビルドに寄せた方が運用は楽です。モノレポが大きくなり、生成物や多言語キャッシュを一元化したくなった段階で再検討します。

## ライセンス

0BSD. このプロジェクトはほぼすべての目的で使用、コピー、修正、配布可能です。