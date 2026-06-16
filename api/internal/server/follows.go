package server

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
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

func (s *Server) followerCount(r *http.Request, id string) int {
	var n int
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("follows.follower_count"), id).Scan(&n)
	return n
}

// handleUserProfile returns a public profile (+ is_following for the viewer).
func (s *Server) handleUserProfile(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	me := userID(r.Context())
	ctx := r.Context()

	p := userProfile{ID: target}
	if err := s.pool.QueryRow(ctx, dbq.SQL("follows.profile_user"), target).Scan(&p.Username, &p.AvatarURL, &p.Bio); err != nil {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	_ = s.pool.QueryRow(ctx, dbq.SQL("follows.posts_count"), target).Scan(&p.PostsCount)
	_ = s.pool.QueryRow(ctx, dbq.SQL("follows.follower_count"), target).Scan(&p.Followers)
	_ = s.pool.QueryRow(ctx, dbq.SQL("follows.following_count"), target).Scan(&p.Following)

	p.IsMe = me != "" && me == target
	if me != "" && !p.IsMe {
		_ = s.pool.QueryRow(ctx, dbq.SQL("follows.status"), me, target).Scan(&p.IsFollowing)
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (s *Server) handleFollowers(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	rows, err := s.pool.Query(r.Context(), dbq.SQL("follows.followers"), target)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
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
	httpx.JSON(w, http.StatusOK, out)
}

func (s *Server) handleRemoveFollower(w http.ResponseWriter, r *http.Request) {
	followerID := chi.URLParam(r, "id")
	me := userID(r.Context())
	if followerID == me {
		httpx.Error(w, http.StatusBadRequest, "Cannot remove yourself")
		return
	}
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("follows.remove_follower"), followerID, me)
	httpx.JSON(w, http.StatusOK, map[string]any{"removed": true, "followers": s.followerCount(r, me)})
}

func (s *Server) handleFollow(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	me := userID(r.Context())
	if target == me {
		httpx.Error(w, http.StatusBadRequest, "Cannot follow yourself")
		return
	}
	var exists bool
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("follows.user_exists"), target).Scan(&exists)
	if !exists {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("follows.insert"), uuid.NewString(), me, target, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, map[string]any{"following": true, "followers": s.followerCount(r, target)})
}

func (s *Server) handleUnfollow(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "id")
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("follows.delete"), userID(r.Context()), target)
	httpx.JSON(w, http.StatusOK, map[string]any{"following": false, "followers": s.followerCount(r, target)})
}

// handleFollowingFeed returns recent posts from users the viewer follows.
func (s *Server) handleFollowingFeed(w http.ResponseWriter, r *http.Request) {
	uid := userID(r.Context())
	ctx := r.Context()
	rows, err := s.pool.Query(ctx, dbq.SQL("follows.feed"), uid)
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
