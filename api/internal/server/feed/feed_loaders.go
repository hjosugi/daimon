package feed

import (
	"context"

	dbq "daimon/api/internal/db"
)

func (h *Handler) loadPosts(ctx context.Context, ids []string) map[string]postMeta {
	m := map[string]postMeta{}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.load_posts"), ids)
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

func (h *Handler) loadPOVs(ctx context.Context, ids []string) map[string][]string {
	m := map[string][]string{}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.load_povs"), ids)
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

func (h *Handler) loadCounts(ctx context.Context, table string, ids []string) map[string]int {
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
	rows, err := h.pool.Query(ctx, query, ids)
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

func (h *Handler) loadLikedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.liked_set"), ids, uid)
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

func (h *Handler) loadSavedSet(ctx context.Context, ids []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" {
		return m
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.saved_set"), ids, uid)
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

func (h *Handler) loadPOVLikeCounts(ctx context.Context, povs []string) map[string]int {
	m := map[string]int{}
	if len(povs) == 0 {
		return m
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("pov_likes.counts"), povs)
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

func (h *Handler) loadPOVLikedSet(ctx context.Context, povs []string, uid string) map[string]bool {
	m := map[string]bool{}
	if uid == "" || len(povs) == 0 {
		return m
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("pov_likes.liked_set"), povs, uid)
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
