// Package feedcore contains feed aggregation and ranking inputs shared by the
// API server and the batch precompute job.
package feedcore

import (
	"context"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
	"daimon/api/internal/vec"
)

const (
	SavePopularityWeight                    = 3
	popularityScale                 float32 = 10
	UserCentroidLimit                       = 200
	DefaultTimelineSimilarityWeight         = 0.7
	DefaultTimelineBridgeWeight             = 0.3
	DefaultTimelineTopK                     = 10
)

// PostMeta is the small post metadata subset needed to build ranking
// candidates.
type PostMeta struct {
	UserID    string
	CreatedAt time.Time
}

// LoadPOVs returns POV labels grouped by post ID.
func LoadPOVs(ctx context.Context, pool *pgxpool.Pool, ids []string) (map[string][]string, error) {
	out := map[string][]string{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := pool.Query(ctx, dbq.SQL("feed.load_povs"), ids)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID, pov string
		if err := rows.Scan(&postID, &pov); err != nil {
			return out, err
		}
		out[postID] = append(out[postID], pov)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	return out, nil
}

// LoadLikeCounts returns like counts keyed by post ID.
func LoadLikeCounts(ctx context.Context, pool *pgxpool.Pool, ids []string) (map[string]int, error) {
	return loadCounts(ctx, pool, dbq.SQL("feed.like_counts"), ids)
}

// LoadSaveCounts returns save counts keyed by post ID.
func LoadSaveCounts(ctx context.Context, pool *pgxpool.Pool, ids []string) (map[string]int, error) {
	return loadCounts(ctx, pool, dbq.SQL("feed.save_counts"), ids)
}

func loadCounts(ctx context.Context, pool *pgxpool.Pool, query string, ids []string) (map[string]int, error) {
	out := map[string]int{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := pool.Query(ctx, query, ids)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var postID string
		var count int
		if err := rows.Scan(&postID, &count); err != nil {
			return out, err
		}
		out[postID] = count
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	return out, nil
}

// UserTagSet loads all POV labels a user has authored.
func UserTagSet(ctx context.Context, pool *pgxpool.Pool, uid string) (map[string]bool, error) {
	tags := map[string]bool{}
	if uid == "" {
		return tags, nil
	}
	povs, err := dbq.QueryStrings(ctx, pool, dbq.SQL("feed.user_povs"), uid)
	if err != nil {
		return tags, err
	}
	for _, pov := range povs {
		tags[pov] = true
	}
	return tags, nil
}

// UserCentroid returns the mean vector for a user's own posts.
func UserCentroid(ctx context.Context, qc *qdrant.Client, uid string) ([]float32, error) {
	if uid == "" {
		return nil, nil
	}
	pts, err := qc.UserPoints(ctx, uid, UserCentroidLimit)
	if err != nil {
		return nil, err
	}
	if len(pts) == 0 {
		return nil, nil
	}
	return vec.Mean(PointVectors(pts)), nil
}

// SavedCentroid returns the mean vector for posts a user has saved.
func SavedCentroid(ctx context.Context, pool *pgxpool.Pool, qc *qdrant.Client, uid string) ([]float32, error) {
	if uid == "" {
		return nil, nil
	}
	ids, err := dbq.QueryStrings(ctx, pool, dbq.SQL("feed.user_saved_ids"), uid)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	pts, err := qc.Retrieve(ctx, ids, true)
	if err != nil {
		return nil, err
	}
	if len(pts) == 0 {
		return nil, nil
	}
	return vec.Mean(PointVectors(pts)), nil
}

// PointVectors extracts the non-empty vectors from Qdrant points.
func PointVectors(pts []qdrant.Point) [][]float32 {
	vs := make([][]float32, 0, len(pts))
	for _, p := range pts {
		if len(p.Vector) > 0 {
			vs = append(vs, p.Vector)
		}
	}
	return vs
}

// MetasFromHits extracts ranking metadata from Qdrant hit payloads.
func MetasFromHits(hits []qdrant.Hit) map[string]PostMeta {
	out := make(map[string]PostMeta, len(hits))
	for _, hit := range hits {
		userID, _ := hit.Payload["user_id"].(string)
		out[hit.ID] = PostMeta{
			UserID:    userID,
			CreatedAt: payloadCreatedAt(hit.Payload),
		}
	}
	return out
}

// BuildCandidates creates ranking candidates from search hits and loaded
// aggregation data.
func BuildCandidates(hits []qdrant.Hit, metas map[string]PostMeta, povs map[string][]string, likeCounts, saveCounts map[string]int, viewerID string, now time.Time) []ranking.Candidate {
	cands := make([]ranking.Candidate, 0, len(hits))
	for _, hit := range hits {
		pm, ok := metas[hit.ID]
		if !ok || pm.UserID == viewerID {
			continue
		}
		cands = append(cands, ranking.Candidate{
			PostID:     hit.ID,
			Vector:     hit.Vector,
			Tags:       tagSet(povs[hit.ID]),
			Relevance:  hit.Score,
			Popularity: popularity(likeCounts[hit.ID], saveCounts[hit.ID]),
			Recency:    recencyScore(pm.CreatedAt, now),
		})
	}
	return cands
}

func tagSet(tags []string) map[string]bool {
	out := map[string]bool{}
	for _, tag := range tags {
		out[tag] = true
	}
	return out
}

func popularity(likes, saves int) float32 {
	return float32(likes+SavePopularityWeight*saves) / popularityScale
}

func recencyScore(createdAt, now time.Time) float32 {
	if createdAt.IsZero() {
		return 0
	}
	age := now.Sub(createdAt).Hours() / 24
	if age <= 0 {
		return 1
	}
	score := 1 - float32(age/30)
	if score < 0 {
		return 0
	}
	return score
}

func payloadCreatedAt(payload map[string]any) time.Time {
	switch v := payload["created_at"].(type) {
	case int64:
		return time.Unix(v, 0).UTC()
	case int:
		return time.Unix(int64(v), 0).UTC()
	case float64:
		return time.Unix(int64(v), 0).UTC()
	case string:
		if ts, err := strconv.ParseInt(v, 10, 64); err == nil {
			return time.Unix(ts, 0).UTC()
		}
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			return t
		}
	}
	return time.Time{}
}
