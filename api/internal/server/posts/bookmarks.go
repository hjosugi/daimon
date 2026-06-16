package posts

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/session"
)

func (h *Handler) HandleSavePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := session.UserID(r.Context())
	var exists bool
	_ = h.pool.QueryRow(r.Context(), dbq.SQL("posts.exists"), id).Scan(&exists)
	if !exists {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("bookmarks.insert"), uuid.NewString(), uid, id, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": true})
}

func (h *Handler) HandleUnsavePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("bookmarks.delete"), session.UserID(r.Context()), id)
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": false})
}

func (h *Handler) HandleSaveStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var saved bool
	_ = h.pool.QueryRow(r.Context(), dbq.SQL("bookmarks.status"), session.UserID(r.Context()), id).Scan(&saved)
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": saved})
}
