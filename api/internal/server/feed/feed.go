package feed

import (
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
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

	// Fast path: serve the batch-precomputed home feed (default knobs).
	// Discovery mode (include_far_posts) always computes live.
	if uid != "" && defaultTimelineKnobs(req) {
		var ids []string
		if h.cache.GetJSON(ctx, "feed:"+uid, &ids) && len(ids) > 0 {
			if out := h.materializeIDs(ctx, ids, uid); len(out) > 0 {
				httpx.JSON(w, http.StatusOK, out)
				return
			}
		}
	}

	vector, err := h.embed.Embed(ctx, req.QueryText)
	if err != nil {
		respond.Warn(h.logger, r, "timeline embedding failed", err)
		httpx.JSON(w, http.StatusOK, []postResp{}) // degrade gracefully
		return
	}
	userTags, centroid := h.userSense(ctx, uid)
	// Saves are a strong preference signal: blend the saved-post centroid in.
	centroid = vec.BlendSaved(centroid, h.savedCentroid(ctx, uid))
	searchVector := vector
	if uid != "" && len(centroid) > 0 && defaultTimelineQuery(req.QueryText) {
		searchVector = centroid
	}

	limit := 100
	if req.IncludeFarPosts {
		limit = 200
	}
	hits, err := h.qdrant.Search(ctx, searchVector, limit, nil, true)
	if err != nil || len(hits) == 0 {
		if err != nil {
			respond.Warn(h.logger, r, "timeline qdrant search failed", err)
		}
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	seenHits := map[string]bool{}
	for _, h := range hits {
		seenHits[h.ID] = true
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

	ids := make([]string, 0, len(hits))
	for _, h := range hits {
		ids = append(ids, h.ID)
	}
	b := h.loadBundle(ctx, ids, uid)
	saveCounts := h.loadCounts(ctx, "bookmarks", ids)

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
			PostID:     h.ID,
			Vector:     h.Vector,
			Tags:       tagSet,
			Relevance:  h.Score,
			Popularity: pop,
			Recency:    recencyScore(pm.createdAt, now),
		})
	}

	ranked := ranking.RankBySenseDistance(cands, centroid, userTags,
		req.SimilarityWeight, req.BoostPopular, req.IncludeFarPosts, 0.3, 10)

	out := make([]postResp, 0, len(ranked))
	for _, c := range ranked {
		out = append(out, h.materialize(c, b, userTags))
	}
	httpx.JSON(w, http.StatusOK, out)
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
