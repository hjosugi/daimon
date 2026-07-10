package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/config"
	"daimon/api/internal/db"
)

type integrationHarness struct {
	pool   *pgxpool.Pool
	router http.Handler
}

type integrationUser struct {
	ID       string
	Username string
	Email    string
	Token    string
}

func newIntegrationHarness(t *testing.T) integrationHarness {
	t.Helper()

	dsn := os.Getenv("DAIMON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set DAIMON_TEST_DATABASE_URL to run handler integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := db.EnsureSchema(ctx, pool); err != nil {
		t.Fatalf("ensure schema: %v", err)
	}
	if _, err := pool.Exec(ctx, "TRUNCATE TABLE users CASCADE"); err != nil {
		t.Fatalf("reset test database: %v", err)
	}

	cfg := config.Config{
		QdrantURL:   "http://127.0.0.1:1",
		EmbedURL:    "http://127.0.0.1:1",
		CORSOrigins: []string{"http://localhost:5173"},
	}
	return integrationHarness{pool: pool, router: New(pool, cfg).Router()}
}

func TestRequireAuthRejectsMissingToken(t *testing.T) {
	h := newIntegrationHarness(t)

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestReadinessSucceedsWhenDatabaseIsAvailable(t *testing.T) {
	h := newIntegrationHarness(t)

	for _, path := range []string{"/health", "/readyz"} {
		t.Run(path, func(t *testing.T) {
			rec := get(t, h.router, path)
			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
			}
			assertHealthResponse(t, rec, "ok", "available")
		})
	}
}

func TestRegisterRejectsDuplicateUsername(t *testing.T) {
	h := newIntegrationHarness(t)

	registerUser(t, h.router, "same-user", "same-user@example.com")
	rec := postJSON(t, h.router, "/auth/register", map[string]any{
		"username": "same-user",
		"email":    "other-email@example.com",
		"password": "password123",
	}, "")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
	assertDetail(t, rec, "Username already exists")
}

func TestDeletePostRejectsNonOwner(t *testing.T) {
	h := newIntegrationHarness(t)
	ctx := context.Background()

	owner := registerUser(t, h.router, "owner-user", "owner@example.com")
	attacker := registerUser(t, h.router, "other-user", "other@example.com")
	postID := uuid.NewString()
	now := time.Now().UTC()
	if _, err := h.pool.Exec(ctx,
		`INSERT INTO posts (id, user_id, username, text, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$5)`,
		postID, owner.ID, owner.Username, "owned post", now,
	); err != nil {
		t.Fatalf("insert test post: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/posts/"+postID, nil)
	req.Header.Set("Authorization", "Bearer "+attacker.Token)
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}

	var exists bool
	if err := h.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM posts WHERE id=$1)", postID).Scan(&exists); err != nil {
		t.Fatalf("check post existence: %v", err)
	}
	if !exists {
		t.Fatal("non-owner delete removed the post")
	}
}

func registerUser(t *testing.T, router http.Handler, username, email string) integrationUser {
	t.Helper()
	rec := postJSON(t, router, "/auth/register", map[string]any{
		"username": username,
		"email":    email,
		"password": "password123",
	}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("register %s: expected 200, got %d: %s", username, rec.Code, rec.Body.String())
	}

	var out struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		Email    string `json:"email"`
		Token    string `json:"token"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	if out.Token == "" {
		t.Fatal("register response did not include a token")
	}
	return integrationUser{ID: out.ID, Username: out.Username, Email: out.Email, Token: out.Token}
}

func postJSON(t *testing.T, router http.Handler, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func assertDetail(t *testing.T, rec *httptest.ResponseRecorder, want string) {
	t.Helper()
	var out struct {
		Detail string `json:"detail"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if out.Detail != want {
		t.Fatalf("expected detail %q, got %q", want, out.Detail)
	}
}
