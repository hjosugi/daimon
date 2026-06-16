package vec

import "testing"

func TestMean(t *testing.T) {
	got := Mean([][]float32{{0, 2}, {2, 4}})
	if len(got) != 2 || got[0] != 1 || got[1] != 3 {
		t.Fatalf("Mean = %v, want [1 3]", got)
	}
	// Vectors shorter than the max dimension are skipped (here the stray {9,9}).
	got = Mean([][]float32{{2, 2, 2}, {4, 4, 4}, {9, 9}})
	if len(got) != 3 || got[0] != 3 || got[2] != 3 {
		t.Fatalf("Mean(mixed) = %v, want [3 3 3]", got)
	}
	if Mean(nil) != nil {
		t.Fatal("Mean(nil) should be nil")
	}
}

func TestBlendSaved(t *testing.T) {
	got := BlendSaved([]float32{0}, []float32{10}) // 0.4*0 + 0.6*10
	if len(got) != 1 || got[0] != 6 {
		t.Fatalf("BlendSaved = %v, want [6]", got)
	}
	if g := BlendSaved([]float32{5}, nil); g[0] != 5 {
		t.Fatalf("empty saved should return own, got %v", g)
	}
	if g := BlendSaved(nil, []float32{5}); g[0] != 5 {
		t.Fatalf("empty own should return saved, got %v", g)
	}
}

func TestChunkRunes(t *testing.T) {
	if got := ChunkRunes("abc", 10, 4); len(got) != 1 || got[0] != "abc" {
		t.Fatalf("short text should be one chunk, got %v", got)
	}
	// Multibyte must not be cut mid-character.
	got := ChunkRunes("あいうえお", 2, 9)
	if len(got) != 3 || got[0] != "あい" || got[2] != "お" {
		t.Fatalf("ChunkRunes(JA) = %v, want [あい うえ お]", got)
	}
	if got := ChunkRunes("aaaaaa", 2, 2); len(got) != 2 {
		t.Fatalf("maxChunks should cap, got %v", got)
	}
}
