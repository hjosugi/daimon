package server

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
)

func (s *Server) likesCount(ctx context.Context, postID string) int {
	var n int
	_ = s.pool.QueryRow(ctx, dbq.SQL("posts.like_count"), postID).Scan(&n)
	return n
}

func (s *Server) handleLike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("posts.insert_like"), uuid.NewString(), id, uid, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: s.likesCount(r.Context(), id)})
}

func (s *Server) handleUnlike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("posts.delete_like"), id, uid)
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: s.likesCount(r.Context(), id)})
}

// handleGetLikers returns who liked a post (newest first).
func (s *Server) handleGetLikers(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := s.pool.Query(r.Context(), dbq.SQL("posts.likers"), id)
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
