# Multi-stage production Go server build (Alpine, non-root, CGO_ENABLED=0)
FROM golang:1.27-alpine AS builder

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -trimpath -o /out/game-server ./cmd/server

FROM alpine:3.21

RUN apk add --no-cache ca-certificates wget tzdata \
  && addgroup -S appgroup \
  && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /out/game-server /app/game-server
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 7777
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7777/health || exit 1

ENTRYPOINT ["/app/game-server"]
