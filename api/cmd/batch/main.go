// Command batch precomputes expensive read models into Redis:
//   - suggest:popular            most-used POVs
//   - suggest:related:{pov}      vector-nearest POVs (semantic suggestions)
//   - feed:{userId}              the Sense-Distance home feed per user
//
// Run on a schedule (Cloud Run Jobs + Cloud Scheduler) or locally via `make batch`.
package main

import (
	"context"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/cache"
	"daimon/api/internal/config"
	dbq "daimon/api/internal/db"
	"daimon/api/internal/embed"
	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
	"daimon/api/internal/vec"
)

const ttl = time.Hour

func main() {
	cfg := config.FromEnv()
	ctx := context.Background()

	ca := cache.New(cfg.RedisURL)
	if !ca.Enabled() {
		log.Fatal("batch requires REDIS_URL")
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	qc := qdrant.New(cfg.QdrantURL, cfg.QdrantAPIKey)
	em := embed.New(cfg.EmbedURL)

	start := time.Now()
	sessionCleanupJob(ctx, pool)
	deepAnalyzeJob(ctx, pool, em)
	suggestJob(ctx, pool, em, ca)
	timelineJob(ctx, pool, qc, em, ca)
	log.Printf("batch done in %s", time.Since(start).Round(time.Millisecond))
}

func sessionCleanupJob(ctx context.Context, pool *pgxpool.Pool) {
	tag, err := pool.Exec(ctx, dbq.SQL("auth.delete_expired_sessions"), time.Now().UTC())
	if err != nil {
		log.Printf("sessions cleanup: %v", err)
		return
	}
	log.Printf("sessions cleanup: removed %d expired sessions", tag.RowsAffected())
}

// ---- deep analysis: decompose long posts into multiple 観点 (POVs) --------

// Long, in-depth posts usually argue several distinct viewpoints. The ML /povs
// endpoint only sees a slice of text per call, so we chunk the full post and
// union the extracted POVs — turning one deep post into several POV "nodes"
// people can discover and discuss along. Re-runnable: inserts are deduped.
const (
	deepMinChars  = 1500 // only posts longer than this are worth decomposing
	deepMaxPosts  = 400  // bound work per batch run
	deepChunkRune = 2000 // ~one analysis window
	deepMaxChunks = 4    // cap chunks analyzed per post
	deepMaxPOVs   = 12   // cap new POVs per post
)

func deepAnalyzeJob(ctx context.Context, pool *pgxpool.Pool, em *embed.Client) {
	rows, err := pool.Query(ctx, dbq.SQL("batch.long_posts"), deepMinChars, deepMaxPosts)
	if err != nil {
		log.Printf("deep-analyze: %v", err)
		return
	}
	type post struct{ id, text string }
	var posts []post
	for rows.Next() {
		var p post
		if rows.Scan(&p.id, &p.text) == nil {
			posts = append(posts, p)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		log.Printf("deep-analyze rows: %v", err)
		return
	}
	if len(posts) == 0 {
		return
	}

	now := time.Now().UTC()
	inserted := 0
	for _, p := range posts {
		seen := map[string]bool{}
		for _, chunk := range vec.ChunkRunes(p.text, deepChunkRune, deepMaxChunks) {
			povs, err := em.POVs(ctx, chunk)
			if err != nil {
				continue
			}
			for _, pov := range povs {
				if seen[pov] || len(seen) >= deepMaxPOVs {
					continue
				}
				seen[pov] = true
				if _, err := pool.Exec(ctx, dbq.SQL("batch.insert_auto_pov"),
					uuid.NewString(), p.id, pov, now); err == nil {
					inserted++
				}
			}
		}
	}
	log.Printf("deep-analyze: extracted %d auto-POVs from %d long posts", inserted, len(posts))
}

// ---- suggest: popular + vector-related POVs ------------------------------

func suggestJob(ctx context.Context, pool *pgxpool.Pool, em *embed.Client, ca *cache.Cache) {
	rows, err := pool.Query(ctx, dbq.SQL("batch.popular_povs"))
	if err != nil {
		log.Printf("suggest: %v", err)
		return
	}
	type pc struct {
		pov string
		c   int
	}
	var list []pc
	for rows.Next() {
		var p pc
		if rows.Scan(&p.pov, &p.c) == nil {
			list = append(list, p)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		log.Printf("suggest rows: %v", err)
		return
	}
	if len(list) == 0 {
		return
	}

	popular := make([]string, 0, 50)
	for _, p := range list[:min(50, len(list))] {
		popular = append(popular, p.pov)
	}
	ca.SetJSON(ctx, "suggest:popular", popular, ttl)

	// Embed the top POVs and cache each one's nearest neighbors.
	n := min(150, len(list))
	vecs := make([][]float32, n)
	for i := 0; i < n; i++ {
		if v, err := em.Embed(ctx, list[i].pov); err == nil {
			vecs[i] = v
		}
	}
	for i := 0; i < n; i++ {
		if vecs[i] == nil {
			continue
		}
		type sc struct {
			pov string
			s   float32
		}
		var sims []sc
		for j := 0; j < n; j++ {
			if i == j || vecs[j] == nil {
				continue
			}
			sims = append(sims, sc{list[j].pov, ranking.Cosine(vecs[i], vecs[j])})
		}
		sort.Slice(sims, func(a, b int) bool { return sims[a].s > sims[b].s })
		related := make([]string, 0, 6)
		for _, s := range sims[:min(6, len(sims))] {
			related = append(related, s.pov)
		}
		ca.SetJSON(ctx, "suggest:related:"+strings.ToLower(list[i].pov), related, ttl)
	}
	log.Printf("suggest: cached popular(%d) + related for %d POVs", len(popular), n)
}

// ---- timeline: precompute the home feed per user -------------------------

func timelineJob(ctx context.Context, pool *pgxpool.Pool, qc *qdrant.Client, em *embed.Client, ca *cache.Cache) {
	gv, err := em.Embed(ctx, "General interest")
	if err != nil {
		log.Printf("timeline: embed: %v", err)
		return
	}
	hits, err := qc.Search(ctx, gv, 200, nil, true)
	if err != nil || len(hits) == 0 {
		log.Printf("timeline: search: %v", err)
		return
	}

	ids := make([]string, 0, len(hits))
	for _, h := range hits {
		ids = append(ids, h.ID)
	}
	povsByPost := loadPOVs(ctx, pool, ids)
	likeCounts := loadLikeCounts(ctx, pool, ids)
	saveCounts := loadSaveCounts(ctx, pool, ids)

	users := distinctPosters(ctx, pool)
	done := 0
	for _, uid := range users {
		// Blend the user's own-post centroid with their saved-post centroid
		// (saves are a stronger preference signal).
		centroid := vec.BlendSaved(userCentroid(ctx, qc, uid), savedCentroid(ctx, pool, qc, uid))
		userTags := userTagSet(ctx, pool, uid)

		cands := make([]ranking.Candidate, 0, len(hits))
		for _, h := range hits {
			if owner, _ := h.Payload["user_id"].(string); owner == uid {
				continue
			}
			tagSet := map[string]bool{}
			for _, p := range povsByPost[h.ID] {
				tagSet[p] = true
			}
			cands = append(cands, ranking.Candidate{
				PostID: h.ID, Vector: h.Vector, Tags: tagSet,
				Relevance:  h.Score,
				Popularity: float32(likeCounts[h.ID]+3*saveCounts[h.ID]) / 10.0,
			})
		}
		ranked := ranking.RankBySenseDistance(cands, centroid, userTags, 0.7, true, false, 0.3, 10)
		feedIDs := make([]string, 0, len(ranked))
		for _, c := range ranked {
			feedIDs = append(feedIDs, c.PostID)
		}
		if len(feedIDs) > 0 {
			ca.SetJSON(ctx, "feed:"+uid, feedIDs, ttl)
			done++
		}
	}
	log.Printf("timeline: precomputed feeds for %d/%d users", done, len(users))
}

// ---- small helpers -------------------------------------------------------

func loadPOVs(ctx context.Context, pool *pgxpool.Pool, ids []string) map[string][]string {
	m := map[string][]string{}
	rows, err := pool.Query(ctx, dbq.SQL("feed.load_povs"), ids)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pid, pov string
		if rows.Scan(&pid, &pov) == nil {
			m[pid] = append(m[pid], pov)
		}
	}
	if err := rows.Err(); err != nil {
		return m
	}
	return m
}

func loadLikeCounts(ctx context.Context, pool *pgxpool.Pool, ids []string) map[string]int {
	m := map[string]int{}
	rows, err := pool.Query(ctx, dbq.SQL("feed.like_counts"), ids)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		var n int
		if rows.Scan(&pid, &n) == nil {
			m[pid] = n
		}
	}
	if err := rows.Err(); err != nil {
		return m
	}
	return m
}

func loadSaveCounts(ctx context.Context, pool *pgxpool.Pool, ids []string) map[string]int {
	m := map[string]int{}
	rows, err := pool.Query(ctx, dbq.SQL("feed.save_counts"), ids)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		var n int
		if rows.Scan(&pid, &n) == nil {
			m[pid] = n
		}
	}
	if err := rows.Err(); err != nil {
		return m
	}
	return m
}

