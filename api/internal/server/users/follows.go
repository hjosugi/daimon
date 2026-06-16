package users

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
)

type userProfile struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	AvatarURL   *string `json:"avatar_url"`
	Bio         *string `json:"bio"`
	PostsCount  int     `json:"posts_count"`
	Followers   int     `json:"followers"`
	Following   int     `json:"following"`
	IsFollowing bool    `json:"is_following"`
	IsMe        bool    `json:"is_me"`
}

type followUserResp struct {
	ID        string  `json:"id"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatar_url"`
	Bio       *string `json:"bio"`
}

func (h *Handler) followerCount(r *http.Request, id string) (int, error) {
	var n int
	err := h.pool.QueryRow(r.Context(), dbq.SQL("follows.follower_count"), id).Scan(&n)
	return n, err
}

// HandleUserProfile returns a public profile (+ is_following for the viewer).
func (h *Handler) HandleUserProfile(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	me := session.UserID(r.Context())
	ctx := r.Context()

	p := userProfile{ID: target}
	if err := h.pool.QueryRow(ctx, dbq.SQL("follows.profile_user"), target).Scan(&p.Username, &p.AvatarURL, &p.Bio); err != nil {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	if err := h.pool.QueryRow(ctx, dbq.SQL("follows.posts_count"), target).Scan(&p.PostsCount); err != nil {
		respond.Warn(h.logger, r, "profile posts count failed", err)
	}
	if err := h.pool.QueryRow(ctx, dbq.SQL("follows.follower_count"), target).Scan(&p.Followers); err != nil {
		respond.Warn(h.logger, r, "profile follower count failed", err)
	}
	if err := h.pool.QueryRow(ctx, dbq.SQL("follows.following_count"), target).Scan(&p.Following); err != nil {
		respond.Warn(h.logger, r, "profile following count failed", err)
	}

	p.IsMe = me != "" && me == target
	if me != "" && !p.IsMe {
		if err := h.pool.QueryRow(ctx, dbq.SQL("follows.status"), me, target).Scan(&p.IsFollowing); err != nil {
			respond.Warn(h.logger, r, "profile follow status failed", err)
		}
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) HandleFollowers(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	rows, err := h.pool.Query(r.Context(), dbq.SQL("follows.followers"), target)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	defer rows.Close()
	out := []followUserResp{}
	for rows.Next() {
		var u followUserResp
		if rows.Scan(&u.ID, &u.Username, &u.AvatarURL, &u.Bio) == nil {
			out = append(out, u)
		}
	}
	if err := rows.Err(); err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) HandleRemoveFollower(w http.ResponseWriter, r *http.Request) {
	followerID := chi.URLParam(r, "id")
	me := session.UserID(r.Context())
	if followerID == me {
		httpx.Error(w, http.StatusBadRequest, "Cannot remove yourself")
		return
	}
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("follows.remove_follower"), followerID, me); err != nil {
		respond.Internal(w, r, h.logger, "Could not remove follower", err)
		return
	}
	followers, err := h.followerCount(r, me)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"removed": true, "followers": followers})
}

func (h *Handler) HandleFollow(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	me := session.UserID(r.Context())
	if target == me {
		httpx.Error(w, http.StatusBadRequest, "Cannot follow yourself")
		return
	}
	var exists bool
	if err := h.pool.QueryRow(r.Context(), dbq.SQL("follows.user_exists"), target).Scan(&exists); err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if !exists {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("follows.insert"), uuid.NewString(), me, target, time.Now().UTC()); err != nil {
		respond.Internal(w, r, h.logger, "Could not follow user", err)
		return
	}
	followers, err := h.followerCount(r, target)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"following": true, "followers": followers})
}

func (h *Handler) HandleUnfollow(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("follows.delete"), session.UserID(r.Context()), target); err != nil {
		respond.Internal(w, r, h.logger, "Could not unfollow user", err)
		return
	}
	followers, err := h.followerCount(r, target)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"following": false, "followers": followers})
}
