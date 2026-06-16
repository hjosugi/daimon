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
	deepAnalyzeJob(ctx, pool, em)
	suggestJob(ctx, pool, em, ca)
	timelineJob(ctx, pool, qc, em, ca)
	log.Printf("batch done in %s", time.Since(start).Round(time.Millisecond))
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
	deepMaxChunks = 4     // cap chunks analyzed per post
	deepMaxPOVs   = 12    // cap new POVs per post
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
	if len(posts) == 0 {
		return
	}

	now := time.Now().UTC()
	inserted := 0
	for _, p := range posts {
		seen := map[string]bool{}
		for _, chunk := range chunkRunes(p.text, deepChunkRune, deepMaxChunks) {
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

// chunkRunes splits s into rune-bounded windows (max maxChunks), so multibyte
// (Japanese) text is never cut mid-character.
func chunkRunes(s string, size, maxChunks int) []string {
	r := []rune(s)
	if len(r) <= size {
		return []string{s}
	}
	out := make([]string, 0, maxChunks)
	for i := 0; i < len(r) && len(out) < maxChunks; i += size {
		end := i + size
		if end > len(r) {
			end = len(r)
		}
		out = append(out, string(r[i:end]))
	}
	return out
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
		centroid := blendVectors(userCentroid(ctx, qc, uid), savedCentroid(ctx, pool, qc, uid))
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
	return m
}

// savedCentroid returns the mean vector of the user's saved posts.
func savedCentroid(ctx context.Context, pool *pgxpool.Pool, qc *qdrant.Client, uid string) []float32 {
	rows, err := pool.Query(ctx, dbq.SQL("feed.user_saved_ids"), uid)
	if err != nil {
		return nil
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	if len(ids) == 0 {
		return nil
	}
	pts, err := qc.Retrieve(ctx, ids, true)
	if err != nil || len(pts) == 0 {
		return nil
	}
	var dim int
	for _, p := range pts {
		if len(p.Vector) > dim {
			dim = len(p.Vector)
		}
	}
	if dim == 0 {
		return nil
	}
	sum := make([]float32, dim)
	n := 0
	for _, p := range pts {
		if len(p.Vector) != dim {
			continue
		}
		for i, v := range p.Vector {
			sum[i] += v
		}
		n++
	}
	if n == 0 {
		return nil
	}
	for i := range sum {
		sum[i] /= float32(n)
	}
	return sum
}

// blendVectors blends the own-post centroid with the saved centroid (saves weighted higher).
func blendVectors(post, saved []float32) []float32 {
	if len(saved) == 0 {
		return post
	}
	if len(post) == 0 {
		return saved
	}
	n := len(post)
	if len(saved) < n {
		n = len(saved)
	}
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		out[i] = 0.4*post[i] + 0.6*saved[i]
	}
	return out
}

func distinctPosters(ctx context.Context, pool *pgxpool.Pool) []string {
	rows, err := pool.Query(ctx, dbq.SQL("batch.distinct_posters"))
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var u string
		if rows.Scan(&u) == nil {
			out = append(out, u)
		}
	}
	return out
}

func userTagSet(ctx context.Context, pool *pgxpool.Pool, uid string) map[string]bool {
	tags := map[string]bool{}
	rows, err := pool.Query(ctx, dbq.SQL("feed.user_povs"), uid)
	if err != nil {
		return tags
	}
	defer rows.Close()
	for rows.Next() {
		var pov string
		if rows.Scan(&pov) == nil {
			tags[pov] = true
		}
	}
	return tags
}

func userCentroid(ctx context.Context, qc *qdrant.Client, uid string) []float32 {
	pts, err := qc.UserPoints(ctx, uid, 200)
	if err != nil || len(pts) == 0 {
		return nil
	}
	var dim int
	for _, p := range pts {
		if len(p.Vector) > dim {
			dim = len(p.Vector)
		}
	}
	if dim == 0 {
		return nil
	}
	sum := make([]float32, dim)
	n := 0
	for _, p := range pts {
		if len(p.Vector) != dim {
			continue
		}
		for i, v := range p.Vector {
			sum[i] += v
		}
		n++
	}
	if n == 0 {
		return nil
	}
	for i := range sum {
		sum[i] /= float32(n)
	}
	return sum
}
