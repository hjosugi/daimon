// Package qdrant preserves Daimon's historical vector-index API while storing
// the rebuildable index in PostgreSQL. Keeping vectors beside posts removes a
// separate always-on service and gives bot publication one atomic datastore.
package qdrant

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	Collection = "posts"
	VectorSize = 384
)

type Client struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Client {
	return &Client{pool: pool}
}

type Hit struct {
	ID      string         `json:"id"`
	Score   float32        `json:"score"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

type Point struct {
	ID      string         `json:"id"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

// EnsureCollection creates the compact PostgreSQL vector table if needed.
func (c *Client) EnsureCollection(ctx context.Context) error {
	_, err := c.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS post_vectors (
			post_id varchar PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
			vector real[] NOT NULL,
			payload jsonb NOT NULL DEFAULT '{}'::jsonb,
			updated_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT post_vectors_dimensions
				CHECK (array_length(vector, 1) = 384)
		);
		CREATE INDEX IF NOT EXISTS ix_post_vectors_user
			ON post_vectors ((payload->>'user_id'));
		ALTER TABLE post_vectors ENABLE ROW LEVEL SECURITY;
	`)
	return err
}

// RecreateCollection clears the rebuildable index.
func (c *Client) RecreateCollection(ctx context.Context) error {
	if err := c.EnsureCollection(ctx); err != nil {
		return err
	}
	_, err := c.pool.Exec(ctx, `TRUNCATE TABLE post_vectors`)
	return err
}

// Search returns nearest points using cosine similarity. Daimon's current
// dataset is intentionally small, so an exact bounded scan is cheaper than
// running a second vector database. pgvector can replace this implementation
// later without changing callers when the dataset outgrows the free tier.
func (c *Client) Search(
	ctx context.Context,
	vector []float32,
	limit int,
	requiredTags []string,
	withVectors bool,
) ([]Hit, error) {
	if len(vector) != VectorSize {
		return nil, fmt.Errorf("query vector dimensions=%d want=%d", len(vector), VectorSize)
	}
	rows, err := c.pool.Query(ctx, `SELECT post_id, vector, payload FROM post_vectors`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := make([]Hit, 0)
	for rows.Next() {
		var point Point
		var payload []byte
		if err := rows.Scan(&point.ID, &point.Vector, &payload); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(payload, &point.Payload); err != nil {
			return nil, fmt.Errorf("decode vector payload %s: %w", point.ID, err)
		}
		if !matchesAnyTag(point.Payload, requiredTags) {
			continue
		}
		hit := Hit{
			ID:      point.ID,
			Score:   cosineSimilarity(vector, point.Vector),
			Payload: point.Payload,
		}
		if withVectors {
			hit.Vector = point.Vector
		}
		hits = append(hits, hit)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(hits, func(i, j int) bool {
		if hits[i].Score == hits[j].Score {
			return hits[i].ID < hits[j].ID
		}
		return hits[i].Score > hits[j].Score
	})
	if limit > 0 && len(hits) > limit {
		hits = hits[:limit]
	}
	return hits, nil
}

func (c *Client) Retrieve(
	ctx context.Context,
	ids []string,
	withVectors bool,
) ([]Point, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := c.pool.Query(ctx, `
		SELECT post_id, vector, payload
		FROM post_vectors
		WHERE post_id = ANY($1)
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPoints(rows, withVectors)
}

func (c *Client) Upsert(ctx context.Context, points []Point) error {
	if len(points) == 0 {
		return nil
	}
	tx, err := c.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := upsertPoints(ctx, tx, points); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// UpsertTx lets post creation and semantic indexing share one transaction.
func (c *Client) UpsertTx(
	ctx context.Context,
	tx pgx.Tx,
	points []Point,
) error {
	return upsertPoints(ctx, tx, points)
}

func upsertPoints(ctx context.Context, tx pgx.Tx, points []Point) error {
	for _, point := range points {
		if len(point.Vector) != VectorSize {
			return fmt.Errorf(
				"point %s dimensions=%d want=%d",
				point.ID,
				len(point.Vector),
				VectorSize,
			)
		}
		payload, err := json.Marshal(point.Payload)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO post_vectors(post_id, vector, payload, updated_at)
			VALUES($1, $2, $3::jsonb, now())
			ON CONFLICT(post_id) DO UPDATE SET
				vector=EXCLUDED.vector,
				payload=EXCLUDED.payload,
				updated_at=EXCLUDED.updated_at
		`, point.ID, point.Vector, string(payload)); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) Delete(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := c.pool.Exec(ctx, `DELETE FROM post_vectors WHERE post_id = ANY($1)`, ids)
	return err
}

// UserPoints returns all points for a user (vectors included).
func (c *Client) UserPoints(
	ctx context.Context,
	userID string,
	limit int,
) ([]Point, error) {
	rows, err := c.pool.Query(ctx, `
		SELECT post_id, vector, payload
		FROM post_vectors
		WHERE payload->>'user_id' = $1
		ORDER BY updated_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPoints(rows, true)
}

type pointRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

func scanPoints(rows pointRows, withVectors bool) ([]Point, error) {
	points := make([]Point, 0)
	for rows.Next() {
		var point Point
		var payload []byte
		if err := rows.Scan(&point.ID, &point.Vector, &payload); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(payload, &point.Payload); err != nil {
			return nil, fmt.Errorf("decode vector payload %s: %w", point.ID, err)
		}
		if !withVectors {
			point.Vector = nil
		}
		points = append(points, point)
	}
	return points, rows.Err()
}

func matchesAnyTag(payload map[string]any, required []string) bool {
	if len(required) == 0 {
		return true
	}
	wanted := make(map[string]struct{}, len(required))
	for _, tag := range required {
		wanted[tag] = struct{}{}
	}
	switch tags := payload["tags"].(type) {
	case []string:
		for _, tag := range tags {
			if _, ok := wanted[tag]; ok {
				return true
			}
		}
	case []any:
		for _, raw := range tags {
			tag, ok := raw.(string)
			if !ok {
				continue
			}
			if _, ok := wanted[tag]; ok {
				return true
			}
		}
	}
	return false
}

func cosineSimilarity(left, right []float32) float32 {
	if len(left) != len(right) || len(left) == 0 {
		return 0
	}
	var dot, leftNorm, rightNorm float64
	for index, value := range left {
		l := float64(value)
		r := float64(right[index])
		dot += l * r
		leftNorm += l * l
		rightNorm += r * r
	}
	if leftNorm == 0 || rightNorm == 0 {
		return 0
	}
	return float32(dot / math.Sqrt(leftNorm*rightNorm))
}
