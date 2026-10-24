include .env

release: create-cert-file build

build:
	docker compose --env-file .env up -d
	docker compose --env-file .env up -d --build --force-recreate

create-cert-file:
	touch acme.json && chmod 600 acme.json

