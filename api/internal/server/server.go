// Package server wires the HTTP API (chi router, middleware, handlers).
package server

import (
	"context"
	"log/slog"
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
	authhandler "daimon/api/internal/server/auth"
	feedhandler "daimon/api/internal/server/feed"
	posthandler "daimon/api/internal/server/posts"
	povhandler "daimon/api/internal/server/povs"
	"daimon/api/internal/server/session"
	userhandler "daimon/api/internal/server/users"
)

type Server struct {
	pool            *pgxpool.Pool
	cfg             config.Config
	qdrant          *qdrant.Client
	logger          *slog.Logger
	auth            *authhandler.Handler
	feed            *feedhandler.Handler
	posts           *posthandler.Handler
	povs            *povhandler.Handler
	users           *userhandler.Handler
	publicMLLimiter *rateLimiter
}

func New(pool *pgxpool.Pool, cfg config.Config) *Server {
	embedClient := embed.New(cfg.EmbedURL)
	qdrantClient := qdrant.New(pool)
	cacheClient := cache.New(cfg.RedisURL)
	logger := slog.Default().With("component", "api")
	return &Server{
		pool:            pool,
		cfg:             cfg,
		qdrant:          qdrantClient,
		logger:          logger,
		auth:            authhandler.New(pool, qdrantClient, logger.With("domain", "auth")),
		feed:            feedhandler.New(pool, embedClient, qdrantClient, cacheClient, logger.With("domain", "feed")),
		posts:           posthandler.New(pool, embedClient, qdrantClient, logger.With("domain", "posts")),
		povs:            povhandler.New(pool, embedClient, cacheClient, logger.With("domain", "povs")),
		users:           userhandler.New(pool, logger.With("domain", "users")),
		publicMLLimiter: newRateLimiter(30, time.Minute),
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

	// Liveness only reports whether this process can serve HTTP. Readiness also
	// verifies PostgreSQL because it is Daimon's system of record.
	r.Get("/livez", s.handleLiveness)
	r.Get("/readyz", s.handleReadiness)
	r.Get("/health", s.handleReadiness) // Backward-compatible readiness alias.

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", s.auth.HandleRegister)
		r.Post("/login", s.auth.HandleLogin)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Get("/me", s.auth.HandleMe)
			r.Put("/profile", s.auth.HandleUpdateProfile)
			r.Post("/logout", s.auth.HandleLogout)
			r.Delete("/account", s.auth.HandleDeleteAccount)
		})
	})

	r.Route("/posts", func(r chi.Router) {
		// Public reads.
		r.Get("/{id}/comments", s.posts.HandleGetComments)
		r.Get("/{id}/likes", s.posts.HandleGetLikers) // who liked
		r.With(s.publicMLRateLimit).Post("/generate-povs", s.povs.HandleGeneratePOVs)
		r.With(s.publicMLRateLimit).Get("/povs/suggest", s.povs.HandleSuggestPOVs)
		r.With(s.optionalAuth).Get("/povs/{pov}/comments", s.povs.HandlePOVComments)
		r.Get("/by-user/{userID}", s.feed.HandleUserPosts) // a user's other posts

		// Feeds: auth is optional (used for personalization + liked flags).
		r.Group(func(r chi.Router) {
			r.Use(s.optionalAuth)
			r.Post("/timeline", s.feed.HandleTimeline)
			r.Post("/search", s.feed.HandleSearch)
		})

		// Authenticated writes.
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/", s.posts.HandleCreatePost)
			r.Get("/following", s.feed.HandleFollowingFeed)
			r.Get("/saved", s.feed.HandleSavedFeed)
			r.Delete("/{id}", s.posts.HandleDeletePost)
			r.Post("/{id}/save", s.posts.HandleSavePost)
			r.Delete("/{id}/save", s.posts.HandleUnsavePost)
			r.Get("/{id}/save-status", s.posts.HandleSaveStatus)
			r.Post("/{id}/like", s.posts.HandleLike)
			r.Delete("/{id}/like", s.posts.HandleUnlike)
			r.Post("/{id}/comments", s.posts.HandleAddComment)
			r.Post("/povs/{pov}/like", s.povs.HandleLikePOV)
			r.Delete("/povs/{pov}/like", s.povs.HandleUnlikePOV)
			r.Get("/povs/{pov}/like-status", s.povs.HandlePOVLikeStatus)
			r.Post("/povs/{pov}/comments", s.povs.HandleAddPOVComment)
			r.Delete("/povs/{pov}/comments/{commentID}", s.povs.HandleDeletePOVComment)
		})
	})

	r.Route("/users", func(r chi.Router) {
		r.With(s.optionalAuth).Get("/{id}", s.users.HandleUserProfile)
		r.With(s.optionalAuth).Get("/{id}/followers", s.users.HandleFollowers)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/{id}/follow", s.users.HandleFollow)
			r.Delete("/{id}/follow", s.users.HandleUnfollow)
			r.Delete("/{id}/follower", s.users.HandleRemoveFollower)
		})
	})

	return r
}

func (s *Server) handleLiveness(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleReadiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := s.pool.Ping(ctx); err != nil {
		s.logger.WarnContext(r.Context(), "readiness database check failed", "error", err)
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{
			"status":   "error",
			"database": "unavailable",
		})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"status":   "ok",
		"database": "available",
	})
}

func (s *Server) optionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, _ := s.userFromToken(r) // "" when absent/invalid
		next.ServeHTTP(w, r.WithContext(session.WithUserID(r.Context(), uid)))
	})
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := s.userFromToken(r)
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(session.WithUserID(r.Context(), uid)))
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
	err := s.pool.QueryRow(r.Context(), dbq.SQL("auth.session_user"), session.HashToken(token), time.Now().UTC()).Scan(&uid)
	if err != nil {
		return "", false
	}
	return uid, true
}
