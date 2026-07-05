package feed

import (
	"context"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/feedcore"
)

func (h *Handler) loadPosts(ctx context.Context, ids []string) map[string]postMeta {
	m := map[string]postMeta{}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.load_posts"), ids)
	if err != nil {
		h.logger.WarnContext(ctx, "load posts failed", "error", err)
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
	if err := rows.Err(); err != nil {
		h.logger.WarnContext(ctx, "load posts rows failed", "error", err)
	}
	return m
}

func (h *Handler) loadPOVs(ctx context.Context, ids []string) map[string][]string {
	m, err := feedcore.LoadPOVs(ctx, h.pool, ids)
	if err != nil {
		h.logger.WarnContext(ctx, "load povs failed", "error", err)
	}
	return m
}

func (h *Handler) loadCounts(ctx context.Context, table string, ids []string) map[string]int {
	m := map[string]int{}
	switch table {
	case "likes":
		var err error
		m, err = feedcore.LoadLikeCounts(ctx, h.pool, ids)
		if err != nil {
			h.logger.WarnContext(ctx, "load counts failed", "error", err, "table", table)
		}
		return m
	case "comments":
		rows, err := h.pool.Query(ctx, dbq.SQL("feed.comment_counts"), ids)
		if err != nil {
			h.logger.WarnContext(ctx, "load counts failed", "error", err, "table", table)
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
			h.logger.WarnContext(ctx, "load counts rows failed", "error", err, "table", table)
		}
		return m
	case "bookmarks":
		var err error
		m, err = feedcore.LoadSaveCounts(ctx, h.pool, ids)
		if err != nil {
			h.logger.WarnContext(ctx, "load counts failed", "error", err, "table", table)
		}
		return m
	default:
		return m
	}
}

func (h *Handler) loadLikedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	likedIDs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.liked_set"), ids, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "load liked set failed", "error", err)
		return m
	}
	for _, pid := range likedIDs {
		m[pid] = true
	}
	return m
}

func (h *Handler) loadSavedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	savedIDs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.saved_set"), ids, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "load saved set failed", "error", err)
		return m
	}
	for _, pid := range savedIDs {
		m[pid] = true
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

func (h *Handler) loadPOVLikeCounts(ctx context.Context, povs []string) map[string]int {
	m := map[string]int{}
	if len(povs) == 0 {
		return m
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("pov_likes.counts"), povs)
	if err != nil {
		h.logger.WarnContext(ctx, "load pov like counts failed", "error", err)
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
	if err := rows.Err(); err != nil {
		h.logger.WarnContext(ctx, "load pov like count rows failed", "error", err)
	}
	return m
}

func (h *Handler) loadPOVLikedSet(ctx context.Context, povs []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" || len(povs) == 0 {
		return m
	}
	likedPOVs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("pov_likes.liked_set"), povs, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "load pov liked set failed", "error", err)
		return m
	}
	for _, pov := range likedPOVs {
		m[pov] = true
	}
	return m
}

// loadBundle bulk-loads post metadata, POVs, counts and viewer-specific flags
// for a set of post IDs (the shared read path for timeline/search/profile).
func (h *Handler) loadBundle(ctx context.Context, ids []string, uid string) bundle {
	povs := h.loadPOVs(ctx, ids)
	allPOVs := uniquePOVs(povs)
	return bundle{
		meta:          h.loadPosts(ctx, ids),
		povs:          povs,
		likeCounts:    h.loadCounts(ctx, "likes", ids),
		commentCounts: h.loadCounts(ctx, "comments", ids),
		liked:         h.loadLikedSet(ctx, ids, uid),
		saved:         h.loadSavedSet(ctx, ids, uid),
		povLikeCounts: h.loadPOVLikeCounts(ctx, allPOVs),
		povLiked:      h.loadPOVLikedSet(ctx, allPOVs, uid),
	}
}

func (b bundle) rankingMeta() map[string]feedcore.PostMeta {
	out := make(map[string]feedcore.PostMeta, len(b.meta))
	for id, meta := range b.meta {
		out[id] = feedcore.PostMeta{
			UserID:    meta.userID,
			CreatedAt: meta.createdAt,
		}
	}
	return out
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
