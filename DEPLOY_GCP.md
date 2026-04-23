# SalesPilot — Google Cloud Deployment Guide (Web Console)

## Overview
- **Database:** Cloud SQL for PostgreSQL
- **Backend:** Cloud Run (containerized FastAPI)
- **Frontend:** Vercel (already deployed at salespilot-ng.vercel.app)

Estimated cost: ~$10-15/month for MVP traffic.

---

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown (top bar) → **New Project**
3. Name: `salespilot` → **Create**
4. Make sure this project is selected in the top bar
5. Enable billing (required for Cloud SQL + Cloud Run)

---

## Step 2: Enable Required APIs

Go to **APIs & Services** → **Enable APIs** and enable these:

- **Cloud SQL Admin API**
- **Cloud Run Admin API**
- **Artifact Registry API**
- **Cloud Build API**

Or use the search bar at the top to search for each and click **Enable**.

---

## Step 3: Create Cloud SQL PostgreSQL Instance

1. Go to **SQL** in the left sidebar (or search "Cloud SQL")
2. Click **Create Instance** → **PostgreSQL**
3. Configure:
   - **Instance ID:** `salespilot-db`
   - **Password:** Set a strong root password (save this!)
   - **Database version:** PostgreSQL 16
   - **Region:** `asia-south1 (Mumbai)` (closest to India)
   - **Zonal availability:** Single zone (MVP)
   - **Machine type:** Shared core → `db-f1-micro` (~$8/month)
   - **Storage:** 10 GB SSD
4. Click **Create Instance** (takes 5-10 minutes)

### After instance is created:

5. Click on the instance → **Databases** tab → **Create Database**
   - Name: `salespilot` → Create

6. Click **Users** tab → **Add User Account**
   - Username: `salespilot_app`
   - Password: (set a strong password, save it!)
   - Click **Add**

7. Note the **Connection name** from the Overview page:
   - Format: `YOUR_PROJECT_ID:asia-south1:salespilot-db`
   - You'll need this for Cloud Run

---

## Step 4: Create Artifact Registry Repository

1. Go to **Artifact Registry** (search in top bar)
2. Click **Create Repository**
3. Configure:
   - **Name:** `salespilot`
   - **Format:** Docker
   - **Region:** `asia-south1`
4. Click **Create**

---

## Step 5: Build & Push Docker Image

You need **Cloud Shell** for this (no local gcloud needed).

1. Click the **Cloud Shell** icon (top-right terminal icon) in Google Cloud Console
2. In Cloud Shell, run:

```bash
# Clone your repo
git clone https://github.com/your-org/salespilot.git
cd SalesPilot/backend

# Set project
gcloud config set project YOUR_PROJECT_ID

# Build and push to Artifact Registry
gcloud builds submit \
  --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/salespilot/backend:latest \
  -f Dockerfile.cloudrun .
```

Replace `YOUR_PROJECT_ID` with your actual project ID (visible in the top bar).

This builds the Docker image in the cloud and pushes it to Artifact Registry (~3-5 min).

---

## Step 6: Deploy to Cloud Run

1. Go to **Cloud Run** (search in top bar)
2. Click **Create Service**
3. Configure:

### Container
- **Container image:** Click **Select** → navigate to `asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/salespilot/backend:latest`
- **Service name:** `salespilot-api`
- **Region:** `asia-south1 (Mumbai)`

### Settings
- **CPU allocation:** CPU is only allocated during request processing
- **Minimum instances:** `0`
- **Maximum instances:** `3`
- **Memory:** `512 MiB`
- **CPU:** `1`
- **Request timeout:** `120` seconds

### Authentication
- Select **Allow unauthenticated invocations** (the API has its own JWT auth)

### Container → Variables & Secrets tab
Add these environment variables:

