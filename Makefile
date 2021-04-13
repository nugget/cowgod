VERSION?=	$(shell cat VERSION)
DOCKER?=	nugget/cowgod:$(VERSION)

.PHONY: cowgod docker

cowgod:
	govvv build .

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
