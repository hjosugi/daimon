package feed

import (
	"testing"
	"time"

	"daimon/api/internal/qdrant"
)

func TestBuildTimelineCandidates(t *testing.T) {
	now := time.Date(2026, 7, 5, 0, 0, 0, 0, time.UTC)
	hits := []qdrant.Hit{
		{ID: "visible", Score: 0.75, Vector: []float32{0.1, 0.2}},
		{ID: "mine", Score: 0.95, Vector: []float32{0.3, 0.4}},
		{ID: "missing", Score: 0.5, Vector: []float32{0.5, 0.6}},
	}
	b := bundle{
		meta: map[string]postMeta{
			"visible": {
				userID:    "other-user",
				username:  "alice",
				text:      "visible post",
				createdAt: now.Add(-15 * 24 * time.Hour),
			},
			"mine": {
				userID:    "viewer",
				username:  "me",
				text:      "own post",
				createdAt: now,
			},
		},
		povs: map[string][]string{
			"visible": {"pov-a", "pov-b", "pov-a"},
			"mine":    {"pov-c"},
		},
		likeCounts: map[string]int{"visible": 4},
	}
	saveCounts := map[string]int{"visible": 2}

	candidates := buildTimelineCandidates(hits, b, saveCounts, "viewer", now)
	if len(candidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(candidates))
	}

	candidate := candidates[0]
	if candidate.PostID != "visible" {
		t.Fatalf("expected visible candidate, got %q", candidate.PostID)
	}
	if candidate.Relevance != 0.75 {
		t.Fatalf("expected relevance 0.75, got %v", candidate.Relevance)
	}
	if candidate.Popularity != 1 {
		t.Fatalf("expected popularity 1, got %v", candidate.Popularity)
	}
	if candidate.Recency != 0.5 {
		t.Fatalf("expected recency 0.5, got %v", candidate.Recency)
	}
	if !candidate.Tags["pov-a"] || !candidate.Tags["pov-b"] || len(candidate.Tags) != 2 {
		t.Fatalf("unexpected tag set: %#v", candidate.Tags)
	}
}
