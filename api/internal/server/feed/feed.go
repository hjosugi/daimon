package feed

import (
	"context"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/feedcore"
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
	normalizeTimelinePage(&req)
	ctx := r.Context()
	uid := session.UserID(ctx)

	if out, ok := h.cachedTimeline(ctx, uid, req); ok {
		httpx.JSON(w, http.StatusOK, out)
		return
	}

	userTags, centroid := h.timelineSense(ctx, uid)
	searchVector := centroid
	if len(searchVector) == 0 || !defaultTimelineQuery(req.QueryText) {
		vector, err := h.embed.Embed(ctx, req.QueryText)
		if err != nil {
			respond.Warn(h.logger, r, "timeline embedding failed", err)
			httpx.JSON(w, http.StatusOK, []postResp{}) // degrade gracefully
			return
		}
		searchVector = vector
	}
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
		if out := h.materializeIDs(ctx, timelinePage(ids, req), uid); len(out) > 0 {
			return out, true
		}
	}
	return nil, false
}

func (h *Handler) timelineSense(ctx context.Context, uid string) (map[string]bool, []float32) {
	userTags, centroid := h.userSense(ctx, uid)
	// Saves are a strong preference signal: blend the saved-post centroid in.
	centroid = vec.BlendSaved(centroid, h.savedCentroid(ctx, uid))
	return userTags, centroid
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
			respond.Warn(h.logger, r, "timeline vector search failed", err)
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
			respond.Warn(h.logger, r, "timeline popular vector retrieve failed", err)
		}
	}
	return hits
}

func (h *Handler) rankAndMaterializeTimeline(ctx context.Context, uid string, req timelineReq, hits []qdrant.Hit, centroid []float32, userTags map[string]bool) []postResp {
	ids := make([]string, 0, len(hits))
	for _, hit := range hits {
		ids = append(ids, hit.ID)
	}
	b := h.loadTimelineBundle(ctx, ids, uid)

	cands := feedcore.BuildCandidates(hits, b.rankingMeta(), b.povs, b.likeCounts, b.saveCounts, uid, time.Now().UTC())
	ranked := ranking.RankBySenseDistance(cands, centroid, userTags,
		req.SimilarityWeight, req.BoostPopular, req.IncludeFarPosts,
		feedcore.DefaultTimelineBridgeWeight, timelineRankLimit(req))
	ranked = timelinePage(ranked, req)

	out := make([]postResp, 0, len(ranked))
	for _, c := range ranked {
		out = append(out, h.materialize(c, b, userTags))
	}
	return out
}

func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	var req searchReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	ctx := r.Context()
	uid := session.UserID(ctx)
	userTags, _ := h.userSense(ctx, uid)

	var ids []string
	scores := map[string]float32{}

	if req.Query != "" {
		textIDs, err := dbq.QueryStrings(
			ctx,
			h.pool,
			dbq.SQL("feed.search_text_ids"),
			req.Query,
			req.Povs,
			req.Limit,
		)
		if err == nil {
			for _, id := range textIDs {
				ids = append(ids, id)
				scores[id] = 1
			}
		} else {
			respond.Warn(h.logger, r, "text search failed", err)
		}

		vector, err := h.embed.Embed(ctx, req.Query)
		if err != nil {
			respond.Warn(h.logger, r, "search embedding failed", err)
		} else {
			hits, err := h.qdrant.Search(ctx, vector, min(req.Limit*3, 200), req.Povs, false)
			if err != nil {
				respond.Warn(h.logger, r, "semantic vector search failed", err)
			} else {
				seen := map[string]bool{}
				for _, id := range ids {
					seen[id] = true
				}
				for _, hit := range hits {
					if !seen[hit.ID] {
						ids = append(ids, hit.ID)
						seen[hit.ID] = true
					}
					if hit.Score > scores[hit.ID] {
						scores[hit.ID] = hit.Score
					}
				}
			}
		}
		if len(req.Povs) == 0 {
			povIDs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.search_query_pov_ids"), req.Query, req.Limit)
			if err == nil {
				seen := map[string]bool{}
				for _, id := range ids {
					seen[id] = true
				}
				filteredPOVIDs := make([]string, 0, len(povIDs))
				for _, pid := range povIDs {
					if !seen[pid] {
						seen[pid] = true
						filteredPOVIDs = append(filteredPOVIDs, pid)
						scores[pid] = 1
					}
				}
				ids = append(filteredPOVIDs, ids...)
			} else {
				respond.Warn(h.logger, r, "search query pov ids failed", err)
			}
		}
	} else if len(req.Povs) > 0 {
		povIDs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.search_pov_ids"), req.Povs, req.Limit)
		if err == nil {
			ids = append(ids, povIDs...)
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
	if req.Sort == "newest" {
		sort.SliceStable(out, func(a, b int) bool { return out[a].CreatedAt > out[b].CreatedAt })
	} else if req.Query != "" {
		// Text search: rank by semantic relevance (highest cosine first).
		// Sorting by date here would throw away the vector ranking entirely.
		sort.SliceStable(out, func(a, b int) bool {
			return scores[out[a].ID] > scores[out[b].ID]
		})
	} else {
		// POV-only search has no relevance score: newest first.
		sort.SliceStable(out, func(a, b int) bool { return out[a].CreatedAt > out[b].CreatedAt })
	}
	if len(out) > req.Limit {
		out = out[:req.Limit]
	}
	httpx.JSON(w, http.StatusOK, out)
}

// HandleUserPosts returns a user's own posts (newest first).
func (h *Handler) HandleUserPosts(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "userID")
	ctx := r.Context()
	ids, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.user_post_ids"), target)
	if err != nil {
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
