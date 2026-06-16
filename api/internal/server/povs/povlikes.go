package povs

import (
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
)

type likeResp struct {
	Liked bool `json:"liked"`
	Likes int  `json:"likes"`
}

func povParam(r *http.Request) string {
	pov := chi.URLParam(r, "pov")
	if dec, err := url.PathUnescape(pov); err == nil {
		return dec
	}
	return pov
}

func (h *Handler) povLikeCount(r *http.Request, pov string) (int, error) {
	var n int
	err := h.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.count"), pov).Scan(&n)
	return n, err
}

func (h *Handler) HandleLikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("pov_likes.insert"), uuid.NewString(), pov, session.UserID(r.Context()), time.Now().UTC()); err != nil {
		respond.Internal(w, r, h.logger, "Could not like POV", err)
		return
	}
	count, err := h.povLikeCount(r, pov)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: count})
}

func (h *Handler) HandleUnlikePOV(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("pov_likes.delete"), pov, session.UserID(r.Context())); err != nil {
		respond.Internal(w, r, h.logger, "Could not unlike POV", err)
		return
	}
	count, err := h.povLikeCount(r, pov)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: count})
}

func (h *Handler) HandlePOVLikeStatus(w http.ResponseWriter, r *http.Request) {
	pov := povParam(r)
	var liked bool
	if err := h.pool.QueryRow(r.Context(), dbq.SQL("pov_likes.status"), pov, session.UserID(r.Context())).Scan(&liked); err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	count, err := h.povLikeCount(r, pov)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, likeResp{Liked: liked, Likes: count})
}
