package server

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
	"daimon/api/internal/validate"
)

const sessionExpiryDays = 30

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
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
	Token     *string `json:"token,omitempty"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
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

	ctx := r.Context()
	var existsUser, existsEmail bool
	err := s.pool.QueryRow(ctx, dbq.SQL("auth.user_exists"), username, email).Scan(&existsUser, &existsEmail)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
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
		httpx.Error(w, http.StatusInternalServerError, "Could not hash password")
		return
	}

	now := time.Now().UTC()
	id := uuid.NewString()
	if _, err := s.pool.Exec(ctx, dbq.SQL("auth.insert_user"), id, username, email, string(hash), now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not create user")
		return
	}

	token, err := s.createSession(ctx, id, now)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not create session")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, Token: &token})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	ident := validate.NormalizeUsername(req.EmailOrUsername) // trims
	emailLower := validate.NormalizeEmail(req.EmailOrUsername)

	var (
		id, username, email, hash string
		avatar                    *string
	)
	err := s.pool.QueryRow(r.Context(), dbq.SQL("auth.login_user"), emailLower, ident).Scan(&id, &username, &email, &hash, &avatar)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Database error")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		httpx.Error(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, err := s.createSession(r.Context(), id, time.Now().UTC())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not create session")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar, Token: &token})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	var (
		id, username, email string
		avatar              *string
	)
	err := s.pool.QueryRow(r.Context(), dbq.SQL("auth.user_by_id"), userID(r.Context())).Scan(&id, &username, &email, &avatar)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar})
}

type profileUpdateReq struct {
	Username  *string `json:"username"`
	AvatarURL *string `json:"avatar_url"`
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid := userID(r.Context())
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
		_ = s.pool.QueryRow(ctx, dbq.SQL("auth.username_taken"), username, uid).Scan(&taken)
		if taken {
			httpx.Error(w, http.StatusBadRequest, "Username already exists")
			return
		}
		if _, err := s.pool.Exec(ctx, dbq.SQL("auth.update_username"), username, now, uid); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Could not update profile")
			return
		}
	}
	if req.AvatarURL != nil {
		if _, err := s.pool.Exec(ctx, dbq.SQL("auth.update_avatar_url"), *req.AvatarURL, now, uid); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "Could not update profile")
			return
		}
	}

	var (
		id, username, email string
		avatar              *string
	)
	if err := s.pool.QueryRow(ctx, dbq.SQL("auth.user_by_id"), uid).Scan(&id, &username, &email, &avatar); err != nil {
		httpx.Error(w, http.StatusNotFound, "User not found")
		return
	}
	httpx.JSON(w, http.StatusOK, userResp{ID: id, Username: username, Email: email, AvatarURL: avatar})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	_, _ = s.pool.Exec(r.Context(), dbq.SQL("auth.delete_session"), token)
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (s *Server) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	// ON DELETE CASCADE removes posts/likes/comments/sessions. Qdrant cleanup
	// is handled lazily (regenerable index).
	if _, err := s.pool.Exec(r.Context(), dbq.SQL("auth.delete_user"), userID(r.Context())); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Could not delete account")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Account deleted successfully"})
}

func (s *Server) createSession(ctx context.Context, uid string, now time.Time) (string, error) {
	token := uuid.NewString()
	_, err := s.pool.Exec(ctx, dbq.SQL("auth.insert_session"), token, uid, now, now.Add(sessionExpiryDays*24*time.Hour))
	return token, err
}
