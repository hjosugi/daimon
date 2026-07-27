<!-- i18n: language-switcher -->
[English](README.md) | [日本語](README.ja.md)

# Daimon

Daimon は、投稿テキストの意味ベクトルと POV（視点）タグを使って、価値観の近さや「遠いけれど共通点がある」投稿を見つける SNS プロトタイプです。

単なるキーワード検索ではなく、以下を組み合わせます。

- 投稿本文を Sentence Transformers で 384 次元ベクトルに変換
- PostgreSQL の `post_vectors` で cosine 近傍検索し候補投稿を取得
- PostgreSQL を基盤として本文、ユーザー、POV、いいね、コメント、検索 vector を保持
- Sense-Distance ランキングで、近い投稿だけでなく bridge 投稿も混ぜる

## まず知ること

スタックは **Go 中心**で、Python は ML が本当に必要な部分（`ml-service/`: embedding + spaCy POV 抽出）だけに絞っています。API・シード・スキーマ管理はすべて Go です。

`compose.yml` が PostgreSQL / Redis / ML(`:8001`) / Go API(`:8000`) を起動します。
スキーマは Go API が起動時に冪等にブートストラップ（`CREATE TABLE IF NOT EXISTS`）するため、
別途のマイグレーション手順はありません。テストデータは Go のシーダ（`api/cmd/seed`）で投入します。

## ディレクトリ

| パス | 役割 |
| --- | --- |
| `frontend/` | React + Vite + TypeScript の UI |
| `api/` | Go の HTTP API（認証・投稿・検索・タイムライン・ランキング）＋ `cmd/seed`・`cmd/batch` |
| `ml-service/` | **唯一の Python**。embedding と POV 抽出だけを担当 |
| `docs/` | 共有ドキュメント。`*.local.md` は gitignore される詳細メモ用 |
| `compose.yml` | PostgreSQL / Redis / ML / Go API のローカル構成 |
| `Taskfile.yml` | ローカル開発・テストデータ・コンテナ操作の正式な入口 |

## アーキテクチャ概要

```
フロントエンド (:5173)
    |
    | REST
    v
Go API (:8000)
    |                 |
    | SQL             | 認証付き HTTP
    v                 v
PostgreSQL        MLサービス (:8001)
正本 + vector index  embedding / POV抽出
```

重要な考え方はこれです。

- PostgreSQL: 正本と小規模向け semantic index。投稿と vector を同じ transaction で保持
- `post_vectors`: 384 次元 vector と検索 payload を持つ再構築可能な table
- MLサービス: Go API から分離した CPU 推論プロセス。Cloud Run IAM 認証が必須
- Redis: 任意のリードモデルキャッシュ。未設定なら何もしない（no-op）

投稿作成時は、本文、POV、embedding を PostgreSQL の同じ transaction に保存します。現在の小規模データでは exact cosine scan を使い、別の常時稼働 vector database を不要にしています。

## Quick Start

迷ったらこれ。

```bash
task fresh
```

