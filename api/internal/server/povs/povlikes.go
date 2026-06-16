package povs

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

func (h *Handler) povLikeCount(r *http.Request, pov string) int {
	var n int
	_ = h.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.count"), pov).Scan(&n)
	return n
}

func (h *Handler) HandleLikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("pov_likes.insert"), uuid.NewString(), pov, session.UserID(r.Context()), time.Now().UTC())
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: h.povLikeCount(r, pov)})
}

func (h *Handler) HandleUnlikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("pov_likes.delete"), pov, session.UserID(r.Context()))
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: h.povLikeCount(r, pov)})
}

func (h *Handler) HandlePOVLikeStatus(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	var liked bool
	_ = h.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.status"), pov, session.UserID(r.Context())).Scan(&liked)
	httpx.JSON(w, http.StatusOK, likeResp{Liked: liked, Likes: h.povLikeCount(r, pov)})
}
