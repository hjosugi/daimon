package ranking

import "testing"

func tags(xs ...string) map[string]bool {
	m := map[string]bool{}
	for _, x := range xs {
		m[x] = true
	}
	return m
}

func TestHighSimilarityPrefersNear(t *testing.T) {
	out := RankBySenseDistance(
		[]Candidate{
			{PostID: "far", Vector: []float32{0, 1}, Tags: tags()},
			{PostID: "near", Vector: []float32{0.99, 0.14}, Tags: tags()},
		},
		[]float32{1, 0}, tags(), 1.0, false, false, 0.3, 2)
	if out[0].PostID != "near" {
		t.Fatalf("want near first, got %s", out[0].PostID)
	}
}

func TestBridgeOutranksNoiseInDiscovery(t *testing.T) {
	out := RankBySenseDistance(
		[]Candidate{
			{PostID: "noise", Vector: []float32{0, -1}, Tags: tags("crypto")},
			{PostID: "bridge", Vector: []float32{0, 1}, Tags: tags("ethics")},
		},
		[]float32{1, 0}, tags("ethics"), 0.0, false, true, 0.3, 2)
	if out[0].PostID != "bridge" {
		t.Fatalf("want bridge first, got %s", out[0].PostID)
	}
	if out[0].BridgeScore <= 0 {
		t.Fatalf("bridge should have BridgeScore>0, got %v", out[0].BridgeScore)
	}
}

func TestMMRDemotesDuplicate(t *testing.T) {
	out := RankBySenseDistance(
		[]Candidate{
			{PostID: "a1", Vector: []float32{0.95, 0.05}, Tags: tags(), Relevance: 0.95},
			{PostID: "a2", Vector: []float32{0.95, 0.05}, Tags: tags(), Relevance: 0.95},
			{PostID: "b", Vector: []float32{0.80, 0.60}, Tags: tags(), Relevance: 0.80},
		},
		[]float32{1, 0}, tags(), 1.0, false, false, 0.7, 2)
	if out[1].PostID != "b" {
		t.Fatalf("MMR should surface distinct 'b' at slot 2, got %s", out[1].PostID)
	}
}

func TestEmptyReturnsNil(t *testing.T) {
	if RankBySenseDistance(nil, nil, tags(), 0.7, false, false, 0.3, 10) != nil {
		t.Fatal("expected nil for empty input")
	}
}
