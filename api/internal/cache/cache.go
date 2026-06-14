// Package cache is a thin, optional Redis JSON cache. When REDIS_URL is unset
// it degrades to a no-op so the API/batch keep working without Redis.
package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	rdb *redis.Client
}

// New returns a Cache. If url is empty or invalid, the cache is disabled
// (all operations are no-ops / misses).
func New(url string) *Cache {
	if url == "" {
		return &Cache{}
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		return &Cache{}
	}
	return &Cache{rdb: redis.NewClient(opt)}
}

func (c *Cache) Enabled() bool { return c != nil && c.rdb != nil }

// GetJSON unmarshals key into dst. Returns true only on a hit.
func (c *Cache) GetJSON(ctx context.Context, key string, dst any) bool {
	if !c.Enabled() {
		return false
	}
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) {
	if !c.Enabled() {
		return
	}
	if b, err := json.Marshal(v); err == nil {
		c.rdb.Set(ctx, key, b, ttl)
	}
}
