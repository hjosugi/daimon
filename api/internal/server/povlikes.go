package server

import (
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
)

func povParam(r *http.Request) string {
	pov := chi.URLParam(r, "pov")
	if dec, err := url.PathUnescape(pov); err == nil {
		return dec
	}
	return pov
}

func (s *Server) povLikeCount(r *http.Request, pov string) int {
	var n int
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.count"), pov).Scan(&n)
	return n
}

func (s *Server) handleLikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("pov_likes.insert"), uuid.NewString(), pov, userID(r.Context()), time.Now().UTC())
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: s.povLikeCount(r, pov)})
}

func (s *Server) handleUnlikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("pov_likes.delete"), pov, userID(r.Context()))
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: s.povLikeCount(r, pov)})
}

func (s *Server) handlePOVLikeStatus(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	var liked bool
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.status"), pov, userID(r.Context())).Scan(&liked)
	httpx.JSON(w, http.StatusOK, likeResp{Liked: liked, Likes: s.povLikeCount(r, pov)})
}
