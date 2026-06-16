package server

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
)

func (s *Server) handleGetComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := s.pool.Query(r.Context(), dbq.SQL("posts.comments"), id)
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
	_ = s.pool.QueryRow(r.Context(), dbq.SQL("posts.exists"), id).Scan(&exists)
	if !exists {
		httpx.Error(w, http.StatusNotFound, "Post not found")
		return
	}

	cid := uuid.NewString()
	now := time.Now().UTC()
	if _, err := s.pool.Exec(r.Context(), dbq.SQL("posts.insert_comment"), cid, id, uid, text, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not add comment")
		return
	}
	httpx.JSON(w, http.StatusOK, commentResp{
		ID: cid, Text: text, AuthorID: uid, CreatedAt: now.Format(time.RFC3339),
	})
}
