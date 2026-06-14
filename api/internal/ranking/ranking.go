// Package ranking implements the Sense-Distance discovery ranker (MMR +
// bridge scoring). Shared by the API server and the batch precompute jobs.
package ranking

import (
	"math"
	"sort"
	"strings"
)

// Candidate is a scoring candidate. Vector is the raw embedding (normalized here).
type Candidate struct {
	PostID     string
	Vector     []float32
	Tags       map[string]bool
	Relevance  float32 // cosine sim to the query (e.g. Qdrant hit score)
	Popularity float32 // normalized 0..1
	Recency    float32 // normalized 0..1

	// Filled in by the ranker:
	SimToUser   float32
	BridgeScore float32
	FinalScore  float32
	Reason      string
}

func dot(a, b []float32) float32 {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	var s float32
	for i := 0; i < n; i++ {
		s += a[i] * b[i]
	}
	return s
}

func normalize(v []float32) []float32 {
	n := float32(math.Sqrt(float64(dot(v, v))))
	if n == 0 {
		return v
	}
	out := make([]float32, len(v))
	for i := range v {
		out[i] = v[i] / n
	}
	return out
}

// RankBySenseDistance scores and reranks candidates, returning the top_k in
// display order.
//
//	base = α·near + (1-α)·bridge + 0.15·common_ground [+ 0.20·popularity]
//
// then MMR removes near-duplicates. A "bridge" is a post far from the user
// that shares a value (POV) — the echo-chamber breaker.
func RankBySenseDistance(
	cands []Candidate,
	userCentroid []float32,
	userTags map[string]bool,
	simWeight float32,
	boostPopular, includeFar bool,
	diversity float32,
	topK int,
) []Candidate {
	if len(cands) == 0 {
		return nil
	}
	alpha := clamp01(simWeight)
	var uc []float32
	if len(userCentroid) > 0 {
		uc = normalize(userCentroid)
	}

	for i := range cands {
		c := &cands[i]
		c.Vector = normalize(c.Vector)

		sim := c.Relevance
		if uc != nil {
			sim = dot(uc, c.Vector)
		}
		if sim < 0 {
			sim = 0
		}
		c.SimToUser = sim
		near := sim
		far := 1 - sim

		var common float32
		var shared []string
		for t := range c.Tags {
			if userTags[t] {
				shared = append(shared, t)
			}
		}
		if len(shared) > 0 {
			common = 1
		}
		if includeFar && common > 0 {
			c.BridgeScore = far
		}

		base := alpha*near + (1-alpha)*c.BridgeScore + 0.15*common
		if boostPopular {
			base += 0.20 * clamp01(c.Popularity)
			base += 0.10 * clamp01(c.Recency)
		}
		c.FinalScore = base
		c.Reason = explainReason(sim, shared, includeFar)
	}

	lam := clamp01(diversity)
	pool := make([]int, len(cands))
	for i := range pool {
		pool[i] = i
	}
	sort.SliceStable(pool, func(a, b int) bool {
		return cands[pool[a]].FinalScore > cands[pool[b]].FinalScore
	})

	selected := make([]Candidate, 0, topK)
	used := make([]bool, len(cands))
	for len(selected) < topK && len(selected) < len(cands) {
		bestPos, bestMMR := -1, float32(math.Inf(-1))
		for _, idx := range pool {
			if used[idx] {
				continue
			}
			c := cands[idx]
			if len(selected) == 0 {
				bestPos = idx
				break
			}
			var redundancy float32 = -1
			for _, sel := range selected {
				if d := dot(c.Vector, sel.Vector); d > redundancy {
					redundancy = d
				}
			}
			mmr := (1-lam)*c.FinalScore - lam*redundancy
			if mmr > bestMMR {
				bestMMR, bestPos = mmr, idx
			}
		}
		if bestPos < 0 {
			break
		}
		used[bestPos] = true
		selected = append(selected, cands[bestPos])
	}
	return selected
}

func explainReason(simToUser float32, shared []string, farOn bool) string {
	if len(shared) > 0 && farOn && simToUser < 0.45 {
		return "遠い視点・共通の価値観: " + strings.Join(firstN(shared, 2), ", ")
	}
	if len(shared) > 0 {
		return "共通の価値観: " + strings.Join(firstN(shared, 2), ", ")
	}
	if simToUser >= 0.6 {
		return "あなたの感性に近い"
	}
	return "新しい視点"
}

func clamp01(x float32) float32 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}

func firstN(s []string, n int) []string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Cosine returns the cosine similarity of two raw vectors.
func Cosine(a, b []float32) float32 {
	na, nb := normalize(a), normalize(b)
	return dot(na, nb)
}
