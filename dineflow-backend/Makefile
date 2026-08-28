DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/dineflow?sslmode=disable

.PHONY: run build tidy migrate-up migrate-down docker-up docker-down seed

run:
	go run ./cmd/api

# Seeds a starter menu. Defaults to the first restaurant found; target a
# specific one with: make seed RESTAURANT_ID=<uuid>
seed:
	go run ./cmd/seed --restaurant=$(RESTAURANT_ID)

build:
	go build -o bin/dineflow-api ./cmd/api

tidy:
	go mod tidy

migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path migrations -database "$(DATABASE_URL)" down 1

docker-up:
	docker compose up -d

docker-down:
	docker compose down
