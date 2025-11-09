VERSION?=	$(shell cat VERSION)
IMAGE?=		ghcr.io/nugget/cowgod

.PHONY: cowgod modules run docker undeploy deploy fulldeploy nocowgod clean

modules:
	go mod tidy
	go get -u

cowgod: modules
	go build .

clean:
	rm -f cowgod

run: cowgod
	./cowgod

docker:
	docker build . -t $(IMAGE):$(VERSION) -t $(IMAGE):latest
	docker push $(IMAGE):latest
