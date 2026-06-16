package posts

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/embed"
	"daimon/api/internal/qdrant"
)

type Handler struct {
	pool   *pgxpool.Pool
	embed  *embed.Client
	qdrant *qdrant.Client
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, embed *embed.Client, qdrant *qdrant.Client, logger *slog.Logger) *Handler {
	return &Handler{pool: pool, embed: embed, qdrant: qdrant, logger: logger}
}
