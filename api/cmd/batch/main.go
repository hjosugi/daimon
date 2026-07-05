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
	"daimon/api/internal/feedcore"
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
	povsByPost, err := feedcore.LoadPOVs(ctx, pool, ids)
	if err != nil {
		log.Printf("timeline: load povs: %v", err)
	}
	likeCounts, err := feedcore.LoadLikeCounts(ctx, pool, ids)
	if err != nil {
		log.Printf("timeline: load likes: %v", err)
	}
	saveCounts, err := feedcore.LoadSaveCounts(ctx, pool, ids)
	if err != nil {
		log.Printf("timeline: load saves: %v", err)
	}
	metas := feedcore.MetasFromHits(hits)
	now := time.Now().UTC()

	users := distinctPosters(ctx, pool)
	done := 0
	for _, uid := range users {
		// Blend the user's own-post centroid with their saved-post centroid
		// (saves are a stronger preference signal).
		ownCentroid, err := feedcore.UserCentroid(ctx, qc, uid)
		if err != nil {
			log.Printf("timeline: user centroid %s: %v", uid, err)
		}
		savedCentroid, err := feedcore.SavedCentroid(ctx, pool, qc, uid)
		if err != nil {
			log.Printf("timeline: saved centroid %s: %v", uid, err)
		}
		centroid := vec.BlendSaved(ownCentroid, savedCentroid)
		userTags, err := feedcore.UserTagSet(ctx, pool, uid)
		if err != nil {
			log.Printf("timeline: user tags %s: %v", uid, err)
		}

		cands := feedcore.BuildCandidates(hits, metas, povsByPost, likeCounts, saveCounts, uid, now)
		ranked := ranking.RankBySenseDistance(
			cands,
			centroid,
			userTags,
			feedcore.DefaultTimelineSimilarityWeight,
			true,
			false,
			feedcore.DefaultTimelineBridgeWeight,
			feedcore.DefaultTimelineTopK,
		)
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

func distinctPosters(ctx context.Context, pool *pgxpool.Pool) []string {
	out, err := dbq.QueryStrings(ctx, pool, dbq.SQL("batch.distinct_posters"))
	if err != nil {
		return nil
	}
	return out
}
