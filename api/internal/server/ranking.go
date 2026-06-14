package server

import (
	"math"
	"sort"
	"strings"
)

// matchReason explains why a post surfaced (sent to the UI).
type matchReason struct {
	PovMatches    []string `json:"pov_matches"`
	CommonPovs    []string `json:"common_povs"`
	PovMatchRate  *float32 `json:"pov_match_rate"`
	MatchedBy     string   `json:"matched_by"`
	Reason        *string  `json:"reason"`
	SenseDistance *float32 `json:"sense_distance"`
	IsBridge      *bool    `json:"is_bridge"`
}

// candidate is a scoring candidate for the Sense-Distance ranker.
type candidate struct {
	postID     string
	vector     []float32
	tags       map[string]bool
	relevance  float32
	popularity float32

	simToUser   float32
	bridgeScore float32
	finalScore  float32
	reason      string
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

// rankBySenseDistance scores and reranks candidates, returning the top_k in
// display order. Port of services/discovery_service.py.
//
//	base = α·near + (1-α)·bridge + 0.15·common_ground [+ 0.20·popularity]
//
// then MMR removes near-duplicates. A "bridge" is a post that is far from the
// user yet shares a value (POV) — the echo-chamber breaker.
func rankBySenseDistance(
	cands []candidate,
	userCentroid []float32,
	userTags map[string]bool,
	simWeight float32,
	boostPopular, includeFar bool,
	diversity float32,
	topK int,
) []candidate {
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
		c.vector = normalize(c.vector)

		sim := c.relevance
		if uc != nil {
			sim = dot(uc, c.vector)
		}
		if sim < 0 {
			sim = 0
		}
		c.simToUser = sim
		near := sim
		far := 1 - sim

		var common float32
		var shared []string
		for t := range c.tags {
			if userTags[t] {
				shared = append(shared, t)
			}
		}
		if len(shared) > 0 {
			common = 1
		}
		if includeFar && common > 0 {
			c.bridgeScore = far
		}

		base := alpha*near + (1-alpha)*c.bridgeScore + 0.15*common
		if boostPopular {
			base += 0.20 * clamp01(c.popularity)
		}
		c.finalScore = base
		c.reason = explainReason(sim, shared, includeFar)
	}

	// MMR rerank for diversity.
	lam := clamp01(diversity)
	pool := make([]int, len(cands))
	for i := range pool {
		pool[i] = i
	}
	sort.SliceStable(pool, func(a, b int) bool {
		return cands[pool[a]].finalScore > cands[pool[b]].finalScore
	})

	selected := make([]candidate, 0, topK)
	used := make([]bool, len(cands))
	for len(selected) < topK && len(selected) < len(cands) {
		bestPos, bestMMR := -1, float32(math.Inf(-1))
		for _, idx := range pool {
			if used[idx] {
				continue
			}
			c := cands[idx]
			if len(selected) == 0 {
				bestPos, bestMMR = idx, c.finalScore
				break
			}
			var redundancy float32 = -1
			for _, sel := range selected {
				if d := dot(c.vector, sel.vector); d > redundancy {
					redundancy = d
				}
			}
			mmr := (1-lam)*c.finalScore - lam*redundancy
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
