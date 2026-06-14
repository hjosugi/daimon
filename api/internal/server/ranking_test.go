package server

import "testing"

func tags(xs ...string) map[string]bool {
	m := map[string]bool{}
	for _, x := range xs {
		m[x] = true
	}
	return m
}

func TestHighSimilarityPrefersNear(t *testing.T) {
	out := rankBySenseDistance(
		[]candidate{
			{postID: "far", vector: []float32{0, 1}, tags: tags()},
			{postID: "near", vector: []float32{0.99, 0.14}, tags: tags()},
		},
		[]float32{1, 0}, tags(), 1.0, false, false, 0.3, 2)
	if out[0].postID != "near" {
		t.Fatalf("want near first, got %s", out[0].postID)
	}
}

func TestBridgeOutranksNoiseInDiscovery(t *testing.T) {
	out := rankBySenseDistance(
		[]candidate{
			{postID: "noise", vector: []float32{0, -1}, tags: tags("crypto")},
			{postID: "bridge", vector: []float32{0, 1}, tags: tags("ethics")},
		},
		[]float32{1, 0}, tags("ethics"), 0.0, false, true, 0.3, 2)
	if out[0].postID != "bridge" {
		t.Fatalf("want bridge first, got %s", out[0].postID)
	}
	if out[0].bridgeScore <= 0 {
		t.Fatalf("bridge should have bridgeScore>0, got %v", out[0].bridgeScore)
	}
}

func TestMMRDemotesDuplicate(t *testing.T) {
	out := rankBySenseDistance(
		[]candidate{
			{postID: "a1", vector: []float32{0.95, 0.05}, tags: tags(), relevance: 0.95},
			{postID: "a2", vector: []float32{0.95, 0.05}, tags: tags(), relevance: 0.95},
			{postID: "b", vector: []float32{0.80, 0.60}, tags: tags(), relevance: 0.80},
		},
		[]float32{1, 0}, tags(), 1.0, false, false, 0.7, 2)
	if out[1].postID != "b" {
		t.Fatalf("MMR should surface distinct 'b' at slot 2, got %s", out[1].postID)
	}
}

func TestEmptyReturnsNil(t *testing.T) {
	if rankBySenseDistance(nil, nil, tags(), 0.7, false, false, 0.3, 10) != nil {
		t.Fatal("expected nil for empty input")
	}
}
