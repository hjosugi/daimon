package embed

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testVector(dim int) []float32 {
	v := make([]float32, dim)
	for i := range v {
		v[i] = float32(i)
	}
	return v
}

func TestEmbedBatchValidatesVectorCount(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embed_batch" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"vectors": [][]float32{testVector(VectorDim)},
		})
	}))
	defer srv.Close()

	client := NewWithTimeout(srv.URL, time.Second)
	_, err := client.EmbedBatch(context.Background(), []string{"a", "b"})
	if err == nil || !strings.Contains(err.Error(), "vector count 1 != input count 2") {
		t.Fatalf("expected vector count error, got %v", err)
	}
}

func TestEmbedBatchValidatesVectorDimension(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"vectors": [][]float32{testVector(VectorDim), testVector(VectorDim - 1)},
		})
	}))
	defer srv.Close()

	client := NewWithTimeout(srv.URL, time.Second)
	_, err := client.EmbedBatch(context.Background(), []string{"a", "b"})
	if err == nil || !strings.Contains(err.Error(), "vector 1 dimension 383 != 384") {
		t.Fatalf("expected vector dimension error, got %v", err)
	}
}

func TestEmbedValidatesVectorDimension(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"vector": testVector(VectorDim - 1),
		})
	}))
	defer srv.Close()

	client := NewWithTimeout(srv.URL, time.Second)
	_, err := client.Embed(context.Background(), "text")
	if err == nil || !strings.Contains(err.Error(), "vector dimension 383 != 384") {
		t.Fatalf("expected vector dimension error, got %v", err)
	}
}

func TestPostIncludesErrorBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"detail":{"error":"embedding_failed"}}`))
	}))
	defer srv.Close()

	client := NewWithTimeout(srv.URL, time.Second)
	_, err := client.Embed(context.Background(), "text")
	if err == nil || !strings.Contains(err.Error(), `"error":"embedding_failed"`) {
		t.Fatalf("expected response body in error, got %v", err)
	}
}
