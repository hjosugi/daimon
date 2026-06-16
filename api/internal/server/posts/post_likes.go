package posts

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
)

func (h *Handler) likesCount(ctx context.Context, postID string) int {
	var n int
	_ = h.pool.QueryRow(ctx, dbq.SQL("posts.like_count"), postID).Scan(&n)
	return n
}

func (h *Handler) HandleLike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := session.UserID(r.Context())
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("posts.insert_like"), uuid.NewString(), id, uid, time.Now().UTC()); err != nil {
		respond.Internal(w, r, h.logger, "Could not like post", err)
		return
	}
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: h.likesCount(r.Context(), id)})
}

func (h *Handler) HandleUnlike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := session.UserID(r.Context())
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("posts.delete_like"), id, uid); err != nil {
		respond.Internal(w, r, h.logger, "Could not unlike post", err)
		return
	}
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: h.likesCount(r.Context(), id)})
}

// HandleGetLikers returns who liked a post (newest first).
func (h *Handler) HandleGetLikers(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.pool.Query(r.Context(), dbq.SQL("posts.likers"), id)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	defer rows.Close()
	out := []likerResp{}
	for rows.Next() {
		var lr likerResp
		if err := rows.Scan(&lr.ID, &lr.Username); err == nil {
			out = append(out, lr)
		}
	}
	if err := rows.Err(); err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}
