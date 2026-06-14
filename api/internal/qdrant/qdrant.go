// Package qdrant is a minimal REST client for Qdrant (works for both a local
// server and Qdrant Cloud). We use REST to avoid a gRPC/TLS dependency.
package qdrant

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	Collection = "posts"
	VectorSize = 384
)

type Client struct {
	base   string
	apiKey string
	http   *http.Client
}

func New(base, apiKey string) *Client {
	return &Client{base: base, apiKey: apiKey, http: &http.Client{Timeout: 20 * time.Second}}
}

type Hit struct {
	ID      string         `json:"id"`
	Score   float32        `json:"score"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

type Point struct {
	ID      string         `json:"id"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

func (c *Client) do(ctx context.Context, method, path string, in, out any) error {
	var body []byte
	if in != nil {
		body, _ = json.Marshal(in)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("qdrant %s %s: status %d", method, path, resp.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// EnsureCollection creates the collection if it does not exist.
func (c *Client) EnsureCollection(ctx context.Context) error {
	err := c.do(ctx, http.MethodGet, "/collections/"+Collection, nil, nil)
	if err == nil {
		return nil
	}
	return c.do(ctx, http.MethodPut, "/collections/"+Collection, map[string]any{
		"vectors": map[string]any{"size": VectorSize, "distance": "Cosine"},
	}, nil)
}

func tagFilter(requiredTags []string) map[string]any {
	if len(requiredTags) == 0 {
		return nil
	}
	should := make([]map[string]any, 0, len(requiredTags))
	for _, t := range requiredTags {
		should = append(should, map[string]any{"key": "tags", "match": map[string]any{"value": t}})
	}
	return map[string]any{"should": should}
}

// Search returns nearest points to vector.
func (c *Client) Search(ctx context.Context, vector []float32, limit int, requiredTags []string, withVectors bool) ([]Hit, error) {
	req := map[string]any{
		"vector":       vector,
		"limit":        limit,
		"with_payload": true,
		"with_vector":  withVectors,
	}
	if f := tagFilter(requiredTags); f != nil {
		req["filter"] = f
	}
	var out struct {
		Result []Hit `json:"result"`
	}
	if err := c.do(ctx, http.MethodPost, "/collections/"+Collection+"/points/search", req, &out); err != nil {
		return nil, err
	}
	return out.Result, nil
}

func (c *Client) Upsert(ctx context.Context, points []Point) error {
	return c.do(ctx, http.MethodPut, "/collections/"+Collection+"/points",
		map[string]any{"points": points}, nil)
}

func (c *Client) Delete(ctx context.Context, ids []string) error {
	return c.do(ctx, http.MethodPost, "/collections/"+Collection+"/points/delete",
		map[string]any{"points": ids}, nil)
}

// UserPoints returns all points for a user (vectors included).
func (c *Client) UserPoints(ctx context.Context, userID string, limit int) ([]Point, error) {
	req := map[string]any{
		"filter":       map[string]any{"must": []map[string]any{{"key": "user_id", "match": map[string]any{"value": userID}}}},
		"limit":        limit,
		"with_payload": true,
		"with_vector":  true,
	}
	var out struct {
		Result struct {
			Points []Point `json:"points"`
		} `json:"result"`
	}
	if err := c.do(ctx, http.MethodPost, "/collections/"+Collection+"/points/scroll", req, &out); err != nil {
		return nil, err
	}
	return out.Result.Points, nil
}
