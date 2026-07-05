package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
	"daimon/api/internal/server/session"
	"daimon/api/internal/validate"
)

const sessionExpiryDays = 30

type registerReq struct {
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Bio      *string `json:"bio"`
}

type loginReq struct {
	EmailOrUsername string `json:"email_or_username"`
	Password        string `json:"password"`
}

type userResp struct {
	ID        string  `json:"id"`
	Username  string  `json:"username"`
	Email     string  `json:"email"`
	AvatarURL *string `json:"avatar_url"`
	Bio       *string `json:"bio"`
	Token     *string `json:"token,omitempty"`
}

func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	username, uerr := validate.Username(req.Username)
	if uerr != "" {
		httpx.Error(w, http.StatusBadRequest, uerr)
		return
	}
	email, eerr := validate.Email(req.Email)
	if eerr != "" {
		httpx.Error(w, http.StatusBadRequest, eerr)
		return
	}
	if perr := validate.Password(req.Password); perr != "" {
		httpx.Error(w, http.StatusBadRequest, perr)
		return
	}
	var bio *string
	if req.Bio != nil {
		cleanBio, berr := validate.Bio(*req.Bio)
		if berr != "" {
			httpx.Error(w, http.StatusBadRequest, berr)
			return
		}
		bio = &cleanBio
	}

	ctx := r.Context()
	var existsUser, existsEmail bool
	err := h.pool.QueryRow(ctx, dbq.SQL("auth.user_exists"), username, email).Scan(&existsUser, &existsEmail)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if existsUser {
		httpx.Error(w, http.StatusBadRequest, "Username already exists")
		return
	}
	if existsEmail {
		httpx.Error(w, http.StatusBadRequest, "Email already exists")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respond.Internal(w, r, h.logger, "Could not hash password", err)
		return
	}

	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := h.pool.Exec(ctx, dbq.SQL("auth.insert_user"), id, username, email, string(hash), bio, now); err != nil {
		respond.Internal(w, r, h.logger, "Could not create user", err)
		return
	}

	token, err := h.createSession(ctx, id, now)
	if err != nil {
		respond.Internal(w, r, h.logger, "Could not create session", err)
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, Bio: bio, Token: &token})
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ident := validate.NormalizeUsername(req.EmailOrUsername) // trims
	emailLower := validate.NormalizeEmail(req.EmailOrUsername)

	var (
		id, username, email, hash string
		avatar, bio               *string
	)
	err := h.pool.QueryRow(r.Context(), dbq.SQL("auth.login_user"), emailLower, ident).Scan(&id, &username, &email, &hash, &avatar, &bio)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		httpx.Error(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := h.createSession(r.Context(), id, time.Now().UTC())
	if err != nil {
		respond.Internal(w, r, h.logger, "Could not create session", err)
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar, Bio: bio, Token: &token})
}

func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	var (
		id, username, email string
		avatar, bio         *string
	)
	err := h.pool.QueryRow(r.Context(), dbq.SQL("auth.user_by_id"), session.UserID(r.Context())).Scan(&id, &username, &email, &avatar, &bio)
	if err != nil {
		respond.Warn(h.logger, r, "current user lookup failed", err)
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar, Bio: bio})
}

type profileUpdateReq struct {
	Username  *string `json:"username"`
	AvatarURL *string `json:"avatar_url"`
	Bio       *string `json:"bio"`
}

func (h *Handler) HandleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid := session.UserID(r.Context())
	var req profileUpdateReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ctx := r.Context()
	now := time.Now().UTC()

	if req.Username != nil {
		username, uerr := validate.Username(*req.Username)
		if uerr != "" {
			httpx.Error(w, http.StatusBadRequest, uerr)
			return
		}
		var taken bool
		if err := h.pool.QueryRow(ctx, dbq.SQL("auth.username_taken"), username, uid).Scan(&taken); err != nil {
			respond.Internal(w, r, h.logger, "Database error", err)
			return
		}
		if taken {
			httpx.Error(w, http.StatusBadRequest, "Username already exists")
			return
		}
		if _, err := h.pool.Exec(ctx, dbq.SQL("auth.update_username"), username, now, uid); err != nil {
			respond.Internal(w, r, h.logger, "Could not update profile", err)
			return
		}
	}
	if req.AvatarURL != nil {
		if _, err := h.pool.Exec(ctx, dbq.SQL("auth.update_avatar_url"), *req.AvatarURL, now, uid); err != nil {
			respond.Internal(w, r, h.logger, "Could not update profile", err)
			return
		}
	}
	if req.Bio != nil {
		bio, berr := validate.Bio(*req.Bio)
		if berr != "" {
			httpx.Error(w, http.StatusBadRequest, berr)
			return
		}
		if _, err := h.pool.Exec(ctx, dbq.SQL("auth.update_bio"), bio, now, uid); err != nil {
			respond.Internal(w, r, h.logger, "Could not update profile", err)
			return
		}
	}

	var (
		id, username, email string
		avatar, bio         *string
	)
	if err := h.pool.QueryRow(ctx, dbq.SQL("auth.user_by_id"), uid).Scan(&id, &username, &email, &avatar, &bio); err != nil {
		respond.Warn(h.logger, r, "updated user lookup failed", err)
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar, Bio: bio})
}

func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if _, err := h.pool.Exec(r.Context(), dbq.SQL("auth.delete_session"), token); err != nil {
		respond.Internal(w, r, h.logger, "Could not logout", err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *Handler) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := session.UserID(ctx)

	postIDs, err := h.userPostIDs(ctx, uid)
	if err != nil {
		respond.Internal(w, r, h.logger, "Database error", err)
		return
	}

	// ON DELETE CASCADE removes relational rows. Qdrant is a regenerable search
	// index, so point cleanup is best-effort after the database delete succeeds.
	if _, err := h.pool.Exec(ctx, dbq.SQL("auth.delete_user"), uid); err != nil {
		respond.Internal(w, r, h.logger, "Could not delete account", err)
		return
	}
	if len(postIDs) > 0 {
		if err := h.qdrant.Delete(ctx, postIDs); err != nil {
			respond.Warn(h.logger, r, "qdrant account cleanup failed", err)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Account deleted successfully"})
}

func (h *Handler) userPostIDs(ctx context.Context, uid string) ([]string, error) {
	rows, err := h.pool.Query(ctx, dbq.SQL("auth.user_post_ids"), uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func (h *Handler) createSession(ctx context.Context, uid string, now time.Time) (string, error) {
	token := uuid.NewString()
	_, err := h.pool.Exec(ctx, dbq.SQL("auth.insert_session"), token, uid, now, now.Add(sessionExpiryDays*24*time.Hour))
	return token, err
}
