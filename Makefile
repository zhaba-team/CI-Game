include .env

release: create-cert-file build

build:
	docker compose --env-file .env $(COMPOSE_LOCAL_UNUPDATABLE) up -d
	docker compose --env-file .env $(COMPOSE_LOCAL_UPDATABLE) up -d --build --force-recreate

create-cert-file:
	touch acme.json && chmod 600 acme.json

