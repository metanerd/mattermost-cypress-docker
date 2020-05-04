.PHONY: build

build: setup
	cd mattermost-e2e && docker-compose build
	@echo --- All services build

	cp -r e2e mattermost-e2e/cypress
	cd mattermost-e2e/cypress && docker build -t mattermost-e2e/cypress .

up:
	cd mattermost-e2e && docker-compose up -d
	@echo --- Dependencies started

	cd mattermost-e2e && cat test-data/ldap-data.ldif | docker-compose --no-ansi exec -T openldap bash -c 'ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest';
	@echo --- LDAP users added

	cd mattermost-e2e && docker-compose --no-ansi exec -T minio sh -c 'mkdir -p /data/mattermost-test';
	@echo --- minio: created "/data/mattermost-test"

	cd mattermost-e2e && docker-compose --no-ansi ps
	@echo --- See state of containers

	cd mattermost-e2e && docker run --net mattermost-e2e_mm-test appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://elasticsearch:9200; do echo waiting for elasticsearch; sleep 5; done;"
	@echo --- elasticsearch: confirmed running

	docker run --net mattermost-e2e_mm-test --rm appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://app:8000; do echo waiting for mattermost-e2e_app; sleep 5; done;"
	@echo --- app: confirmed running

	# EE license should be at `mattermost-cypress-docker/mattermost-e2e/app/mm-license.txt`
	cd mattermost-e2e && docker-compose exec app mattermost license upload /mm-license.txt
	@echo --- app: uploaded EE license

	cd mattermost-e2e && docker-compose exec app mattermost config set TeamSettings.MaxUsersPerTeam 1000
	@echo --- app: updated system config

	cd mattermost-e2e && docker-compose exec app mattermost sampledata -w 4 -u 60 --deactivated-users=200
	@echo --- app: loaded test data

	# docker run --net mattermost-e2e_mm-test --rm appropriate/curl:latest sh -c "until curl --max-time 5 --output - http://webhook:3000; do echo waiting for webhook; sleep 5; done;"
	# @echo --- webhook: confirmed running

	# docker run --net mattermost-e2e_mm-test --rm --name mattermost-e2e_cypress -e CYPRESS_baseUrl=http://app:8000 -e CYPRESS_webhookBaseUrl=http://webhook:3000 mattermost-e2e/cypress
	# @echo --- Cypress tests: completed

stop:
	cd mattermost-e2e && docker-compose stop
	@echo --- Docker containers: stopped

clean:
	cd mattermost-e2e && docker-compose down -v
	cd mattermost-e2e && docker-compose rm -v
	@echo --- Docker containers: cleaned up

app-stop:
	docker stop mattermost-e2e_app

webhook-stop:
	docker stop mattermost-e2e_webhook

pull-webapp:
	git submodule init && git submodule update

setup:
	git submodule init && git submodule update
	cp -r e2e mattermost-e2e/cypress
	cp -r e2e mattermost-e2e/webhook
	cp -r mm-license.txt mattermost-e2e/app/mm-license.txt
	@echo --- Files and license: updated and copied to required directories
