package auth

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/qdrant"
)

type Handler struct {
	pool   *pgxpool.Pool
	qdrant *qdrant.Client
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, qdrant *qdrant.Client, logger *slog.Logger) *Handler {
	return &Handler{pool: pool, qdrant: qdrant, logger: logger}
}
