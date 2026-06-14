package server

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"daimon/api/internal/httpx"
	"daimon/api/internal/qdrant"
)

type createPostReq struct {
	Text string   `json:"text"`
	Povs []string `json:"povs"`
}

type postResp struct {
	ID           string       `json:"id"`
	Text         string       `json:"text"`
	Povs         []string     `json:"povs"`
	UserID       string       `json:"user_id"`
	Username     string       `json:"username"`
	Score        *float32     `json:"score,omitempty"`
	Likes        int          `json:"likes"`
	Liked        bool         `json:"liked"`
	CommentCount int          `json:"commentCount"`
	MatchReason  *matchReason `json:"match_reason,omitempty"`
	CreatedAt    string       `json:"created_at"`
}

type likeResp struct {
	Liked bool `json:"liked"`
	Likes int  `json:"likes"`
}

func cleanPOVs(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, p := range in {
		t := strings.TrimSpace(p)
		if t == "" || len([]rune(t)) > 300 || seen[strings.ToLower(t)] {
			continue
		}
		seen[strings.ToLower(t)] = true
		out = append(out, t)
	}
	return out
}

func (s *Server) handleCreatePost(w http.ResponseWriter, r *http.Request) {
	var req createPostReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		httpx.Error(w, http.StatusBadRequest, "Post text cannot be empty")
		return
	}
	if len([]rune(text)) > 10000 {
		httpx.Error(w, http.StatusBadRequest, "Post text must be 10,000 characters or less")
		return
	}
	povs := cleanPOVs(req.Povs)

	ctx := r.Context()
	uid := userID(ctx)

	var username string
	if err := s.pool.QueryRow(ctx, `SELECT username FROM users WHERE id=$1`, uid).Scan(&username); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "User not found")
		return
	}

	// Embed (non-fatal: a post can exist without a vector and be reindexed later).
	vector, embErr := s.embed.Embed(ctx, text)

	now := time.Now().UTC()
	id := uuid.NewString()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO posts (id, user_id, username, text, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$5)`, id, uid, username, text, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not create post")
		return
	}
	for _, p := range povs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO povs (id, post_id, pov, is_auto, created_at) VALUES ($1,$2,$3,false,$4)`,
			uuid.NewString(), id, p, now); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Could not save POV")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not commit")
		return
	}

	// Qdrant upsert is best-effort (regenerable index).
	if embErr == nil && len(vector) > 0 {
		_ = s.qdrant.Upsert(ctx, []qdrant.Point{{
			ID:     id,
			Vector: vector,
			Payload: map[string]any{
				"post_id":    id,
				"user_id":    uid,
				"tags":       povs,
				"created_at": now.Unix(),
			},
		}})
	}

	httpx.JSON(w, http.StatusOK, postResp{
		ID: id, Text: text, Povs: povs, UserID: uid, Username: username,
		CreatedAt: now.Format(time.RFC3339),
	})
}

func (s *Server) handleDeletePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())

	var owner string
	if err := s.pool.QueryRow(r.Context(), `SELECT user_id FROM posts WHERE id=$1`, id).Scan(&owner); err != nil {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}
	if owner != uid {
		httpx.Error(w, http.StatusForbidden, "You can only delete your own posts")
		return
	}
	if _, err := s.pool.Exec(r.Context(), `DELETE FROM posts WHERE id=$1`, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not delete post")
		return
	}
	_ = s.qdrant.Delete(r.Context(), []string{id}) // best-effort
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Post deleted successfully"})
}

func (s *Server) likesCount(ctx context.Context, postID string) int {
	var n int
	_ = s.pool.QueryRow(ctx, `SELECT count(*) FROM likes WHERE post_id=$1`, postID).Scan(&n)
	return n
}

func (s *Server) handleLike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	_, _ = s.pool.Exec(r.Context(),
		`INSERT INTO likes (id, post_id, user_id, created_at) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (post_id, user_id) DO NOTHING`,
		uuid.NewString(), id, uid, time.Now().UTC())
	httpx.JSON(w, http.StatusOK, likeResp{Liked: true, Likes: s.likesCount(r.Context(), id)})
}

func (s *Server) handleUnlike(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	_, _ = s.pool.Exec(r.Context(), `DELETE FROM likes WHERE post_id=$1 AND user_id=$2`, id, uid)
	httpx.JSON(w, http.StatusOK, likeResp{Liked: false, Likes: s.likesCount(r.Context(), id)})
}

type likerResp struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// handleGetLikers returns who liked a post (newest first).
func (s *Server) handleGetLikers(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := s.pool.Query(r.Context(),
		`SELECT u.id, u.username
		 FROM likes l JOIN users u ON u.id = l.user_id
		 WHERE l.post_id=$1 ORDER BY l.created_at DESC LIMIT 200`, id)
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

type commentResp struct {
	ID        string  `json:"id"`
	Text      string  `json:"text"`
	AuthorID  string  `json:"authorId"`
	Username  *string `json:"username"`
	CreatedAt string  `json:"createdAt"`
}

func (s *Server) handleGetComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := s.pool.Query(r.Context(),
		`SELECT c.id, c.text, c.user_id, u.username, c.created_at
		 FROM comments c LEFT JOIN users u ON u.id = c.user_id
		 WHERE c.post_id=$1 ORDER BY c.created_at ASC`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()
	out := []commentResp{}
	for rows.Next() {
		var (
			cr        commentResp
			username  *string
			createdAt time.Time
		)
		if err := rows.Scan(&cr.ID, &cr.Text, &cr.AuthorID, &username, &createdAt); err == nil {
			cr.Username = username
			cr.CreatedAt = createdAt.Format(time.RFC3339)
			out = append(out, cr)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

type addCommentReq struct {
	Text string `json:"text"`
}

func (s *Server) handleAddComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := userID(r.Context())
	var req addCommentReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		httpx.Error(w, http.StatusBadRequest, "Comment cannot be empty")
		return
	}
	if len([]rune(text)) > 10000 {
		httpx.Error(w, http.StatusBadRequest, "Comment is too long")
		return
	}

	var exists bool
	_ = s.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM posts WHERE id=$1)`, id).Scan(&exists)
	if !exists {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}

	cid := uuid.NewString()
	now := time.Now().UTC()
	if _, err := s.pool.Exec(r.Context(),
		`INSERT INTO comments (id, post_id, user_id, text, created_at) VALUES ($1,$2,$3,$4,$5)`,
		cid, id, uid, text, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not add comment")
		return
	}
	httpx.JSON(w, http.StatusOK, commentResp{
		ID: cid, Text: text, AuthorID: uid, CreatedAt: now.Format(time.RFC3339),
	})
}
