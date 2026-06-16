package feed

import (
	"context"
	"time"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/ranking"
)

// materializeIDs builds responses for a fixed, ordered list of post IDs
// (used for the precomputed-feed cache fast path). Counts are always fresh.
func (h *Handler) materializeIDs(ctx context.Context, ids []string, uid string) []postResp {
	b := h.loadBundle(ctx, ids, uid)
	userTags := h.userTagSet(ctx, uid)

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

func (h *Handler) recentPopularMatchedPostIDs(ctx context.Context, uid string, userTags map[string]bool, limit int) []string {
	tags := tagSetKeys(userTags)
	if uid == "" || len(tags) == 0 || limit <= 0 {
		return nil
	}
	rows, err := h.pool.Query(ctx, dbq.SQL("feed.recent_popular_matched_ids"), uid, tags, limit)
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

func (h *Handler) materialize(c ranking.Candidate, b bundle, userTags map[string]bool) postResp {
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
