VERSION?=	$(shell cat VERSION)
DOCKER?=	nugget/cowgod:$(VERSION)

.PHONY: cowgod modules run docker undeploy deploy fulldeploy nocowgod clean

cowgod:
	@echo "Building cowgod (if govvv is not found, do a make modules)"
	govvv build .

clean:
	rm -f cowgod

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
	kubectl set image deployment/pitdemon pitdemon=$(DOCKER)

fulldeploy: deploy
	kubectl scale --replicas=1 deployment cowgod
	kubectl scale --replicas=1 deployment pitdemon

nocowgod:
	kubectl scale --replicas=0 deployment cowgod
