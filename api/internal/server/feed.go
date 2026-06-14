package server

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"

	"daimon/api/internal/httpx"
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
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, COALESCE(username,''), text, created_at FROM posts WHERE id = ANY($1)`, ids)
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
	rows, err := s.pool.Query(ctx, `SELECT post_id, pov FROM povs WHERE post_id = ANY($1)`, ids)
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
	rows, err := s.pool.Query(ctx,
		`SELECT post_id, count(*) FROM `+table+` WHERE post_id = ANY($1) GROUP BY post_id`, ids)
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
	rows, err := s.pool.Query(ctx,
		`SELECT post_id FROM likes WHERE post_id = ANY($1) AND user_id=$2`, ids, uid)
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
	rows, err := s.pool.Query(ctx,
		`SELECT p.pov FROM povs p JOIN posts po ON po.id = p.post_id WHERE po.user_id=$1`, uid)
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

func intersect(tags []string, set map[string]bool) []string {
	out := []string{}
	for _, t := range tags {
		if set[t] {
			out = append(out, t)
		}
	}
	return out
}

// ---- handlers ------------------------------------------------------------

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
	var req timelineReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ctx := r.Context()
	uid := userID(ctx)

	vector, err := s.embed.Embed(ctx, req.QueryText)
	if err != nil {
		httpx.JSON(w, http.StatusOK, []postResp{}) // degrade gracefully
		return
	}
	userTags, centroid := s.userSense(ctx, uid)

	limit := 100
	if req.IncludeFarPosts {
		limit = 200
	}
	hits, err := s.qdrant.Search(ctx, vector, limit, nil, true)
	if err != nil || len(hits) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	ids := make([]string, 0, len(hits))
	for _, h := range hits {
		ids = append(ids, h.ID)
	}
	meta := s.loadPosts(ctx, ids)
	povs := s.loadPOVs(ctx, ids)
	likeCounts := s.loadCounts(ctx, "likes", ids)
	commentCounts := s.loadCounts(ctx, "comments", ids)
	liked := s.loadLikedSet(ctx, ids, uid)

	cands := make([]candidate, 0, len(hits))
	for _, h := range hits {
		pm, ok := meta[h.ID]
		if !ok || pm.userID == uid {
			continue
		}
		tagSet := map[string]bool{}
		for _, p := range povs[h.ID] {
			tagSet[p] = true
		}
		pop := float32(likeCounts[h.ID]) / 10.0
		cands = append(cands, candidate{
			postID: h.ID, vector: h.Vector, tags: tagSet, relevance: h.Score, popularity: pop,
		})
	}

	ranked := rankBySenseDistance(cands, centroid, userTags,
		req.SimilarityWeight, req.BoostPopular, req.IncludeFarPosts, 0.3, 10)

	out := make([]postResp, 0, len(ranked))
	for _, c := range ranked {
		out = append(out, s.materialize(c, meta, povs, likeCounts, commentCounts, liked, userTags))
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (s *Server) materialize(c candidate, meta map[string]postMeta, povs map[string][]string,
	likeCounts, commentCounts map[string]int, liked map[string]bool, userTags map[string]bool) postResp {
	pm := meta[c.postID]
	tagList := povs[c.postID]
	common := intersect(tagList, userTags)
	score := c.relevance
	sd := 1 - c.simToUser
	bridge := c.bridgeScore > 0
	reason := c.reason
	return postResp{
		ID: c.postID, Text: pm.text, Povs: tagList, UserID: pm.userID, Username: pm.username,
		Score: &score, Likes: likeCounts[c.postID], Liked: liked[c.postID],
		CommentCount: commentCounts[c.postID],
		MatchReason: &matchReason{
			PovMatches: common, CommonPovs: common, MatchedBy: "both",
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
	} else if len(req.Povs) > 0 {
		rows, err := s.pool.Query(ctx,
			`SELECT DISTINCT post_id FROM povs WHERE pov = ANY($1) LIMIT $2`, req.Povs, req.Limit)
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

	meta := s.loadPosts(ctx, ids)
	povs := s.loadPOVs(ctx, ids)
	likeCounts := s.loadCounts(ctx, "likes", ids)
	commentCounts := s.loadCounts(ctx, "comments", ids)
	liked := s.loadLikedSet(ctx, ids, uid)
	querySet := map[string]bool{}
	for _, p := range req.Povs {
		querySet[p] = true
	}

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm, ok := meta[id]
		if !ok {
			continue
		}
		tagList := povs[id]
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
			mr = &matchReason{PovMatches: common, CommonPovs: common, MatchedBy: "tag"}
		}
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: tagList, UserID: pm.userID, Username: pm.username,
			Score: score, Likes: likeCounts[id], Liked: liked[id], CommentCount: commentCounts[id],
			MatchReason: mr, CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	// Newest first (vector order already approximates relevance; this keeps it stable).
	sort.SliceStable(out, func(a, b int) bool { return out[a].CreatedAt > out[b].CreatedAt })
	httpx.JSON(w, http.StatusOK, out)
}

// handleUserPosts returns a user's own posts (newest first).
func (s *Server) handleUserPosts(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "userID")
	ctx := r.Context()
	rows, err := s.pool.Query(ctx,
		`SELECT id FROM posts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, target)
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
	meta := s.loadPosts(ctx, ids)
	povs := s.loadPOVs(ctx, ids)
	likeCounts := s.loadCounts(ctx, "likes", ids)
	commentCounts := s.loadCounts(ctx, "comments", ids)
	liked := s.loadLikedSet(ctx, ids, userID(ctx))

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm := meta[id]
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: povs[id], UserID: pm.userID, Username: pm.username,
			Likes: likeCounts[id], Liked: liked[id], CommentCount: commentCounts[id],
			CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}
