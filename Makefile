.PHONY: demo up down reset seed test psql snapshot shots build-static

demo up:
	docker compose up -d --build

down:
	docker compose down

reset:
	docker compose down -v
	docker compose up -d --build

seed:
	docker compose run --rm seed

test:
	docker compose run --rm test

psql:
	docker compose exec db psql -U $${POSTGRES_USER:-pulse} -d $${POSTGRES_DB:-pulse}

snapshot:
	cd app && npm run snapshot

shots:
	cd app && node scripts/shots.mjs

build-static:
	cd app && npm run build:static
