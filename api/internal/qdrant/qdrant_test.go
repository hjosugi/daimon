package qdrant

import (
	"math"
	"testing"
)

func TestCosineSimilarity(t *testing.T) {
	t.Parallel()
	if got := cosineSimilarity([]float32{1, 0}, []float32{1, 0}); got != 1 {
		t.Fatalf("identical score=%v", got)
	}
	if got := cosineSimilarity([]float32{1, 0}, []float32{0, 1}); got != 0 {
		t.Fatalf("orthogonal score=%v", got)
	}
	if got := cosineSimilarity([]float32{1, 1}, []float32{-1, -1}); math.Abs(float64(got+1)) > 1e-6 {
		t.Fatalf("opposite score=%v", got)
	}
}

func TestMatchesAnyTag(t *testing.T) {
	t.Parallel()
	payload := map[string]any{"tags": []any{"craft", "morning"}}
	if !matchesAnyTag(payload, []string{"travel", "craft"}) {
		t.Fatal("expected tag match")
	}
	if matchesAnyTag(payload, []string{"travel", "music"}) {
		t.Fatal("unexpected tag match")
	}
	if !matchesAnyTag(payload, nil) {
		t.Fatal("empty filter should match")
	}
}
