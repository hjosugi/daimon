package feed

import (
	"strings"

	"daimon/api/internal/feedcore"
	"daimon/api/internal/qdrant"
	"daimon/api/internal/ranking"
)

const (
	defaultTimelinePageSize = 20
	maxTimelinePageSize     = 30
	maxTimelineResults      = 100
)

func normalizeTimelinePage(req *timelineReq) {
	if req.Limit <= 0 {
		req.Limit = defaultTimelinePageSize
	}
	if req.Limit > maxTimelinePageSize {
		req.Limit = maxTimelinePageSize
	}
	if req.Offset < 0 {
		req.Offset = 0
	}
	if req.Offset > maxTimelineResults {
		req.Offset = maxTimelineResults
	}
}

func timelineRankLimit(req timelineReq) int {
	return min(req.Offset+req.Limit, maxTimelineResults)
}

func timelinePage[T any](items []T, req timelineReq) []T {
	if req.Offset >= len(items) {
		return nil
	}
	end := min(req.Offset+req.Limit, len(items))
	return items[req.Offset:end]
}

func defaultTimelineQuery(q string) bool {
	q = strings.TrimSpace(strings.ToLower(q))
	return q == "" || q == "general interest"
}

func defaultTimelineKnobs(req timelineReq) bool {
	return defaultTimelineQuery(req.QueryText) &&
		req.BoostPopular &&
		req.SimilarityWeight > feedcore.DefaultTimelineSimilarityWeight-0.01 &&
		req.SimilarityWeight < feedcore.DefaultTimelineSimilarityWeight+0.01 &&
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
