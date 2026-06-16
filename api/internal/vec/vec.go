// Package vec holds small, pure vector helpers shared by the API server and the
// batch job: centroid math, preference-weighted blending, and rune-safe chunking.
// Keeping these in one place avoids the copy that had drifted between
// internal/server and cmd/batch.
package vec

// Mean returns the element-wise mean of the given vectors. Vectors whose length
// differs from the modal (max) dimension are skipped. Returns nil if there is no
// usable vector.
func Mean(vs [][]float32) []float32 {
	dim := 0
	for _, v := range vs {
		if len(v) > dim {
			dim = len(v)
		}
	}
	if dim == 0 {
		return nil
	}
	sum := make([]float32, dim)
	n := 0
	for _, v := range vs {
		if len(v) != dim {
			continue
		}
		for i := range v {
			sum[i] += v[i]
		}
		n++
	}
	if n == 0 {
		return nil
	}
	for i := range sum {
		sum[i] /= float32(n)
	}
	return sum
}

// BlendSaved blends a user's own-post centroid with their saved-post centroid,
// weighting saves higher (a stronger preference signal): 0.4*own + 0.6*saved.
// Either side may be empty, in which case the other is returned as-is.
func BlendSaved(own, saved []float32) []float32 {
	if len(saved) == 0 {
		return own
	}
	if len(own) == 0 {
		return saved
	}
	n := len(own)
	if len(saved) < n {
		n = len(saved)
	}
	out := make([]float32, n)
	for i := 0; i < n; i++ {
		out[i] = 0.4*own[i] + 0.6*saved[i]
	}
	return out
}

// ChunkRunes splits s into rune-bounded windows of at most size runes (capped at
// maxChunks windows), so multibyte text (e.g. Japanese) is never cut mid-character.
func ChunkRunes(s string, size, maxChunks int) []string {
	r := []rune(s)
	if len(r) <= size {
		return []string{s}
	}
	out := make([]string, 0, maxChunks)
	for i := 0; i < len(r) && len(out) < maxChunks; i += size {
		end := i + size
		if end > len(r) {
			end = len(r)
		}
		out = append(out, string(r[i:end]))
	}
	return out
}
