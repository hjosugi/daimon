package server

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
)

type timelineReq struct {
	QueryText        string  `json:"query_text"`
	SimilarityWeight float32 `json:"similarity_weight"`
	BoostPopular     bool    `json:"boost_popular"`
	IncludeFarPosts  bool    `json:"include_far_posts"`
}

type searchReq struct {
	Query string   `json:"query"`
	Povs  []string `json:"povs"`
	Limit int      `json:"limit"`
}

// ---- bulk loaders (avoid N+1) -------------------------------------------

type postMeta struct {
	userID, username, text string
	createdAt              time.Time
}

func (s *Server) loadPosts(ctx context.Context, ids []string) map[string]postMeta {
	m := map[string]postMeta{}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.load_posts"), ids)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var pm postMeta
		if rows.Scan(&id, &pm.userID, &pm.username, &pm.text, &pm.createdAt) == nil {
			m[id] = pm
		}
	}
	return m
}

func (s *Server) loadPOVs(ctx context.Context, ids []string) map[string][]string {
	m := map[string][]string{}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.load_povs"), ids)
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

func (s *Server) loadCounts(ctx context.Context, table string, ids []string) map[string]int {
	m := map[string]int{}
	var query string
	switch table {
	case "likes":
		query = dbq.SQL("feed.like_counts")
	case "comments":
		query = dbq.SQL("feed.comment_counts")
	case "bookmarks":
		query = dbq.SQL("feed.save_counts")
	default:
		return m
	}
	rows, err := s.pool.Query(ctx, query, ids)
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

func (s *Server) loadLikedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.liked_set"), ids, uid)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		if rows.Scan(&pid) == nil {
			m[pid] = true
		}
	}
	return m
}

func (s *Server) loadSavedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.saved_set"), ids, uid)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pid string
		if rows.Scan(&pid) == nil {
			m[pid] = true
		}
	}
	return m
}

func uniquePOVs(povs map[string][]string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, list := range povs {
		for _, pov := range list {
			if seen[pov] {
				continue
			}
			seen[pov] = true
			out = append(out, pov)
		}
	}
	return out
}

func (s *Server) loadPOVLikeCounts(ctx context.Context, povs []string) map[string]int {
	m := map[string]int{}
	if len(povs) == 0 {
		return m
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("pov_likes.counts"), povs)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pov string
		var n int
		if rows.Scan(&pov, &n) == nil {
			m[pov] = n
		}
	}
	return m
}

func (s *Server) loadPOVLikedSet(ctx context.Context, povs []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" || len(povs) == 0 {
		return m
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("pov_likes.liked_set"), povs, uid)
	if err != nil {
		return m
	}
	defer rows.Close()
	for rows.Next() {
		var pov string
		if rows.Scan(&pov) == nil {
			m[pov] = true
		}
	}
	return m
}

// bundle holds everything needed to render a set of posts (loaded in bulk).
type bundle struct {
	meta          map[string]postMeta
	povs          map[string][]string
	likeCounts    map[string]int
	commentCounts map[string]int
	liked         map[string]bool
	saved         map[string]bool
	povLikeCounts map[string]int
	povLiked      map[string]bool
}

func defaultTimelineQuery(q string) bool {
	q = strings.TrimSpace(strings.ToLower(q))
	return q == "" || q == "general interest"
}

func defaultTimelineKnobs(req timelineReq) bool {
	return defaultTimelineQuery(req.QueryText) &&
		req.BoostPopular &&
		req.SimilarityWeight > 0.69 &&
		req.SimilarityWeight < 0.71 &&
		!req.IncludeFarPosts
}

func qdrantPointToHit(p qdrant.Point, searchVector []float32) qdrant.Hit {
	return qdrant.Hit{
		ID:      p.ID,
		Score:   ranking.Cosine(searchVector, p.Vector),
		Vector:  p.Vector,
		Payload: p.Payload,
	}
}

