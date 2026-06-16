package povs

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/session"
)

type povCommentReq struct {
	Text   string `json:"text"`
	Stance string `json:"stance"`
}

type povCommentResp struct {
	ID        string  `json:"id"`
	Pov       string  `json:"pov"`
	Text      string  `json:"text"`
	Stance    string  `json:"stance"`
	UserID    string  `json:"user_id"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatar_url"`
	CreatedAt string  `json:"created_at"`
	Mine      bool    `json:"mine"`
}

func cleanStance(s string) string {
	stance := strings.TrimSpace(s)
	switch stance {
	case "support", "question", "oppose", "note":
		return stance
	default:
		return "note"
	}
}

func povFromRoute(r *http.Request) string {
	pov := chi.URLParam(r, "pov")
	if dec, err := url.PathUnescape(pov); err == nil {
		return dec
	}
	return pov
}

func (h *Handler) HandlePOVComments(w http.ResponseWriter, r *http.Request) {
	pov := strings.TrimSpace(povFromRoute(r))
	if pov == "" {
		httpx.Error(w, http.StatusBadRequest, "POV is required")
		return
	}
	rows, err := h.pool.Query(r.Context(), dbq.SQL("pov_comments.list"), pov)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer rows.Close()

	viewer := session.UserID(r.Context())
	out := []povCommentResp{}
	for rows.Next() {
		var c povCommentResp
		var created time.Time
		if err := rows.Scan(&c.ID, &c.Pov, &c.Text, &c.Stance, &c.UserID, &c.Username, &c.AvatarURL, &created); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Database error")
			return
		}
		c.CreatedAt = created.Format(time.RFC3339)
		c.Mine = viewer != "" && viewer == c.UserID
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) HandleAddPOVComment(w http.ResponseWriter, r *http.Request) {
	pov := strings.TrimSpace(povFromRoute(r))
	if pov == "" {
		httpx.Error(w, http.StatusBadRequest, "POV is required")
		return
	}
	var req povCommentReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		httpx.Error(w, http.StatusBadRequest, "Comment cannot be empty")
		return
	}
	if len([]rune(text)) > 2000 {
		httpx.Error(w, http.StatusBadRequest, "Comment must be 2,000 characters or less")
		return
	}

	uid := session.UserID(r.Context())
	id := uuid.NewString()
	now := time.Now().UTC()
	stance := cleanStance(req.Stance)
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("pov_comments.insert"), id, pov, uid, text, stance, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not add comment")
		return
	}

	var username string
	var avatar *string
	var bio *string
	if err := h.pool.QueryRow(r.Context(), dbq.SQL("follows.profile_user"), uid).Scan(&username, &avatar, &bio); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	httpx.JSON(w, http.StatusOK, povCommentResp{
		ID: id, Pov: pov, Text: text, Stance: stance, UserID: uid, Username: username,
		AvatarURL: avatar, CreatedAt: now.Format(time.RFC3339), Mine: true,
	})
}

func (h *Handler) HandleDeletePOVComment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "commentID")
	_, _ = h.pool.Exec(r.Context(), dbq.SQL("pov_comments.delete_own"), id, session.UserID(r.Context()))
	httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
