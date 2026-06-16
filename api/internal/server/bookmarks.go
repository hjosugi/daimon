package server

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
)

func (s *Server) handleSavePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	var exists bool
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("posts.exists"), id).Scan(&exists)
	if !exists {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("bookmarks.insert"), uuid.NewString(), uid, id, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": true})
}

func (s *Server) handleUnsavePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("bookmarks.delete"), userID(r.Context()), id)
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": false})
}

func (s *Server) handleSaveStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var saved bool
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("bookmarks.status"), userID(r.Context()), id).Scan(&saved)
	httpx.JSON(w, http.StatusOK, map[string]bool{"saved": saved})
}

// handleSavedFeed returns the viewer's saved posts (newest saved first).
func (s *Server) handleSavedFeed(w http.ResponseWriter, r *http.Request) {
	uid := userID(r.Context())
	ctx := r.Context()
	rows, err := s.pool.Query(ctx, dbq.SQL("bookmarks.feed"), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
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
	if len(ids) == 0 {
		httpx.JSON(w, http.StatusOK, []postResp{})
		return
	}

	b := s.loadBundle(ctx, ids, uid)
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