開発コマンドは [Go Task](https://taskfile.dev/) で統一しています。Task CLI が未導入なら
公式の[インストール手順](https://taskfile.dev/docs/installation)に従って導入してください。
利用可能なコマンドは `task --list` で確認できます。

これはローカルの Docker/Podman ボリュームを削除し、DB / Redis / ML / Go API をビルドして、シードデータを投入し、フロントエンドを起動します。

毎回データを消したくない場合は:

```bash
task docker
task web
```

開く URL:

- フロントエンド: http://localhost:5173
- API ライフサイクル確認: http://localhost:8000/livez
- API 健康状態（PostgreSQL チェック）: http://localhost:8000/health または `/readyz`

シード済みユーザーは `seeduser1@example.com` / `password123` のような `@example.com` アカウントです。

## ホスト開発

Go API（:8000）とフロントエンド（:5173）をホストで動かす場合（依存は compose）:

```bash
task dev      # deps-up → Go API + frontend
```

個別に進める場合:

```bash
task deps-up        # db + redis + ml を compose で起動
task seed           # Go シーダでテストデータ投入（ML 必須・実埋め込み）
task dev            # Go API + frontend
```

Go API だけをホストでデバッグしたい場合:

```bash
task deps-up
cd api
go run ./cmd/server
```

別ターミナルで:

```bash
task web
```

## ML とベクトルの流れ

投稿作成:

1. UI が `POST /posts` を呼ぶ
2. API が本文と POV をバリデーション
3. API が ML service の `POST /embed` に本文を渡す
4. ML service が `paraphrase-multilingual-MiniLM-L12-v2`（多言語）で 384 次元ベクトルを返す
5. API が PostgreSQL に投稿と POV を保存
6. API が PostgreSQL `post_vectors` に `{post_id, user_id, tags, created_at}` とベクトルを同じ transaction でアップサート

タイムライン:

1. UI が `POST /posts/timeline` を呼ぶ
2. 自分の投稿と保存投稿から個人用セントロイドを作成
3. 通常の個人フィードはセントロイドを再利用する。匿名・任意クエリのときだけクエリを embedding
4. PostgreSQL の vector index から cosine 類似候補を 100-200 件取得
5. PostgreSQL から本文、POV、いいね・コメント数を一括ロード
6. `rank_by_sense_distance` / `RankBySenseDistance` で並べ替え
7. UI に `match_reason.reason`, `sense_distance`, `is_bridge` を返す
8. UI は20件ずつ受け取り、末尾が近づいたときだけ次を読み込む

検索は本文の完全一致・部分一致、POV一致、意味ベクトル検索を重ね、関連順と新しい順を切り替えられます。

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
task fresh        # まっさらから Docker/Podman stack + seed + frontend
task docker       # Docker/Podman stack 起動
task web          # frontend のみ起動
task docker-logs  # API / ML のログ確認
task seed         # 実用的なシードデータ投入
task seed-large   # 合成ベクトルを用いた高負荷シード
task down         # compose の停止
task clean        # node_modules も削除
```

## CI/CD

CI は GitHub Actions の `.github/workflows/ci.yml` で管理します。

- `api`: `go test ./...`、`go vet ./...`、`cmd/server` / `cmd/batch` のビルド
- `frontend`: `pnpm install --frozen-lockfile`、Biome チェック、Vite 本番ビルド
- `ml-service`: `uv sync --locked`、`ruff check`、pytest、FastAPI アプリのインポートスモークテスト
- `deploy-config`: `Taskfile.yml` / `compose.yml` / `cloudbuild.yaml` / Vercel SPA リライトの検証と API / ML Docker イメージビルド
- `production-smoke`: 本番フロントエンド、SPA のディープリンク、DBの準備状況、Go API のルート契約の定期確認

依存関係の更新は `.github/dependabot.yml` がフロントエンド（npm）、API（gomod）、ML（uv）、GitHub Actions、Dockerを管理します。

本番デプロイは `cloudbuild.yaml` から Cloud Run に出します。

- フロントエンド: Vercel (`vercel.json`)
- API: Cloud Run サービス `daimon-api`
- ML: Cloud Run サービス `daimon-ml`

Cloud Build トリガーは `_CORS_ORIGINS` を設定します。API のデプロイは Secret Manager の `database-url` だけを参照します。MLサービスは ingress を許可しても匿名実行を拒否し、API と worker の service account だけに `roles/run.invoker` を与えます。

現時点では Bazel は導入していません。Go / pnpm / uv / Docker の境界が明確で、Bazel を導入するよりも GitHub Actions のジョブ分割と Cloud Build のイメージビルドに寄せた方が運用は楽です。モノレポが大きくなり、生成物や多言語キャッシュを一元化したくなった段階で再検討します。

## ライセンス

0BSD. このプロジェクトはほぼすべての目的で使用、コピー、修正、配布可能です。
