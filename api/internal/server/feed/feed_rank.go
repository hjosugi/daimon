package feed

import (
	"strings"
	"time"

	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
)

func defaultTimelineQuery(q string) bool {
	q = strings.TrimSpace(strings.ToLower(q))
	return q == "" || q == "general interest"
}

func defaultTimelineKnobs(req timelineReq) bool {
	return defaultTimelineQuery(req.QueryText) &&
		req.BoostPopular &&
		req.SimilarityWeight > 0.69 &&
		req.SimilarityWeight < 0.71 &&
		!req.IncludeFarPosts
}

func qdrantPointToHit(p qdrant.Point, searchVector []float32) qdrant.Hit {
	return qdrant.Hit{
		ID:      p.ID,
		Score:   ranking.Cosine(searchVector, p.Vector),
		Vector:  p.Vector,
		Payload: p.Payload,
	}
}

func tagSetKeys(tags map[string]bool) []string {
	out := make([]string, 0, len(tags))
	for t := range tags {
		out = append(out, t)
	}
	return out
}

func recencyScore(createdAt, now time.Time) float32 {
	if createdAt.IsZero() {
		return 0
	}
	age := now.Sub(createdAt).Hours() / 24
	if age <= 0 {
		return 1
	}
	score := 1 - float32(age/30)
	if score < 0 {
		return 0
	}
	return score
}

func povCoverageRate(tagList []string, userTags map[string]bool) float32 {
	if len(tagList) == 0 || len(userTags) == 0 {
		return 0
	}
	common := 0
	seen := map[string]bool{}
	for _, t := range tagList {
		if seen[t] {
			continue
		}
		seen[t] = true
		if userTags[t] {
			common++
		}
	}
	if len(seen) == 0 {
		return 0
	}
	return float32(common) / float32(len(seen))
}

func displayMatchRate(c ranking.Candidate, tagList []string, userTags map[string]bool) float32 {
	rate := c.SimToUser
	if rate <= 0 {
		rate = c.Relevance
	}
	if povRate := povCoverageRate(tagList, userTags); povRate > rate {
		rate = povRate
	}
	if rate < 0 {
		return 0
	}
	if rate > 1 {
		return 1
	}
	return rate
}

func intersect(tags []string, set map[string]bool) []string {
	out := []string{}
	for _, t := range tags {
		if set[t] {
			out = append(out, t)
		}
	}
	return out
}
