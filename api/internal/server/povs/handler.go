package povs

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/cache"
	"daimon/api/internal/embed"
)

type Handler struct {
	pool  *pgxpool.Pool
	embed *embed.Client
	cache *cache.Cache
}

func New(pool *pgxpool.Pool, embed *embed.Client, cache *cache.Cache) *Handler {
	return &Handler{pool: pool, embed: embed, cache: cache}
}
