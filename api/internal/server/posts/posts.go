package posts

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/qdrant"
)

func (h *Handler) HandleCreatePost(w http.ResponseWriter, r *http.Request) {
	var req createPostReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		httpx.Error(w, http.StatusBadRequest, "Post text cannot be empty")
		return
	}
	if len([]rune(text)) > maxPostLen {
		httpx.Error(w, http.StatusBadRequest, "Post text must be 40,000 characters or less")
		return
	}
	povs := cleanPOVs(req.Povs)

	ctx := r.Context()
	uid := session.UserID(ctx)

	var username string
	if err := h.pool.QueryRow(ctx, dbq.SQL("posts.username_by_id"), uid).Scan(&username); err != nil {
		httpx.Error(w, http.StatusUnauthorized, "User not found")
		return
	}

	// Embed (non-fatal: a post can exist without a vector and be reindexed later).
	vector, embErr := h.embed.Embed(ctx, text)

	now := time.Now().UTC()
	id := uuid.NewString()

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, dbq.SQL("posts.insert_post"), id, uid, username, text, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not create post")
		return
	}
	for _, p := range povs {
		if _, err := tx.Exec(ctx, dbq.SQL("posts.insert_pov"), uuid.NewString(), id, p, now); err != nil {
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
		_ = h.qdrant.Upsert(ctx, []qdrant.Point{{
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

func (h *Handler) HandleDeletePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	uid := session.UserID(r.Context())

	var owner string
	if err := h.pool.QueryRow(r.Context(), dbq.SQL("posts.owner"), id).Scan(&owner); err != nil {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}
	if owner != uid {
		httpx.Error(w, http.StatusForbidden, "You can only delete your own posts")
		return
	}
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("posts.delete"), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not delete post")
		return
	}
	_ = h.qdrant.Delete(r.Context(), []string{id}) // best-effort
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Post deleted successfully"})
}
