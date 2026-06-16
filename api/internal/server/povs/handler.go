package povs

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/cache"
	"daimon/api/internal/embed"
)

type Handler struct {
	pool  *pgxpool.Pool
	embed *embed.Client
	cache *cache.Cache
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, embed *embed.Client, cache *cache.Cache, logger *slog.Logger) *Handler {
	return &Handler{pool: pool, embed: embed, cache: cache, logger: logger}
}
