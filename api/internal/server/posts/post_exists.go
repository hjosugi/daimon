package posts

import (
	"context"
	"net/http"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
)

func (h *Handler) postExists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := h.pool.QueryRow(ctx, dbq.SQL("posts.exists"), id).Scan(&exists)
	return exists, err
}

func (h *Handler) requirePost(w http.ResponseWriter, r *http.Request, id string) bool {
	exists, err := h.postExists(r.Context(), id)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return false
	}
	if !exists {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return false
	}
	return true
}
