#!/usr/bin/env bash
set -euo pipefail

# run_migrations.sh — Run Alembic database migrations for SalesPilot
#
# Usage:
#   ./scripts/run_migrations.sh
#
# Requires DATABASE_URL environment variable to be set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== SalesPilot Database Migration ==="
echo ""

# Check DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set."
    echo ""
    echo "Please set it before running this script:"
    echo "  export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/salespilot"
    exit 1
fi

echo "Database URL: ${DATABASE_URL:0:40}..."
echo ""

# Change to backend directory (Alembic expects to run from here)
cd "$BACKEND_DIR"

# Run migrations
echo "Running alembic upgrade head..."
alembic upgrade head

echo ""
echo "=== Migration Status ==="
alembic current

echo ""
echo "=== Recent Migration History ==="
alembic history --verbose -r -3:

echo ""
echo "Migrations completed successfully."
