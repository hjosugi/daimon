package posts

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
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
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("posts.insert_like"), uuid.NewString(), id, uid, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: h.likesCount(r.Context(), id)})
}

func (h *Handler) HandleUnlike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := session.UserID(r.Context())
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("posts.delete_like"), id, uid)
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: h.likesCount(r.Context(), id)})
}

// HandleGetLikers returns who liked a post (newest first).
func (h *Handler) HandleGetLikers(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.pool.Query(r.Context(), dbq.SQL("posts.likers"), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
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
	httpx.JSON(w, http.StatusOK, out)
}
