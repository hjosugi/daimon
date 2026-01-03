# Daimon

Daimon is a "Sense Distance" SNS prototype that connects users based on value similarity using Vector Search.

## Architecture

- **Frontend**: React (Vite) + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Sentence Transformers (Python)
- **Database**: Qdrant (Vector), PostgreSQL (Relational)
- **Infra**: Docker Compose

## Prerequisites

- Docker & Docker Compose
- Node.js (v18+)
- pnpm (`npm install -g pnpm`)
- Python 3.10+
- `uv` (Python package manager)

## Quick Start

### 1. Start Infrastructure (Background)
```bash
docker compose up -d
```
*Check logs: `docker compose logs -f`*

### 2. Backend Setup

**For bash/zsh:**
```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
python -m spacy download ja_core_news_sm
python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

**For fish shell:**
```fish
cd backend
uv venv .venv
source .venv/bin/activate.fish
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
python -m spacy download ja_core_news_sm
python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

**Alternative (using uv run directly):**
```bash
cd backend
uv pip install -r requirements.txt
# Install spaCy language models for POV generation
uv run python -m spacy download ja_core_news_sm
uv run python -m spacy download en_core_web_sm
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Database Migration

データベーススキーマの管理にはAlembicを使用します。

**初回セットアップ（データベースが空の場合）:**
```bash
cd backend
alembic upgrade head
```

**モデル変更後のマイグレーション作成:**
```bash
cd backend
# モデルを変更した後、自動検出でマイグレーションを作成
alembic revision --autogenerate -m "Description of changes"

# マイグレーションを適用
alembic upgrade head
```

**マイグレーションの確認:**
```bash
# 現在のマイグレーション状態を確認
alembic current

# マイグレーション履歴を確認
alembic history

# 特定のリビジョンの詳細を確認
alembic show <revision>
```

**マイグレーションのロールバック:**
```bash
# 1つ前のマイグレーションに戻す
alembic downgrade -1

# すべてのマイグレーションを元に戻す
alembic downgrade base
```

**データベースをリセット（全データ削除）:**
```bash
cd backend
# すべてのテーブルをTRUNCATE
docker compose exec -T db psql -U daimon -d daimon << 'SQL'
TRUNCATE TABLE pov_likes CASCADE;
TRUNCATE TABLE povs CASCADE;
TRUNCATE TABLE comments CASCADE;
TRUNCATE TABLE likes CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE posts CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE alembic_version CASCADE;
SQL

# マイグレーションを再適用
alembic stamp base
alembic upgrade head
```

詳細は `backend/alembic/README.md` を参照してください。

### 4. Frontend Setup
```bash
cd frontend
pnpm install
pnpm dev
```

## Monitoring & Logging

- **Application Logs**: FastAPI output appears in the terminal running `uvicorn`. 
  - Level: INFO by default.
  - Structure: `[Date] [Level] [Path] Message`
- **Qdrant Dashboard**: http://localhost:6333/dashboard
  - Monitor collection usage and run search queries visually.
- **Docker Containers**:
  - `docker stats` for resource usage.
  - `docker ps` to verify running services.

## CI/CD

### Continuous Integration (CI)
GitHub Actions workflows are located in `.github/workflows/`:
- **`ci.yml`**: Main CI pipeline
  - Backend: Linting (Ruff), Type checking (mypy), Tests (pytest)
  - Frontend: Linting (Biome), Type checking (TypeScript), Build verification
  - Security: Trivy vulnerability scanning
  - Docker: Compose validation and build testing
- **`dependabot.yml`**: Auto-merge for dependency updates

### Continuous Deployment (CD)
- **`deploy.yml`**: Cloud Buildを使用したバックエンドデプロイ
  - `main`ブランチへのプッシュ時に自動実行
  - Cloud BuildをトリガーしてCloud Runにデプロイ
  - `backend/` ディレクトリの変更時のみ実行
- **`deploy-full.yml`**: フルデプロイメントパイプライン
  - バックエンド（Cloud Run）とフロントエンド（Vercel）の両方をデプロイ
  - 手動実行時に選択可能
- **`cd.yml`**: Docker Composeテスト用パイプライン
  - Docker Composeのビルドとテスト
  - バージョンタグ時にGitHubリリースを作成

### Dependabot
Automated dependency updates configured in `.github/dependabot.yml`:
- Weekly updates for npm, pip, GitHub Actions, and Docker
- Auto-merge enabled for security updates

## Development URLs

- Frontend: http://localhost:5173
- Backend Docs: http://localhost:8000/docs
