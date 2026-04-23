# SalesPilot — Architecture Document

## System Overview

```
                         +------------------+
                         |   Browser/Client |
                         +--------+---------+
                                  |
                         +--------v---------+
                         |  Next.js Frontend |
                         |  (Vercel)         |
                         +--------+---------+
                                  |
                      (API proxy via rewrites)
                                  |
                         +--------v---------+
                         |  FastAPI Backend  |
                         |  (Cloud Run)      |
                         +---+----+-----+---+
                             |    |     |
                +------------+    |     +------------+
                |                 |                  |
        +-------v------+  +------v-------+  +-------v------+
        | PostgreSQL    |  |   Redis      |  |  GCS Bucket  |
        | (Cloud SQL)   |  | (Memorystore)|  |  (Exports)   |
        +--------------+  +--------------+  +--------------+
                |
        +-------v------+
        | Celery Workers|
        | (Background)  |
        +--------------+
```

## Tech Stack

| Layer            | Technology                         |
|------------------|------------------------------------|
| Frontend         | Next.js 14, React 18, Tailwind CSS |
| Frontend Hosting | Vercel (auto-deploy from GitHub)   |
| Backend API      | FastAPI, Python 3.11               |
| Backend Hosting  | Google Cloud Run                   |
| Database         | PostgreSQL 16 (async via asyncpg)   |
| ORM              | SQLAlchemy 2.0 (async)             |
| Migrations       | Alembic                            |
| Cache / Queue    | Redis 7                            |
| Task Queue       | Celery 5                           |
| Auth             | JWT (python-jose, passlib/bcrypt)  |
| LLM Providers    | Anthropic Claude, OpenAI GPT-4o    |
| Object Storage   | Google Cloud Storage               |
| IaC              | Terraform                          |
| CI/CD            | GitHub Actions + Vercel            |
| Containerization | Docker (multi-stage builds)        |

## Component Descriptions

### Frontend (Next.js)
- Server-side rendered React application using App Router
- Handles authentication via NextAuth.js
- Communicates with backend via REST API
- Pages: Dashboard, Strategies, Contacts, Campaigns, Messages, Analytics, Settings
- Deployed on Vercel with automatic preview deployments on PRs
- API calls from the browser use relative paths (`/api/v1/*`) which are proxied to the backend via Next.js rewrites, eliminating CORS issues

### Backend API (FastAPI)
- Async REST API with auto-generated OpenAPI docs
- Modular structure: routers, services, schemas, models
- JWT-based authentication with role-based access control
- Roles: admin, manager, sales_rep, ops, reviewer

### Database (PostgreSQL)
- Primary data store for all application entities
- UUID primary keys with soft-delete pattern (is_deleted flag)
- Automatic created_at/updated_at timestamps via SQLAlchemy Base model
- Async access via asyncpg driver

### Cache & Queue Broker (Redis)
- Celery broker and result backend
- Session caching (future)
- Rate limiting (future)

### Task Queue (Celery)
- Background job processing for long-running AI operations
- Celery Beat for scheduled orchestration ticks
- Tasks: discovery, enrichment, research, message generation, sending

### AI Agent System
- Multi-agent architecture with specialized agents per task
- LLM abstraction layer supporting multiple providers
- Orchestrator agent coordinates campaign execution pipeline
- Detailed in docs/agent-design.md

### Object Storage (GCS)
- CSV/Excel export file storage
- Temporary file hosting for bulk operations

## Data Flow

1. **ICP Strategy Creation**: User defines filters -> Strategy stored in DB
2. **Company Discovery**: Agent queries external data -> Companies scored and stored
3. **Contact Enrichment**: Agent enriches contact data from multiple sources
4. **Research Briefs**: Agent generates company/contact research summaries
5. **Campaign Execution**: Orchestrator advances contacts through sequence steps
6. **Message Generation**: Messaging agent creates personalized drafts
7. **Approval & Sending**: Messages approved (manual/auto) -> sent via SMTP
8. **Analytics**: Pipeline metrics aggregated and surfaced on dashboard

## Authentication Flow

1. User submits email/password to POST /api/v1/auth/login
2. Backend verifies credentials, returns JWT access token
3. Frontend stores token, sends as Authorization: Bearer header
4. Backend middleware decodes token, extracts user ID and role
5. Route-level role checks enforce access control (require_role dependency)

## Deployment Architecture

### Local Development
- docker-compose.yml: PostgreSQL, Redis, Backend (hot-reload), Celery
- Frontend runs locally via `npm run dev` (or optionally via Docker)
- Hot reload enabled via volume mounts

### Staging (docker-compose.prod.yml)
- Production-like setup without volume mounts
- Gunicorn with Uvicorn workers (4 workers)
- Health checks on all services

### Production

**Frontend (Vercel):**
- Automatic deployments on push to main branch
- Preview deployments on pull requests
- API calls proxied to Cloud Run backend via Next.js rewrites
- Environment variables configured in Vercel dashboard:
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_API_URL`

**Backend (Google Cloud Run):**
- Serverless container deployment via GitHub Actions
- Cloud SQL: Managed PostgreSQL with private networking
- Memorystore: Managed Redis
- VPC Connector: Private communication between Cloud Run and Cloud SQL/Redis
- Terraform manages all GCP infrastructure
- GitHub Actions CI/CD pipeline with automated deployment on merge to main
