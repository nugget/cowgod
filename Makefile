VERSION?=	$(shell cat VERSION)
DOCKER?=	nugget/cowgod:$(VERSION)

.PHONY: cowgod docker

cowgod:
	@echo "Building cowgod (if govvv is not found, do a make modules)"
	govvv build .

modules:
	go get -u
	go get github.com/ahmetb/govvv

run: cowgod
	./cowgod

docker:
	docker build . -t $(DOCKER)
	docker push $(DOCKER)

undeploy:
	kubectl scale --replicas=0 deployment cowgod

deploy:
	kubectl set image deployment/cowgod cowgod=$(DOCKER)
	kubectl scale --replicas=1 deployment cowgod
	kubectl set image deployment/pitdemon pitdemon=$(DOCKER)
	kubectl scale --replicas=1 deployment pitdemon
