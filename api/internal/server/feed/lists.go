package feed

import (
	"context"
	"net/http"
	"time"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
)

// HandleSavedFeed returns the viewer's saved posts (newest saved first).
func (h *Handler) HandleSavedFeed(w http.ResponseWriter, r *http.Request) {
	uid := session.UserID(r.Context())
	ctx := r.Context()
	ids, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("bookmarks.feed"), uid)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	h.writePosts(w, ctx, ids, uid)
}

// HandleFollowingFeed returns recent posts from users the viewer follows.
func (h *Handler) HandleFollowingFeed(w http.ResponseWriter, r *http.Request) {
	uid := session.UserID(r.Context())
	ctx := r.Context()
	ids, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("follows.feed"), uid)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	h.writePosts(w, ctx, ids, uid)
}

func (h *Handler) writePosts(w http.ResponseWriter, ctx context.Context, ids []string, uid string) {
	b := h.loadBundle(ctx, ids, uid)
	out := make([]postResp, 0, len(ids))
	for _, id := range ids {
		pm, ok := b.meta[id]
		if !ok {
			continue
		}
		out = append(out, postResp{
			ID: id, Text: pm.text, Povs: b.povs[id], UserID: pm.userID, Username: pm.username,
			Likes: b.likeCounts[id], Liked: b.liked[id], Saved: b.saved[id],
			CommentCount: b.commentCounts[id], POVStats: b.povStats(b.povs[id]),
			CreatedAt: pm.createdAt.Format(time.RFC3339),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}
