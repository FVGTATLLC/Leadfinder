# SalesPilot

AI-powered outbound sales platform for the Nigerian market. SalesPilot automates lead research, enrichment, personalized outreach, and follow-up using coordinated AI agents.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for frontend local dev)
- GNU Make (optional, for convenience commands)

### Setup

```bash
git clone <repository-url>
cd salespilot
cp .env.example .env   # configure environment variables
make dev-build          # build and start backend services
```

Then start the frontend separately:

```bash
cd frontend
cp .env.local.example .env.local   # configure frontend env vars
npm install
npm run dev
```

The application will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Alembic, Celery
- **Frontend**: Node.js 20, Next.js 14, React 18, Tailwind CSS
- **Database**: PostgreSQL 16
- **Cache / Broker**: Redis 7
- **Infrastructure**: Docker, Docker Compose, Vercel, Google Cloud

## Deployment

| Component   | Platform            |
|-------------|---------------------|
| Frontend    | Vercel              |
| Backend API | Google Cloud Run    |
| Database    | Cloud SQL (PostgreSQL) |
| Cache/Queue | Memorystore (Redis) |
| Storage     | Google Cloud Storage |

### Frontend (Vercel)

The Next.js frontend is deployed on Vercel. API calls from the browser are proxied through Vercel rewrites to the Cloud Run backend, avoiding CORS issues.

**Setup:**
1. Import the project in [Vercel](https://vercel.com/new)
2. Set the root directory to `frontend`
3. Configure environment variables in the Vercel dashboard:
   - `NEXTAUTH_URL` -- your production frontend URL
   - `NEXTAUTH_SECRET` -- a random secret (generate with `openssl rand -base64 32`)
   - `NEXT_PUBLIC_API_URL` -- your Cloud Run backend URL
4. Vercel will auto-deploy on pushes to `main` and create preview deployments on PRs

### Backend (Google Cloud Run)

The FastAPI backend is deployed as a Docker container on Google Cloud Run via GitHub Actions. See `.github/workflows/deploy.yml`.

Make sure the backend's `CORS_ORIGINS` includes your Vercel domain(s).

## Project Structure

```
salespilot/
  backend/          # FastAPI application
    app/            # Application source code
    alembic/        # Database migrations
    tests/          # Backend tests
    pyproject.toml  # Python dependencies
  frontend/         # Next.js frontend application (deployed on Vercel)
    vercel.json     # Vercel configuration
    next.config.js  # Next.js config with API proxy rewrites
  infra/            # Docker infrastructure
    docker-compose.yml
    Dockerfile.backend
    Dockerfile.frontend
  docs/             # Architecture and design docs
  Makefile          # Development convenience commands
```

## Available Commands

| Command | Description |
|---|---|
| `make dev` | Start backend services (postgres, redis, backend, celery) |
| `make dev-build` | Build and start backend services |
| `make down` | Stop all services |
| `make logs` | Tail logs for all services |
| `make logs-backend` | Tail backend logs |
| `make db-shell` | Open a psql shell |
| `make migrate` | Run database migrations |
| `make migrate-create MSG="..."` | Create a new migration |
| `make test-backend` | Run backend tests |
| `make seed` | Seed the database |
| `make clean` | Stop services and remove volumes |