// savedCentroid returns the mean vector of the user's saved posts.
func savedCentroid(ctx context.Context, pool *pgxpool.Pool, qc *qdrant.Client, uid string) []float32 {
	ids, err := dbq.QueryStrings(ctx, pool, dbq.SQL("feed.user_saved_ids"), uid)
	if err != nil {
		return nil
	}
	if len(ids) == 0 {
		return nil
	}
	pts, err := qc.Retrieve(ctx, ids, true)
	if err != nil || len(pts) == 0 {
		return nil
	}
	return vec.Mean(pointVectors(pts))
}

func distinctPosters(ctx context.Context, pool *pgxpool.Pool) []string {
	out, err := dbq.QueryStrings(ctx, pool, dbq.SQL("batch.distinct_posters"))
	if err != nil {
		return nil
	}
	return out
}

func userTagSet(ctx context.Context, pool *pgxpool.Pool, uid string) map[string]bool {
	tags := map[string]bool{}
	povs, err := dbq.QueryStrings(ctx, pool, dbq.SQL("feed.user_povs"), uid)
	if err != nil {
		return tags
	}
	for _, pov := range povs {
		tags[pov] = true
	}
	return tags
}

func userCentroid(ctx context.Context, qc *qdrant.Client, uid string) []float32 {
	pts, err := qc.UserPoints(ctx, uid, 200)
	if err != nil || len(pts) == 0 {
		return nil
	}
	return vec.Mean(pointVectors(pts))
}

// pointVectors extracts the non-empty vectors from a slice of Qdrant points.
func pointVectors(pts []qdrant.Point) [][]float32 {
	vs := make([][]float32, 0, len(pts))
	for _, p := range pts {
		if len(p.Vector) > 0 {
			vs = append(vs, p.Vector)
		}
	}
	return vs
}