func tagSetKeys(tags map[string]bool) []string {
	out := make([]string, 0, len(tags))
	for t := range tags {
		out = append(out, t)
	}
	return out
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

func povCoverageRate(tagList []string, userTags map[string]bool) float32 {
	if len(tagList) == 0 || len(userTags) == 0 {
		return 0
	}
	common := 0
	seen := map[string]bool{}
	for _, t := range tagList {
		if seen[t] {
			continue
		}
		seen[t] = true
		if userTags[t] {
			common++
		}
	}
	if len(seen) == 0 {
		return 0
	}
	return float32(common) / float32(len(seen))
}

func displayMatchRate(c ranking.Candidate, tagList []string, userTags map[string]bool) float32 {
	rate := c.SimToUser
	if rate <= 0 {
		rate = c.Relevance
	}
	if povRate := povCoverageRate(tagList, userTags); povRate > rate {
		rate = povRate
	}
	if rate < 0 {
		return 0
	}
	if rate > 1 {
		return 1
	}
	return rate
}

// loadBundle bulk-loads post metadata, POVs, counts and viewer-specific flags
// for a set of post IDs (the shared read path for timeline/search/profile).
func (s *Server) loadBundle(ctx context.Context, ids []string, uid string) bundle {
	povs := s.loadPOVs(ctx, ids)
	allPOVs := uniquePOVs(povs)
	return bundle{
		meta:          s.loadPosts(ctx, ids),
		povs:          povs,
		likeCounts:    s.loadCounts(ctx, "likes", ids),
		commentCounts: s.loadCounts(ctx, "comments", ids),
		liked:         s.loadLikedSet(ctx, ids, uid),
		saved:         s.loadSavedSet(ctx, ids, uid),
		povLikeCounts: s.loadPOVLikeCounts(ctx, allPOVs),
		povLiked:      s.loadPOVLikedSet(ctx, allPOVs, uid),
	}
}

func (b bundle) povStats(tagList []string) povStats {
	if len(tagList) == 0 {
		return nil
	}
	stats := make(povStats, len(tagList))
	for _, pov := range tagList {
		stats[pov] = povLikeSummary{
			Liked: b.povLiked[pov],
			Likes: b.povLikeCounts[pov],
		}
	}
	return stats
}

func meanVectors(vs [][]float32) []float32 {
	dim := 0
	for _, v := range vs {
		if len(v) > dim {
			dim = len(v)
		}
	}
	if dim == 0 {
		return nil
	}
	sum := make([]float32, dim)
	n := 0
	for _, v := range vs {
		if len(v) != dim {
			continue
		}
		for i := range v {
			sum[i] += v[i]
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

// userSense loads the user's POV set and centroid vector.
func (s *Server) userSense(ctx context.Context, uid string) (map[string]bool, []float32) {
	tags := map[string]bool{}
	if uid == "" {
		return tags, nil
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.user_povs"), uid)
	if err == nil {
		for rows.Next() {
			var pov string
			if rows.Scan(&pov) == nil {
				tags[pov] = true
			}
		}
		rows.Close()
	}
	var centroid []float32
	if pts, err := s.qdrant.UserPoints(ctx, uid, 200); err == nil && len(pts) > 0 {
		vs := make([][]float32, 0, len(pts))
		for _, p := range pts {
			if len(p.Vector) > 0 {
				vs = append(vs, p.Vector)
			}
		}
		centroid = meanVectors(vs)
	}
	return tags, centroid
}

// savedCentroid returns the mean vector of the posts a user has saved.
// A save is a stronger preference signal than a like, so the timeline blends
// this into the user's "sense" to surface more of what they clip.
func (s *Server) savedCentroid(ctx context.Context, uid string) []float32 {
	if uid == "" {
		return nil
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.user_saved_ids"), uid)
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
	pts, err := s.qdrant.Retrieve(ctx, ids, true)
	if err != nil || len(pts) == 0 {
		return nil
	}
	vs := make([][]float32, 0, len(pts))
	for _, p := range pts {
		if len(p.Vector) > 0 {
			vs = append(vs, p.Vector)
		}
	}
	return meanVectors(vs)
}

// blendCentroids combines the user's own-post centroid with their saved-post
// centroid, weighting saves higher (a stronger preference signal).
func blendCentroids(post, saved []float32) []float32 {
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

// userTagSet loads just the user's POV set (no Qdrant centroid call).
func (s *Server) userTagSet(ctx context.Context, uid string) map[string]bool {
	tags := map[string]bool{}
	if uid == "" {
		return tags
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.user_povs"), uid)
	if err == nil {
		for rows.Next() {
			var pov string
			if rows.Scan(&pov) == nil {
				tags[pov] = true
			}
		}
		rows.Close()
	}
	return tags
}

// materializeIDs builds responses for a fixed, ordered list of post IDs
// (used for the precomputed-feed cache fast path). Counts are always fresh.
func (s *Server) materializeIDs(ctx context.Context, ids []string, uid string) []postResp {
	b := s.loadBundle(ctx, ids, uid)
	userTags := s.userTagSet(ctx, uid)

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm, ok := b.meta[id]
		if !ok || pm.userID == uid {
			continue
		}
		tagList := b.povs[id]
		common := intersect(tagList, userTags)
		var mr *matchReason
		if len(common) > 0 {
			rate := povCoverageRate(tagList, userTags)
			mr = &matchReason{PovMatches: common, CommonPovs: common, PovMatchRate: &rate, MatchedBy: "both"}
		}
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: tagList, UserID: pm.userID, Username: pm.username,
			Likes: b.likeCounts[id], Liked: b.liked[id], Saved: b.saved[id],
			CommentCount: b.commentCounts[id], POVStats: b.povStats(tagList),
			MatchReason: mr, CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	return out
}

func intersect(tags []string, set map[string]bool) []string {
	out := []string{}
	for _, t := range tags {
		if set[t] {
			out = append(out, t)
		}
	}
	return out
}

func (s *Server) recentPopularMatchedPostIDs(ctx context.Context, uid string, userTags map[string]bool, limit int) []string {
	tags := tagSetKeys(userTags)
	if uid == "" || len(tags) == 0 || limit <= 0 {
		return nil
	}
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.recent_popular_matched_ids"), uid, tags, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

// ---- handlers ------------------------------------------------------------

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
	var req timelineReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ctx := r.Context()
	uid := userID(ctx)

	// Fast path: serve the batch-precomputed home feed (default knobs).
	// Discovery mode (include_far_posts) always computes live.
	if uid != "" && defaultTimelineKnobs(req) {
		var ids []string
		if s.cache.GetJSON(ctx, "feed:"+uid, &ids) && len(ids) > 0 {
			if out := s.materializeIDs(ctx, ids, uid); len(out) > 0 {
				httpx.JSON(w, http.StatusOK, out)
				return
			}
		}
	}

	vector, err := s.embed.Embed(ctx, req.QueryText)
	if err != nil {
		httpx.JSON(w, http.StatusOK, []postResp{}) // degrade gracefully
		return
	}
	userTags, centroid := s.userSense(ctx, uid)
	// Saves are a strong preference signal: blend the saved-post centroid in.
	centroid = blendCentroids(centroid, s.savedCentroid(ctx, uid))
	searchVector := vector
	if uid != "" && len(centroid) > 0 && defaultTimelineQuery(req.QueryText) {
		searchVector = centroid
	}

	limit := 100
	if req.IncludeFarPosts {
		limit = 200
	}
	hits, err := s.qdrant.Search(ctx, searchVector, limit, nil, true)
	if err != nil || len(hits) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	seenHits := map[string]bool{}
	for _, h := range hits {
		seenHits[h.ID] = true
	}
	if req.BoostPopular && uid != "" && len(userTags) > 0 {
		if pts, err := s.qdrant.Retrieve(ctx, s.recentPopularMatchedPostIDs(ctx, uid, userTags, 80), true); err == nil {
			for _, p := range pts {
				if seenHits[p.ID] || len(p.Vector) == 0 {
					continue
				}
				seenHits[p.ID] = true
				hits = append(hits, qdrantPointToHit(p, searchVector))
			}
		}
	}

	ids := make([]string, 0, len(hits))
	for _, h := range hits {
		ids = append(ids, h.ID)
	}
	b := s.loadBundle(ctx, ids, uid)
	saveCounts := s.loadCounts(ctx, "bookmarks", ids)

	cands := make([]ranking.Candidate, 0, len(hits))
	now := time.Now().UTC()
	for _, h := range hits {
		pm, ok := b.meta[h.ID]
		if !ok || pm.userID == uid {
			continue
		}
		tagSet := map[string]bool{}
		for _, p := range b.povs[h.ID] {
			tagSet[p] = true
		}
		// A save counts ~3x a like as a quality/preference signal.
		pop := float32(b.likeCounts[h.ID]+3*saveCounts[h.ID]) / 10.0
		cands = append(cands, ranking.Candidate{
			PostID: h.ID, Vector: h.Vector, Tags: tagSet, Relevance: h.Score, Popularity: pop, Recency: recencyScore(pm.createdAt, now),
		})
	}

	ranked := ranking.RankBySenseDistance(cands, centroid, userTags,
		req.SimilarityWeight, req.BoostPopular, req.IncludeFarPosts, 0.3, 10)

	out := make([]postResp, 0, len(ranked))
	for _, c := range ranked {
		out = append(out, s.materialize(c, b, userTags))
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (s *Server) materialize(c ranking.Candidate, b bundle, userTags map[string]bool) postResp {
	pm := b.meta[c.PostID]
	tagList := b.povs[c.PostID]
	common := intersect(tagList, userTags)
	score := c.Relevance
	sd := 1 - c.SimToUser
	bridge := c.BridgeScore > 0
	reason := c.Reason
	matchRate := displayMatchRate(c, tagList, userTags)
	return postResp{
		ID: c.PostID, Text: pm.text, Povs: tagList, UserID: pm.userID, Username: pm.username,
		Score: &score, Likes: b.likeCounts[c.PostID], Liked: b.liked[c.PostID],
		Saved: b.saved[c.PostID], CommentCount: b.commentCounts[c.PostID],
		POVStats: b.povStats(tagList),
		MatchReason: &matchReason{
			PovMatches: common, CommonPovs: common, PovMatchRate: &matchRate, MatchedBy: "both",
			Reason: &reason, SenseDistance: &sd, IsBridge: &bridge,
		},
		CreatedAt: pm.createdAt.Format(time.RFC3339),
	}
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	var req searchReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	ctx := r.Context()
	uid := userID(ctx)
	userTags, _ := s.userSense(ctx, uid)

	var ids []string
	scores := map[string]float32{}

	if req.Query != "" {
		vector, err := s.embed.Embed(ctx, req.Query)
		if err != nil {
			httpx.JSON(w, http.StatusOK, []postResp{})
			return
		}
		hits, err := s.qdrant.Search(ctx, vector, min(req.Limit*3, 200), req.Povs, false)
		if err != nil {
			httpx.JSON(w, http.StatusOK, []postResp{})
			return
		}
		for _, h := range hits {
			ids = append(ids, h.ID)
			scores[h.ID] = h.Score
		}
		if len(req.Povs) == 0 {
			rows, err := s.pool.Query(ctx, dbq.SQL("feed.search_query_pov_ids"), req.Query, req.Limit)
			if err == nil {
				seen := map[string]bool{}
				for _, id := range ids {
					seen[id] = true
				}
				var povIDs []string
				for rows.Next() {
					var pid string
					if rows.Scan(&pid) == nil && !seen[pid] {
						seen[pid] = true
						povIDs = append(povIDs, pid)
					}
				}
				rows.Close()
				ids = append(povIDs, ids...)
			}
		}
	} else if len(req.Povs) > 0 {
		rows, err := s.pool.Query(ctx, dbq.SQL("feed.search_pov_ids"), req.Povs, req.Limit)
		if err == nil {
			for rows.Next() {
				var pid string
				if rows.Scan(&pid) == nil {
					ids = append(ids, pid)
				}
			}
			rows.Close()
		}
	}
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	b := s.loadBundle(ctx, ids, uid)
	querySet := map[string]bool{}
	for _, p := range req.Povs {
		querySet[p] = true
	}

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm, ok := b.meta[id]
		if !ok {
			continue
		}
		tagList := b.povs[id]
		// "why": POVs matching the query, else common with the user.
		common := intersect(tagList, querySet)
		if len(common) == 0 {
			common = intersect(tagList, userTags)
		}
		var score *float32
		if sc, ok := scores[id]; ok && pm.userID != uid {
			s := sc
			score = &s
		}
		var mr *matchReason
		if pm.userID != uid {
			rate := povCoverageRate(tagList, userTags)
			if sc, ok := scores[id]; ok && sc > rate {
				rate = sc
			}
			mr = &matchReason{PovMatches: common, CommonPovs: common, PovMatchRate: &rate, MatchedBy: "tag"}
		}
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: tagList, UserID: pm.userID, Username: pm.username,
			Score: score, Likes: b.likeCounts[id], Liked: b.liked[id], Saved: b.saved[id],
			CommentCount: b.commentCounts[id], POVStats: b.povStats(tagList),
			MatchReason: mr, CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	if req.Query != "" {
		// Text search: rank by semantic relevance (highest cosine first).
		// Sorting by date here would throw away the vector ranking entirely.
		sort.SliceStable(out, func(a, b int) bool {
			return scores[out[a].ID] > scores[out[b].ID]
		})
	} else {
		// POV-only search has no relevance score: newest first.
		sort.SliceStable(out, func(a, b int) bool { return out[a].CreatedAt > out[b].CreatedAt })
	}
	httpx.JSON(w, http.StatusOK, out)
}

// handleUserPosts returns a user's own posts (newest first).
func (s *Server) handleUserPosts(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "userID")
	ctx := r.Context()
	rows, err := s.pool.Query(ctx, dbq.SQL("feed.user_post_ids"), target)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
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
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}
	b := s.loadBundle(ctx, ids, userID(ctx))

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm := b.meta[id]
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: b.povs[id], UserID: pm.userID, Username: pm.username,
			Likes: b.likeCounts[id], Liked: b.liked[id], Saved: b.saved[id],
			CommentCount: b.commentCounts[id], POVStats: b.povStats(b.povs[id]),
			CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}
