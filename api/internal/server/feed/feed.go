package feed

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
	"daimon/api/internal/vec"
)

func (h *Handler) HandleTimeline(w http.ResponseWriter, r *http.Request) {
	var req timelineReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ctx := r.Context()
	uid := session.UserID(ctx)

	if out, ok := h.cachedTimeline(ctx, uid, req); ok {
		httpx.JSON(w, http.StatusOK, out)
		return
	}

	vector, err := h.embed.Embed(ctx, req.QueryText)
	if err != nil {
		respond.Warn(h.logger, r, "timeline embedding failed", err)
		httpx.JSON(w, http.StatusOK, []postResp{}) // degrade gracefully
		return
	}

	userTags, centroid, searchVector := h.resolveTimelineVector(ctx, uid, req, vector)
	hits, ok := h.gatherTimelineHits(ctx, r, uid, req, searchVector, userTags)
	if !ok {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	out := h.rankAndMaterializeTimeline(ctx, uid, req, hits, centroid, userTags)
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) cachedTimeline(ctx context.Context, uid string, req timelineReq) ([]postResp, bool) {
	// Fast path: serve the batch-precomputed home feed (default knobs).
	// Discovery mode (include_far_posts) always computes live.
	if uid == "" || !defaultTimelineKnobs(req) {
		return nil, false
	}
	var ids []string
	if h.cache.GetJSON(ctx, "feed:"+uid, &ids) && len(ids) > 0 {
		if out := h.materializeIDs(ctx, ids, uid); len(out) > 0 {
			return out, true
		}
	}
	return nil, false
}

func (h *Handler) resolveTimelineVector(ctx context.Context, uid string, req timelineReq, queryVector []float32) (map[string]bool, []float32, []float32) {
	userTags, centroid := h.userSense(ctx, uid)
	// Saves are a strong preference signal: blend the saved-post centroid in.
	centroid = vec.BlendSaved(centroid, h.savedCentroid(ctx, uid))
	searchVector := queryVector
	if uid != "" && len(centroid) > 0 && defaultTimelineQuery(req.QueryText) {
		searchVector = centroid
	}
	return userTags, centroid, searchVector
}

func timelineSearchLimit(req timelineReq) int {
	if req.IncludeFarPosts {
		return 200
	}
	return 100
}

func (h *Handler) gatherTimelineHits(ctx context.Context, r *http.Request, uid string, req timelineReq, searchVector []float32, userTags map[string]bool) ([]qdrant.Hit, bool) {
	hits, err := h.qdrant.Search(ctx, searchVector, timelineSearchLimit(req), nil, true)
	if err != nil || len(hits) == 0 {
		if err != nil {
			respond.Warn(h.logger, r, "timeline qdrant search failed", err)
		}
		return nil, false
	}
	hits = h.appendPopularTimelineHits(ctx, r, uid, req, searchVector, userTags, hits)
	return hits, true
}

func (h *Handler) appendPopularTimelineHits(ctx context.Context, r *http.Request, uid string, req timelineReq, searchVector []float32, userTags map[string]bool, hits []qdrant.Hit) []qdrant.Hit {
	seenHits := map[string]bool{}
	for _, hit := range hits {
		seenHits[hit.ID] = true
	}
	if req.BoostPopular && uid != "" && len(userTags) > 0 {
		if pts, err := h.qdrant.Retrieve(ctx, h.recentPopularMatchedPostIDs(ctx, uid, userTags, 80), true); err == nil {
			for _, p := range pts {
				if seenHits[p.ID] || len(p.Vector) == 0 {
					continue
				}
				seenHits[p.ID] = true
				hits = append(hits, qdrantPointToHit(p, searchVector))
			}
		} else {
			respond.Warn(h.logger, r, "timeline popular qdrant retrieve failed", err)
		}
	}
	return hits
}

func (h *Handler) rankAndMaterializeTimeline(ctx context.Context, uid string, req timelineReq, hits []qdrant.Hit, centroid []float32, userTags map[string]bool) []postResp {
	ids := make([]string, 0, len(hits))
	for _, hit := range hits {
		ids = append(ids, hit.ID)
	}
	b := h.loadBundle(ctx, ids, uid)
	saveCounts := h.loadCounts(ctx, "bookmarks", ids)

	cands := buildTimelineCandidates(hits, b, saveCounts, uid, time.Now().UTC())
	ranked := ranking.RankBySenseDistance(cands, centroid, userTags,
		req.SimilarityWeight, req.BoostPopular, req.IncludeFarPosts, 0.3, 10)

	out := make([]postResp, 0, len(ranked))
	for _, c := range ranked {
		out = append(out, h.materialize(c, b, userTags))
	}
	return out
}

func buildTimelineCandidates(hits []qdrant.Hit, b bundle, saveCounts map[string]int, uid string, now time.Time) []ranking.Candidate {
	cands := make([]ranking.Candidate, 0, len(hits))
	for _, hit := range hits {
		pm, ok := b.meta[hit.ID]
		if !ok || pm.userID == uid {
			continue
		}
		tagSet := map[string]bool{}
		for _, pov := range b.povs[hit.ID] {
			tagSet[pov] = true
		}
		// A save counts ~3x a like as a quality/preference signal.
		pop := float32(b.likeCounts[hit.ID]+3*saveCounts[hit.ID]) / 10.0
		cands = append(cands, ranking.Candidate{
			PostID:     hit.ID,
			Vector:     hit.Vector,
			Tags:       tagSet,
			Relevance:  hit.Score,
			Popularity: pop,
			Recency:    recencyScore(pm.createdAt, now),
		})
	}
	return cands
}

func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	var req searchReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	ctx := r.Context()
	uid := session.UserID(ctx)
	userTags, _ := h.userSense(ctx, uid)

	var ids []string
	scores := map[string]float32{}

	if req.Query != "" {
		vector, err := h.embed.Embed(ctx, req.Query)
		if err != nil {
			respond.Warn(h.logger, r, "search embedding failed", err)
			httpx.JSON(w, http.StatusOK, []postResp{})
			return
		}
		hits, err := h.qdrant.Search(ctx, vector, min(req.Limit*3, 200), req.Povs, false)
		if err != nil {
			respond.Warn(h.logger, r, "search qdrant search failed", err)
			httpx.JSON(w, http.StatusOK, []postResp{})
			return
		}
		for _, h := range hits {
			ids = append(ids, h.ID)
			scores[h.ID] = h.Score
		}
		if len(req.Povs) == 0 {
			rows, err := h.pool.Query(ctx, dbq.SQL("feed.search_query_pov_ids"), req.Query, req.Limit)
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
				if err := rows.Err(); err != nil {
					respond.Warn(h.logger, r, "search query pov rows failed", err)
				}
				ids = append(povIDs, ids...)
			} else {
				respond.Warn(h.logger, r, "search query pov ids failed", err)
			}
		}
	} else if len(req.Povs) > 0 {
		rows, err := h.pool.Query(ctx, dbq.SQL("feed.search_pov_ids"), req.Povs, req.Limit)
		if err == nil {
			for rows.Next() {
				var pid string
				if rows.Scan(&pid) == nil {
					ids = append(ids, pid)
				}
			}
			rows.Close()
			if err := rows.Err(); err != nil {
				respond.Warn(h.logger, r, "search pov rows failed", err)
			}
		} else {
			respond.Warn(h.logger, r, "search pov ids failed", err)
		}
	}
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	b := h.loadBundle(ctx, ids, uid)
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
			ID:           id,
			Text:         pm.text,
			Povs:         tagList,
			UserID:       pm.userID,
			Username:     pm.username,
			Score:        score,
			Likes:        b.likeCounts[id],
			Liked:        b.liked[id],
			Saved:        b.saved[id],
			CommentCount: b.commentCounts[id],
			POVStats:     b.povStats(tagList),
			MatchReason:  mr,
			CreatedAt:    pm.createdAt.Format(time.RFC3339),
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

// HandleUserPosts returns a user's own posts (newest first).
func (h *Handler) HandleUserPosts(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "userID")
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.user_post_ids"), target)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
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
	if err := rows.Err(); err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}
	b := h.loadBundle(ctx, ids, session.UserID(ctx))

	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm := b.meta[id]
		out = append(out, postResp{
			ID:           id,
			Text:         pm.text,
			Povs:         b.povs[id],
			UserID:       pm.userID,
			Username:     pm.username,
			Likes:        b.likeCounts[id],
			Liked:        b.liked[id],
			Saved:        b.saved[id],
			CommentCount: b.commentCounts[id],
			POVStats:     b.povStats(b.povs[id]),
			CreatedAt:    pm.createdAt.Format(time.RFC3339),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}
