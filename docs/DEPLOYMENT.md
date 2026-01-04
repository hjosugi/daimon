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
   - Click **Add substitution variable**
   - **Key**: `_QDRANT_URL`
   - **Value**: `https://[YOUR-CLUSTER-ID].qdrant.io` (e.g., `https://abc123.qdrant.io`)
   - Click **Add substitution variable** again
   - **Key**: `_CORS_ORIGINS`
   - **Value**: Frontend URL (e.g., `https://daimon-sandy.vercel.app`) or comma-separated if multiple (e.g., `https://app1.vercel.app,https://app2.vercel.app`)
6. Click **Create**

**Note**: `DATABASE_URL` should be managed via Secret Manager (see section 3.5.1), not as a substitution variable.

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

### 3.5 Connection Information Registration

#### 3.5.1 Using Secret Manager (Recommended for Production)

Secret Manager is the recommended way to securely store sensitive connection information.

**Step 1: Create Secrets**

```bash
# Create DATABASE_URL secret
echo -n "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres" | \
  gcloud secrets create database-url --data-file=-

# Create QDRANT_API_KEY secret
echo -n "[YOUR-QDRANT-API-KEY]" | \
  gcloud secrets create qdrant-api-key --data-file=-
```

**Step 2: Grant Cloud Run Access to Secrets**

```bash
# Get Cloud Run service account email
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant secret accessor role
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding qdrant-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

**Step 3: Mount Secrets to Cloud Run**

```bash
gcloud run services update daimon-api \
  --update-secrets DATABASE_URL=database-url:latest,QDRANT_API_KEY=qdrant-api-key:latest \
  --region [REGION]
```

**Step 4: Set Non-Sensitive Environment Variables**

```bash
gcloud run services update daimon-api \
  --set-env-vars QDRANT_URL="https://[YOUR-CLUSTER-ID].qdrant.io",CORS_ORIGINS="https://[YOUR-FRONTEND-URL]" \
  --region [REGION]
```

#### 3.5.2 Using Cloud Build Trigger Substitution Variables

If using Cloud Build Trigger for continuous deployment, set substitution variables:

**Step 1: Access Cloud Build Trigger Settings**

1. Go to [Cloud Console](https://console.cloud.google.com)
2. Navigate to **Cloud Build** > **Triggers**
3. Click on your trigger (e.g., `daimon-backend-deploy`)
4. Click **Edit**

**Step 2: Set Substitution Variables**

In the **Substitution variables** section, add:

- `_QDRANT_URL`: `https://[YOUR-CLUSTER-ID].qdrant.io`
- `_CORS_ORIGINS`: `https://[YOUR-FRONTEND-URL]` (comma-separated if multiple)

**Note**: `DATABASE_URL` should be managed via Secret Manager (see 3.5.1), not as a substitution variable.

**Step 3: Update cloudbuild.yaml**

The `cloudbuild.yaml` file should reference these variables:

```yaml
--set-env-vars QDRANT_URL=${_QDRANT_URL},CORS_ORIGINS=${_CORS_ORIGINS}
```

#### 3.5.3 Manual Environment Variable Setting (Alternative)

For quick testing or development, you can set environment variables directly:

```bash
gcloud run services update daimon-api \
  --set-env-vars \
    DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres",\
    QDRANT_URL="https://[CLUSTER-ID].qdrant.io",\
    QDRANT_API_KEY="[YOUR-API-KEY",\
    CORS_ORIGINS="https://[YOUR-FRONTEND-URL]" \
  --region [REGION]
```

**⚠️ Security Warning**: This method exposes sensitive information in command history. Use Secret Manager for production.

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
   - In **Environment Variables** section, click **Add** and add:
     - **Name**: `VITE_API_URL`
     - **Value**: Cloud Run backend URL (e.g., `https://daimon-api-xxx.asia-northeast1.run.app`)
     - **Environment**: Select `Production`, `Preview`, and `Development` (or as needed)
   - Click **Save** after adding each variable
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
# Enter Cloud Run URL when prompted (e.g., https://daimon-api-xxx.asia-northeast1.run.app)

# Set for all environments (optional)
vercel env add VITE_API_URL preview
vercel env add VITE_API_URL development

# Deploy to production
vercel --prod
```

#### Method 3: Vercel Dashboard (After Initial Setup)

To update environment variables after initial deployment:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** > **Environment Variables**
4. Click **Add New** or edit existing variables
5. Set:
   - **Key**: `VITE_API_URL`
   - **Value**: Your Cloud Run backend URL
   - **Environment**: Select applicable environments
6. Click **Save**
7. Redeploy the project for changes to take effect

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
