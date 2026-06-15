// Package server wires the HTTP API (chi router, middleware, handlers).
package server

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/cache"
	"daimon/api/internal/config"
	dbq "daimon/api/internal/db"
	"daimon/api/internal/embed"
	"daimon/api/internal/httpx"
	"daimon/api/internal/qdrant"
)

type Server struct {
	pool   *pgxpool.Pool
	cfg    config.Config
	embed  *embed.Client
	qdrant *qdrant.Client
	cache  *cache.Cache
}

func New(pool *pgxpool.Pool, cfg config.Config) *Server {
	return &Server{
		pool:   pool,
		cfg:    cfg,
		embed:  embed.New(cfg.EmbedURL),
		qdrant: qdrant.New(cfg.QdrantURL, cfg.QdrantAPIKey),
		cache:  cache.New(cfg.RedisURL),
	}
}

// Bootstrap prepares external resources (best-effort; the Qdrant index is
// regenerable, so failures here are logged, not fatal).
func (s *Server) Bootstrap(ctx context.Context) {
	if err := s.qdrant.EnsureCollection(ctx); err != nil {
		log.Printf("qdrant ensure collection: %v", err)
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", s.handleRegister)
		r.Post("/login", s.handleLogin)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/me", s.handleMe)
			r.Put("/profile", s.handleUpdateProfile)
			r.Post("/logout", s.handleLogout)
			r.Delete("/account", s.handleDeleteAccount)
		})
	})

	r.Route("/posts", func(r chi.Router) {
		// Public reads.
		r.Get("/{id}/comments", s.handleGetComments)
		r.Get("/{id}/likes", s.handleGetLikers) // who liked
		r.Post("/generate-povs", s.handleGeneratePOVs)
		r.Get("/povs/suggest", s.handleSuggestPOVs)
		r.With(s.optionalAuth).Get("/povs/{pov}/comments", s.handlePOVComments)
		r.Get("/by-user/{userID}", s.handleUserPosts) // a user's other posts

		// Feeds: auth is optional (used for personalization + liked flags).
		r.Group(func(r chi.Router) {
			r.Use(s.optionalAuth)
			r.Post("/timeline", s.handleTimeline)
			r.Post("/search", s.handleSearch)
		})

		// Authenticated writes.
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/", s.handleCreatePost)
			r.Get("/following", s.handleFollowingFeed)
			r.Get("/saved", s.handleSavedFeed)
			r.Delete("/{id}", s.handleDeletePost)
			r.Post("/{id}/save", s.handleSavePost)
			r.Delete("/{id}/save", s.handleUnsavePost)
			r.Get("/{id}/save-status", s.handleSaveStatus)
			r.Post("/{id}/like", s.handleLike)
			r.Delete("/{id}/like", s.handleUnlike)
			r.Post("/{id}/comments", s.handleAddComment)
			r.Post("/povs/{pov}/like", s.handleLikePOV)
			r.Delete("/povs/{pov}/like", s.handleUnlikePOV)
			r.Get("/povs/{pov}/like-status", s.handlePOVLikeStatus)
			r.Post("/povs/{pov}/comments", s.handleAddPOVComment)
			r.Delete("/povs/{pov}/comments/{commentID}", s.handleDeletePOVComment)
		})
	})

	r.Route("/users", func(r chi.Router) {
		r.With(s.optionalAuth).Get("/{id}", s.handleUserProfile)
		r.With(s.optionalAuth).Get("/{id}/followers", s.handleFollowers)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/{id}/follow", s.handleFollow)
			r.Delete("/{id}/follow", s.handleUnfollow)
			r.Delete("/{id}/follower", s.handleRemoveFollower)
		})
	})

	return r
}

func (s *Server) optionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, _ := s.userFromToken(r) // "" when absent/invalid
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, uid)))
	})
}

// --- auth context ---------------------------------------------------------

type ctxKey string

const userIDKey ctxKey = "userID"

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.userFromToken(r)
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, uid)))
	})
}

// userFromToken resolves a Bearer token to a user id, or ("", false).
func (s *Server) userFromToken(r *http.Request) (string, bool) {
	authz := r.Header.Get("Authorization")
	if !strings.HasPrefix(authz, "Bearer ") {
		return "", false
	}
	token := strings.TrimPrefix(authz, "Bearer ")
	var uid string
	err := s.pool.QueryRow(r.Context(), dbq.SQL("auth.session_user"), token, time.Now().UTC()).Scan(&uid)
	if err != nil {
		return "", false
	}
	return uid, true
}

func userID(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}
