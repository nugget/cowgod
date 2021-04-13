FROM golang:1.16.3 AS build

RUN update-ca-certificates

WORKDIR /src/
COPY . .
RUN go get -u
RUN go get github.com/ahmetb/govvv
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 govvv build -o /bin/cowgod

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /bin/cowgod /bin/cowgod
ENTRYPOINT ["/bin/cowgod"]
