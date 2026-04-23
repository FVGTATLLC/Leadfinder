COMPOSE_FILE := infra/docker-compose.yml
DC := docker-compose -f $(COMPOSE_FILE)

.PHONY: dev dev-build down logs logs-backend logs-frontend db-shell migrate migrate-create test-backend seed clean

## Start all services in detached mode
dev:
	$(DC) up -d

## Build and start all services in detached mode
dev-build:
	$(DC) up -d --build

## Stop all services
down:
	$(DC) down

## Tail logs for all services
logs:
	$(DC) logs -f

## Tail logs for backend only
logs-backend:
	$(DC) logs -f backend

## Tail logs for frontend only
logs-frontend:
	$(DC) logs -f frontend

## Open a psql shell to the salespilot database
db-shell:
	$(DC) exec postgres psql -U postgres -d salespilot

## Run database migrations
migrate:
	$(DC) exec backend alembic upgrade head

## Create a new migration (usage: make migrate-create MSG="add users table")
migrate-create:
	$(DC) exec backend alembic revision --autogenerate -m "$(MSG)"

## Run backend tests
test-backend:
	$(DC) exec backend pytest -v

## Seed the database with sample data
seed:
	$(DC) exec backend python -m scripts.seed_data

## Stop all services and remove volumes
clean:
	$(DC) down -v --remove-orphans
