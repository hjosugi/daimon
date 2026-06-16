// Package embed is a thin client for the Python ML microservice
// (sentence-transformers embeddings + spaCy POV extraction).
package embed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	base string
	http *http.Client
}

func New(base string) *Client {
	return NewWithTimeout(base, 30*time.Second)
}

// NewWithTimeout is like New but with a custom HTTP timeout (e.g. seeding sends
// large embedding batches that take longer than the default request budget).
func NewWithTimeout(base string, timeout time.Duration) *Client {
	return &Client{base: base, http: &http.Client{Timeout: timeout}}
}

func (c *Client) post(ctx context.Context, path string, in, out any) error {
	body, _ := json.Marshal(in)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("ml service %s: status %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Embed returns the 384-d embedding for a single text.
func (c *Client) Embed(ctx context.Context, text string) ([]float32, error) {
	var out struct {
		Vector []float32 `json:"vector"`
	}
	if err := c.post(ctx, "/embed", map[string]string{"text": text}, &out); err != nil {
		return nil, err
	}
	return out.Vector, nil
}

// EmbedBatch returns the 384-d embeddings for many texts in one round-trip
// (used by the seed command to avoid one HTTP call per post).
func (c *Client) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	var out struct {
		Vectors [][]float32 `json:"vectors"`
	}
	if err := c.post(ctx, "/embed_batch", map[string]any{"texts": texts}, &out); err != nil {
		return nil, err
	}
	return out.Vectors, nil
}

// POVs returns auto-extracted POV suggestions for a text.
func (c *Client) POVs(ctx context.Context, text string) ([]string, error) {
	var out struct {
		Povs []string `json:"povs"`
	}
	if err := c.post(ctx, "/povs", map[string]string{"text": text}, &out); err != nil {
		return nil, err
	}
	return out.Povs, nil
}
