#!/usr/bin/env bash
set -euo pipefail

# setup_local.sh — One-command local development setup for SalesPilot
#
# Usage:
#   ./scripts/setup_local.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

echo "================================================"
echo "  SalesPilot — Local Development Setup"
echo "================================================"
echo ""

# -------------------------------------------------------
# 1. Check prerequisites
# -------------------------------------------------------
echo "Checking prerequisites..."

command -v python3 >/dev/null 2>&1 || fail "python3 is required but not installed."
success "python3 found: $(python3 --version)"

command -v node >/dev/null 2>&1 || fail "node is required but not installed."
success "node found: $(node --version)"

command -v npm >/dev/null 2>&1 || fail "npm is required but not installed."
success "npm found: $(npm --version)"

command -v docker >/dev/null 2>&1 || fail "docker is required but not installed."
success "docker found: $(docker --version)"

command -v docker-compose >/dev/null 2>&1 || command -v "docker compose" >/dev/null 2>&1 || fail "docker-compose is required but not installed."
success "docker-compose found"

echo ""

# -------------------------------------------------------
# 2. Copy .env files if they don't exist
# -------------------------------------------------------
echo "Setting up environment files..."

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        success "Copied .env.example to .env"
    else
        cat > "$PROJECT_ROOT/.env" << 'ENVEOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/salespilot
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=local-dev-secret-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CLAUDE_API_KEY=
OPENAI_API_KEY=
GCS_BUCKET=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
ENVEOF
        success "Created .env with default values"
    fi
else
    success ".env already exists"
fi

echo ""

# -------------------------------------------------------
# 3. Start Docker services (Postgres + Redis)
# -------------------------------------------------------
echo "Starting Docker services (PostgreSQL + Redis)..."

cd "$PROJECT_ROOT"
docker-compose -f infra/docker-compose.yml up -d postgres redis

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker-compose -f infra/docker-compose.yml exec -T postgres pg_isready -U postgres -d salespilot >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        fail "PostgreSQL did not become ready in time"
    fi
    sleep 1
done
success "PostgreSQL is ready"

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
RETRIES=15
until docker-compose -f infra/docker-compose.yml exec -T redis redis-cli ping >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        fail "Redis did not become ready in time"
    fi
    sleep 1
done
success "Redis is ready"

echo ""

# -------------------------------------------------------
# 4. Install backend dependencies
# -------------------------------------------------------
echo "Installing backend dependencies..."

cd "$PROJECT_ROOT/backend"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    success "Created Python virtual environment"
fi

source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null || true
pip install --upgrade pip --quiet
pip install -e ".[dev]" --quiet
success "Backend dependencies installed"

echo ""

# -------------------------------------------------------
# 5. Install frontend dependencies
# -------------------------------------------------------
echo "Installing frontend dependencies..."

cd "$PROJECT_ROOT/frontend"
npm install --silent
success "Frontend dependencies installed"

echo ""

# -------------------------------------------------------
# 6. Run database migrations
# -------------------------------------------------------
echo "Running database migrations..."

cd "$PROJECT_ROOT/backend"
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/salespilot"
alembic upgrade head
success "Database migrations complete"

echo ""

# -------------------------------------------------------
# 7. Seed sample data
# -------------------------------------------------------
echo "Seeding sample data..."

cd "$PROJECT_ROOT/backend"
python3 -m scripts.seed_data
success "Sample data seeded"

echo ""

# -------------------------------------------------------
# Done
# -------------------------------------------------------
echo "================================================"
echo -e "  ${GREEN}SalesPilot local setup complete!${NC}"
echo "================================================"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo "  Database: postgresql://postgres:postgres@localhost:5432/salespilot"
echo "  Redis:    redis://localhost:6379"
echo ""
echo "  Admin Login:"
echo "    Email:    admin@salespilot.com"
echo "    Password: admin123"
echo ""
echo "  To start all services:"
echo "    make dev"
echo ""
echo "  Or start individually:"
echo "    Backend:  cd backend && uvicorn app.main:app --reload"
echo "    Frontend: cd frontend && npm run dev"
echo ""
