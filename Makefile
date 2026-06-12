.PHONY: dev test build migrate seed lint clean

dev:
	docker-compose up -d postgres redis
	npm run dev

test:
	npm run test

build:
	npm run build

migrate:
	npm run migrate --workspace=velo-backend

seed:
	npm run seed --workspace=velo-backend

lint:
	npm run lint

clean:
	docker-compose down -v
	rm -rf node_modules velo-backend/node_modules velo-sdk/node_modules
	rm -rf velo-backend/dist velo-backend/reconciler/target
