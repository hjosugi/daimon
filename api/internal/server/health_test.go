package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/config"
)

func TestLivenessDoesNotDependOnDatabase(t *testing.T) {
	router, closePool := routerWithUnavailableDatabase(t)
	defer closePool()

	rec := get(t, router, "/livez")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertHealthResponse(t, rec, "ok", "")
}

func TestReadinessReportsUnavailableDatabase(t *testing.T) {
	router, closePool := routerWithUnavailableDatabase(t)
	defer closePool()

	for _, path := range []string{"/health", "/readyz"} {
		t.Run(path, func(t *testing.T) {
			rec := get(t, router, path)
			if rec.Code != http.StatusServiceUnavailable {
				t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
			}
			assertHealthResponse(t, rec, "error", "unavailable")
		})
	}
}

func routerWithUnavailableDatabase(t *testing.T) (http.Handler, func()) {
	t.Helper()

	pool, err := pgxpool.New(context.Background(), "postgresql://daimon:daimon@127.0.0.1:1/daimon?sslmode=disable&connect_timeout=1")
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}
	cfg := config.Config{
		QdrantURL:   "http://127.0.0.1:1",
		EmbedURL:    "http://127.0.0.1:1",
		CORSOrigins: []string{"http://localhost:5173"},
	}
	return New(pool, cfg).Router(), pool.Close
}

func get(t *testing.T, router http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func assertHealthResponse(t *testing.T, rec *httptest.ResponseRecorder, wantStatus, wantDatabase string) {
	t.Helper()
	var got struct {
		Status   string `json:"status"`
		Database string `json:"database"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.Status != wantStatus || got.Database != wantDatabase {
		t.Fatalf("expected status=%q database=%q, got status=%q database=%q", wantStatus, wantDatabase, got.Status, got.Database)
	}
}
