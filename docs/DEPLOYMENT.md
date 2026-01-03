# Deployment Guide

## Option A: Qdrant Cloud + Supabase + Cloud Run

This configuration is easy to operate on GCP and cost-effective.

### Architecture Overview

```
Frontend (Vercel/Cloudflare Pages)
    ↓
Backend (Cloud Run)
    ↓
PostgreSQL (Supabase)
    ↓
Vector DB (Qdrant Cloud)
```

### Monthly Cost Estimate (MVP/Low Traffic)

- **Qdrant Cloud**: Within free tier → **$0**
- **Supabase**: Within free tier → **$0**
- **Cloud Run**: Free tier + minimal usage → **$0-$5**
- **Frontend**: Vercel/Cloudflare Pages free tier → **$0**

**Total: Approximately $0-$25**

---

## 1. Supabase Setup

### 1.1 Create Project

1. Sign up at [Supabase](https://supabase.com/)
2. Create a new project
3. Set database password (will be used later)

### 1.2 Get Connection Information

1. Go to Supabase Dashboard > Settings > Database
2. Copy the connection string
   - Format: `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres`
3. Set it in `.env` as `DATABASE_URL`

### 1.3 Database Migration

```bash
cd backend

# Set DATABASE_URL in .env file (if not already set)
# Edit .env file and add:
# DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres

# Run migration (automatically reads DATABASE_URL from .env)
uv run alembic upgrade head
```

**Note**: `alembic/env.py` automatically reads environment variables from the `.env` file. If `DATABASE_URL` is set in the `.env` file, the `export` command is not needed.

---

## 2. Qdrant Cloud Setup

### 2.1 Create Cluster

1. Sign up at [Qdrant Cloud](https://cloud.qdrant.io/)
2. Create a new cluster (select Free tier)
3. Get cluster ID and API key

### 2.2 Configure Connection Information

Set the following in `.env`:

```env
QDRANT_URL=https://[CLUSTER-ID].qdrant.io
QDRANT_API_KEY=[YOUR-API-KEY]
```

### 2.3 Create Collection

Collections are automatically created when the application starts, but you can verify manually:

```python
from qdrant_client import QdrantClient

client = QdrantClient(
    url="https://[CLUSTER-ID].qdrant.io",
    api_key="[YOUR-API-KEY]"
)

# Check collection list
collections = client.get_collections()
print(collections)
```

---

## 3. Cloud Run Deployment

### 3.1 Prerequisites

- Google Cloud SDK (`gcloud`) installed
- GCP project created
- Cloud Run API enabled
- Cloud Build API enabled
- Artifact Registry API enabled

### 3.2 Artifact Registry Setup

```bash
# Create Artifact Registry repository (first time only)
gcloud artifacts repositories create daimon \
  --repository-format=docker \
  --location=[REGION] \
  --description="Daimon backend Docker images"

# Connect to Artifact Registry (first time only)
gcloud auth configure-docker [REGION]-docker.pkg.dev
```

### 3.3 Continuous Deployment from GitHub Repository (Cloud Build Recommended)

#### 3.3.1 Create Cloud Build Trigger

1. Go to [Cloud Console](https://console.cloud.google.com)
2. Navigate to **Cloud Build** > **Triggers**
3. Click **Create Trigger**
4. Enter settings:
   - **Name**: `daimon-backend-deploy`
   - **Event**: `Push to a branch`
   - **Source**: Select GitHub repository (authentication required for first time)
   - **Repository**: Select repository
   - **Branch**: `^main$` (runs on push to main branch)
   - **Configuration**: `Cloud Build configuration file (yaml or json)`
   - **Location**: `backend/cloudbuild.yaml`
5. Set **Substitution variables**:
   - `_QDRANT_URL`: Qdrant Cloud URL
   - `_CORS_ORIGINS`: Frontend URL (comma-separated)
6. Click **Create**

#### 3.3.2 Run Initial Deployment

```bash
# Manually run Cloud Build Trigger
gcloud builds triggers run daimon-backend-deploy \
  --branch=main \
  --region=[REGION]
```

After this, deployments will run automatically on every push to the `main` branch.

#### 3.3.3 Deploy Using GitHub Actions (Alternative Method)

Instead of Cloud Build Trigger, you can also trigger Cloud Build using GitHub Actions.

**Required Secret Configuration**:

1. Go to GitHub repository **Settings** > **Secrets and variables** > **Actions**
2. Add the following secrets:

   - `GCP_PROJECT_ID`: GCP project ID (e.g., `my-project-123456`)
   - `GCP_SA_KEY`: GCP service account JSON key
     ```bash
     # Generate service account key
     gcloud iam service-accounts create github-actions \
       --display-name="GitHub Actions Service Account"
     
     # Grant required permissions
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/run.admin"
     
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/artifactregistry.writer"
     
     gcloud projects add-iam-policy-binding ${PROJECT_ID} \
       --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
       --role="roles/cloudbuild.builds.editor"
     
     # Generate key
     gcloud iam service-accounts keys create key.json \
       --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com
     
     # Copy key.json content to GitHub secret
     ```
   
   - `QDRANT_URL`: Qdrant Cloud URL (e.g., `https://xxx.qdrant.io`)
   - `CORS_ORIGINS`: Frontend URL (comma-separated, e.g., `https://daimon.vercel.app`)

3. `.github/workflows/deploy.yml` will be used automatically

**Workflow Behavior**:
- Automatically runs on push to `main` branch
- Only runs when `backend/` directory changes (performance optimization)
- Manual execution also available (from GitHub Actions UI)

### 3.4 Manual Deployment (Optional)

To deploy manually without Cloud Build:

```bash
cd backend

# Connect to GCP Artifact Registry (first time only)
gcloud auth configure-docker [REGION]-docker.pkg.dev

# Build image
docker build -t [REGION]-docker.pkg.dev/[PROJECT-ID]/[REPO]/daimon-backend:latest .

# Push image
docker push [REGION]-docker.pkg.dev/[PROJECT-ID]/[REPO]/daimon-backend:latest

# Deploy to Cloud Run
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

### 3.5 Environment Variable Management (Recommended)

Use Secret Manager to manage sensitive information:

```bash
# Create secrets
echo -n "[YOUR-DATABASE-URL]" | gcloud secrets create database-url --data-file=-
echo -n "[YOUR-QDRANT-API-KEY]" | gcloud secrets create qdrant-api-key --data-file=-

# Mount secrets to Cloud Run
gcloud run services update daimon-backend \
  --update-secrets DATABASE_URL=database-url:latest,QDRANT_API_KEY=qdrant-api-key:latest \
  --region [REGION]
```

---

## 4. Frontend Deployment

### 4.1 Vercel

#### Method 1: GitHub Integration (Recommended)

1. Log in to [Vercel Dashboard](https://vercel.com)
2. Click "Add New Project"
3. Select GitHub repository
4. Configure project:
   - **Root Directory**: Select `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm install && pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`
5. Set environment variables:
   - In **Environment Variables** section, add:
     - `VITE_API_URL`: Cloud Run backend URL (e.g., `https://daimon-backend-xxx.run.app`)
6. Click "Deploy"

#### Method 2: Vercel CLI

```bash
cd frontend

# Login with Vercel CLI (first time only)
vercel login

# Link project
vercel link

# Set environment variables
vercel env add VITE_API_URL production
# Enter Cloud Run URL when prompted

# Deploy to production
vercel --prod
```

#### Deployment Verification

After deployment, accessible at:
- Production: `https://daimon-[YOUR-PROJECT].vercel.app`
- Preview: Auto-generated URL for each push

Deployment details can be viewed in [Vercel Dashboard](https://vercel.com).


## 5. Local Development Environment

### 5.1 Environment Variable Configuration

```bash
cd backend
cp .env.example .env
# Edit .env and set required values
```

### 5.2 Local Execution

```bash
# PostgreSQL and Qdrant are started with Docker Compose
docker compose up -d

# Start backend
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

---

## 6. Troubleshooting

### Database Connection Error

- Verify Supabase connection string is correct
- Check IP address allowlist settings (Supabase Dashboard > Settings > Database > Connection pooling)

### Qdrant Connection Error

- Verify `QDRANT_URL` is in correct format (must start with `https://`)
- Verify API key is correct
- Verify cluster is running

### Cloud Run Deployment Error

- Check logs: `gcloud run services logs read daimon-backend --region [REGION]`
- If out of memory, increase `--memory` (e.g., `1Gi`)

---

## 7. Cost Optimization Tips

1. **Cloud Run**:
   - Set `--min-instances 0` for no billing when idle
   - Start with minimal configuration `--cpu 1`
   - Set appropriate timeout (`--timeout 300`)

2. **Supabase**:
   - Operate within free tier limits
   - Close unused connections

3. **Qdrant Cloud**:
   - Operate within free tier limits
   - Regularly delete unused vectors

---

## 8. Security

- Manage environment variables with Secret Manager
- Configure CORS appropriately (only allow production URLs)
- Consider Supabase Row Level Security (RLS)

---

## Reference Links

- [Supabase Documentation](https://supabase.com/docs)
- [Qdrant Cloud Documentation](https://qdrant.tech/documentation/cloud/)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vercel Documentation](https://vercel.com/docs)
