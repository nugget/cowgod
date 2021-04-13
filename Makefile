VERSION?=	$(shell cat VERSION)

.PHONY: cowgod docker

cowgod:
	govvv build .

run: cowgod
	./cowgod

docker:
	echo $(VERSION)
	docker build . -t nugget/cowgod:$(VERSION)
