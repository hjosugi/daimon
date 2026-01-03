# デプロイメントガイド

## A案: Qdrant Cloud + Supabase + Cloud Run

この構成は、GCPベースで運用しやすく、コスト効率が良いです。

### アーキテクチャ概要

```
Frontend (Vercel/Cloudflare Pages)
    ↓
Backend (Cloud Run)
    ↓
PostgreSQL (Supabase)
    ↓
Vector DB (Qdrant Cloud)
```

### 月額コスト見積もり（MVP/低トラフィック）

- **Qdrant Cloud**: 無料枠内 → **0円**
- **Supabase**: 無料枠内 → **0円**
- **Cloud Run**: 無料枠 + 少量実行 → **0〜数百円**
- **Frontend**: Vercel/Cloudflare Pages 無料枠 → **0円**

**合計: 0〜3000円程度**

---

## 1. Supabase セットアップ

### 1.1 プロジェクト作成

1. [Supabase](https://supabase.com/) にサインアップ
2. 新しいプロジェクトを作成
3. データベースパスワードを設定（後で使います）

### 1.2 接続情報の取得

1. Supabase Dashboard > Settings > Database
2. Connection string をコピー
   - 形式: `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres`
3. `.env` の `DATABASE_URL` に設定

### 1.3 データベースマイグレーション

```bash
cd backend

# .env ファイルに DATABASE_URL を設定（まだ設定していない場合）
# .env ファイルを編集して以下を追加:
# DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres

# マイグレーション実行（.env から自動的に DATABASE_URL を読み込みます）
uv run alembic upgrade head
```

**注意**: `alembic/env.py` が自動的に `.env` ファイルから環境変数を読み込みます。`.env` ファイルに `DATABASE_URL` が設定されていれば、`export` コマンドは不要です。

---

## 2. Qdrant Cloud セットアップ

### 2.1 クラスター作成

1. [Qdrant Cloud](https://cloud.qdrant.io/) にサインアップ
2. 新しいクラスターを作成（Free tier を選択）
3. クラスターIDとAPIキーを取得

### 2.2 接続情報の設定

`.env` に以下を設定:

```env
QDRANT_URL=https://[CLUSTER-ID].qdrant.io
QDRANT_API_KEY=[YOUR-API-KEY]
```

### 2.3 コレクション作成

アプリケーション起動時に自動的に作成されますが、手動で確認:

```python
from qdrant_client import QdrantClient

client = QdrantClient(
    url="https://[CLUSTER-ID].qdrant.io",
    api_key="[YOUR-API-KEY]"
)

# コレクション一覧を確認
collections = client.get_collections()
print(collections)
```

---

## 3. Cloud Run デプロイ

### 3.1 前提条件

- Google Cloud SDK (`gcloud`) がインストールされていること
- GCPプロジェクトが作成されていること
- Cloud Run API が有効化されていること
- Cloud Build API が有効化されていること
- Artifact Registry API が有効化されていること

### 3.2 Artifact Registry のセットアップ

```bash
# Artifact Registry リポジトリを作成（初回のみ）
gcloud artifacts repositories create daimon \
  --repository-format=docker \
  --location=[REGION] \
  --description="Daimon backend Docker images"

# Artifact Registry に接続（初回のみ）
gcloud auth configure-docker [REGION]-docker.pkg.dev
```

### 3.3 GitHub リポジトリから継続的にデプロイ（Cloud Build 推奨）

#### 3.3.1 Cloud Build Trigger の作成

1. [Cloud Console](https://console.cloud.google.com) にアクセス
2. **Cloud Build** > **Triggers** に移動
3. **Create Trigger** をクリック
4. 設定を入力:
   - **Name**: `daimon-backend-deploy`
   - **Event**: `Push to a branch`
   - **Source**: GitHub リポジトリを選択（初回は認証が必要）
   - **Repository**: リポジトリを選択
   - **Branch**: `^main$` (mainブランチへのプッシュ時に実行)
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `backend/cloudbuild.yaml`
5. **Substitution variables** を設定:
   - `_QDRANT_URL`: Qdrant Cloud のURL
   - `_CORS_ORIGINS`: フロントエンドのURL（カンマ区切り）
6. **Create** をクリック

#### 3.3.2 初回デプロイの実行

```bash
# Cloud Build Trigger を手動で実行
gcloud builds triggers run daimon-backend-deploy \
  --branch=main \
  --region=[REGION]
```

これ以降、`main`ブランチにプッシュするたびに自動的にデプロイされます。

#### 3.3.3 GitHub Actions を使用したデプロイ（代替方法）

Cloud Build Triggerの代わりに、GitHub Actionsを使用してCloud Buildをトリガーすることもできます。

**必要なシークレットの設定**:

1. GitHubリポジトリの **Settings** > **Secrets and variables** > **Actions** に移動
2. 以下のシークレットを追加:

   - `GCP_PROJECT_ID`: GCPプロジェクトID（例: `my-project-123456`）
   - `GCP_SA_KEY`: GCPサービスアカウントのJSONキー
     ```bash
     # サービスアカウントキーを生成
     gcloud iam service-accounts create github-actions \
       --display-name="GitHub Actions Service Account"
     
     # 必要な権限を付与
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/run.admin"
     
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/artifactregistry.writer"
     
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/cloudbuild.builds.editor"
     
     # キーを生成
     gcloud iam service-accounts keys create key.json \
       --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com
     
     # key.jsonの内容をGitHubシークレットにコピー
     ```
   
   - `QDRANT_URL`: Qdrant Cloud のURL（例: `https://xxx.qdrant.io`）
   - `CORS_ORIGINS`: フロントエンドのURL（カンマ区切り、例: `https://daimon.vercel.app`）

3. `.github/workflows/deploy.yml` が自動的に使用されます

**ワークフローの動作**:
- `main`ブランチへのプッシュ時に自動実行
- `backend/` ディレクトリの変更時のみ実行（パフォーマンス最適化）
- 手動実行も可能（GitHub Actions UIから）

### 3.4 手動デプロイ（オプション）

Cloud Build を使わずに手動でデプロイする場合:

```bash
cd backend

# GCP Artifact Registry に接続（初回のみ）
gcloud auth configure-docker [REGION]-docker.pkg.dev

# イメージをビルド
docker build -t [REGION]-docker.pkg.dev/[PROJECT-ID]/[REPO]/daimon-backend:latest .

# イメージをプッシュ
docker push [REGION]-docker.pkg.dev/[PROJECT-ID]/[REPO]/daimon-backend:latest

# Cloud Run にデプロイ
gcloud run deploy daimon-backend \
  --image [REGION]-docker.pkg.dev/[PROJECT-ID]/[REPO]/daimon-backend:latest \
  --platform managed \
  --region [REGION] \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="[YOUR-DATABASE-URL]",QDRANT_URL="[YOUR-QDRANT-URL]",QDRANT_API_KEY="[YOUR-API-KEY]",CORS_ORIGINS="[YOUR-FRONTEND-URL]" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

### 3.5 環境変数の管理（推奨）

Secret Manager を使用して機密情報を管理:

```bash
# Secret を作成
echo -n "[YOUR-DATABASE-URL]" | gcloud secrets create database-url --data-file=-
echo -n "[YOUR-QDRANT-API-KEY]" | gcloud secrets create qdrant-api-key --data-file=-

# Cloud Run に Secret をマウント
gcloud run services update daimon-backend \
  --update-secrets DATABASE_URL=database-url:latest,QDRANT_API_KEY=qdrant-api-key:latest \
  --region [REGION]
```

---

## 4. フロントエンドデプロイ

### 4.1 Vercel の場合

#### 方法1: GitHub連携（推奨）

1. [Vercel Dashboard](https://vercel.com) にログイン
2. "Add New Project" をクリック
3. GitHubリポジトリを選択
4. プロジェクト設定:
   - **Root Directory**: `frontend` を選択
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm install && pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`
5. 環境変数を設定:
   - **Environment Variables** セクションで以下を追加:
     - `VITE_API_URL`: Cloud Run のバックエンドURL（例: `https://daimon-backend-xxx.run.app`）
6. "Deploy" をクリック

#### 方法2: Vercel CLI

```bash
cd frontend

# Vercel CLI でログイン（初回のみ）
vercel login

# プロジェクトをリンク
vercel link

# 環境変数を設定
vercel env add VITE_API_URL production
# プロンプトで Cloud Run のURLを入力

# 本番環境にデプロイ
vercel --prod
```

#### デプロイメントの確認

デプロイ後、以下のURLでアクセス可能:
- 本番環境: `https://daimon-[YOUR-PROJECT].vercel.app`
- プレビュー環境: 各プッシュごとに自動生成されるURL

デプロイメントの詳細は [Vercel Dashboard](https://vercel.com) で確認できます。


## 5. ローカル開発環境

### 5.1 環境変数の設定

```bash
cd backend
cp .env.example .env
# .env を編集して必要な値を設定
```

### 5.2 ローカル実行

```bash
# PostgreSQL と Qdrant は Docker Compose で起動
docker compose up -d

# バックエンドを起動
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

---

## 6. トラブルシューティング

### データベース接続エラー

- Supabase の接続文字列が正しいか確認
- IPアドレスの許可設定を確認（Supabase Dashboard > Settings > Database > Connection pooling）

### Qdrant 接続エラー

- `QDRANT_URL` が正しい形式か確認（`https://` で始まる必要がある）
- APIキーが正しいか確認
- クラスターが起動しているか確認

### Cloud Run デプロイエラー

- ログを確認: `gcloud run services logs read daimon-backend --region [REGION]`
- メモリ不足の場合は `--memory` を増やす（例: `1Gi`）

---

## 7. コスト最適化のヒント

1. **Cloud Run**:
   - `--min-instances 0` でアイドル時は課金なし
   - `--cpu 1` で最小構成から開始
   - タイムアウトを適切に設定（`--timeout 300`）

2. **Supabase**:
   - Free tier の制限内で運用
   - 不要な接続を閉じる

3. **Qdrant Cloud**:
   - Free tier の制限内で運用
   - 不要なベクトルを定期的に削除

---

## 8. セキュリティ

- 環境変数は Secret Manager で管理
- CORS 設定を適切に設定（本番環境のURLのみ許可）
- Supabase の Row Level Security (RLS) を検討

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Qdrant Cloud Documentation](https://qdrant.tech/documentation/cloud/)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vercel Documentation](https://vercel.com/docs)
