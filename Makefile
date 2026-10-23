-include .env
export

WAN := bnm-wan
IP_saint-denis := 10.20.0.11
IP_saint-paul := 10.20.0.12
IP_saint-pierre := 10.20.0.13

.PHONY: up down logs outage restore migrate-up migrate-down test lint typecheck check-agency

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api worker collector

# Cut a branch off the simulated WAN, as if its leased line dropped.
outage: check-agency
	docker network disconnect $(WAN) $$(docker compose ps -q $(AGENCY))

restore: check-agency
	docker network connect --ip $(IP_$(AGENCY)) $(WAN) $$(docker compose ps -q $(AGENCY))

check-agency:
	@test -n "$(IP_$(AGENCY))" || (echo "usage: make outage|restore AGENCY=saint-denis|saint-paul|saint-pierre" && exit 1)

migrate-up:
	docker compose run --rm migrate

migrate-down:
	docker compose run --rm migrate npx node-pg-migrate down -m migrations

test:
	npm test
	cd collector && uv run pytest

lint:
	npm run lint
	cd collector && uv run ruff check . && uv run ruff format --check .

typecheck:
	npm run typecheck
