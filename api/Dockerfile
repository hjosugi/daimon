# Multi-stage build: tiny static Go binary on a distroless runtime.
FROM golang:1.27.0-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/batch ./cmd/batch

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
COPY --from=build /out/batch /batch
EXPOSE 8000
ENV PORT=8000
USER nonroot:nonroot
# Default entrypoint is the API; the batch job overrides with ENTRYPOINT ["/batch"].
ENTRYPOINT ["/server"]