| Variable | Value |
|----------|-------|
| `CLOUD_SQL_CONNECTION_NAME` | `YOUR_PROJECT_ID:asia-south1:salespilot-db` |
| `DB_USER` | `salespilot_app` |
| `DB_PASS` | (the password you set in Step 3) |
| `DB_NAME` | `salespilot` |
| `JWT_SECRET` | (generate a random 64-char string) |
| `CORS_ORIGINS` | `https://salespilot-ng.vercel.app` |
| `CLAUDE_API_KEY` | (your Anthropic API key, if you have one) |
| `OPENAI_API_KEY` | (your OpenAI API key, if you have one) |

### Cloud SQL Connections tab
- Click **Add Connection**
- Select your Cloud SQL instance: `salespilot-db`

4. Click **Create**

Wait for deployment (~2-3 min). You'll get a URL like:
`https://salespilot-api-XXXXX-el.a.run.app`

### Test it:
Visit `https://salespilot-api-XXXXX-el.a.run.app/health` — should return:
```json
{"status": "healthy", "service": "salespilot-backend"}
```

---

## Step 7: Run Database Migrations

1. Go back to **Cloud Shell**
2. Run:

```bash
# Install Cloud SQL Auth Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Start proxy in background
./cloud-sql-proxy YOUR_PROJECT_ID:asia-south1:salespilot-db &

# Go to backend directory
cd ~/SalesPilot/backend

# Install Python deps
pip install -r <(echo "sqlalchemy[asyncio]>=2.0.36
asyncpg>=0.30.0
alembic>=1.14.0
psycopg2-binary>=2.9.0
pydantic-settings>=2.6.0
passlib[bcrypt]>=1.7.4")

# Set DATABASE_URL for migrations (uses psycopg2 via proxy on localhost)
export DATABASE_URL="postgresql+asyncpg://salespilot_app:YOUR_DB_PASSWORD@localhost:5432/salespilot"

# Run migrations
cd ~/SalesPilot/backend
alembic upgrade head

# Seed admin user
python -m scripts.seed_admin
```

You should see:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial
Admin user created: admin@clubconcierge.com / admin123
```

---

## Step 8: Connect Vercel Frontend to Cloud Run Backend

1. Go to [vercel.com](https://vercel.com) → your **salespilot-ng** project
2. Go to **Settings** → **Environment Variables**
3. Add:
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://salespilot-api-XXXXX-el.a.run.app/api/v1`
     (use your actual Cloud Run URL from Step 6)
4. Click **Save**
5. Go to **Deployments** → click **Redeploy** on the latest deployment

---

## Step 9: Test the Full Stack

1. Visit `https://salespilot-ng.vercel.app`
2. Register a new account or login with:
   - Email: `admin@clubconcierge.com`
   - Password: `admin123`
3. You should see the dashboard!

---

## Troubleshooting

### "An unexpected error occurred" on frontend
- Check that `NEXT_PUBLIC_API_URL` is set correctly on Vercel
- Verify the Cloud Run service is running (check Cloud Run logs)

### Cloud Run returns 500 errors
- Go to Cloud Run → your service → **Logs** tab
- Check for database connection errors
- Verify Cloud SQL connection is added in the Cloud Run settings

### Database migration fails
- Make sure the Cloud SQL Auth Proxy is running
- Verify username/password are correct
- Check that the `salespilot` database exists

### CORS errors in browser
- Make sure `CORS_ORIGINS` on Cloud Run includes your Vercel URL (with https://)
- Redeploy Cloud Run after changing env vars

---

## Generate a JWT Secret

Run this in Cloud Shell to generate a secure secret:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Monthly Cost Estimate (MVP)

| Service | Cost |
|---------|------|
| Cloud SQL (db-f1-micro, always on) | ~$8-10 |
| Cloud Run (scales to 0, pay per request) | ~$0-5 |
| Artifact Registry (image storage) | ~$0.10 |
| Cloud Build (120 min/day free) | $0 |
| **Total** | **~$10-15/month** |
