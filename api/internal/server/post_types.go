package server

import "strings"

// maxPostLen caps post length. Long-form by design (deep, 観点-driven posts);
// embeddings cover the full text via chunking, so length doesn't hurt search.
const maxPostLen = 40000

type createPostReq struct {
	Text string   `json:"text"`
	Povs []string `json:"povs"`
}

type povLikeSummary struct {
	Liked bool `json:"liked"`
	Likes int  `json:"likes"`
}

type povStats map[string]povLikeSummary

type postResp struct {
	ID           string       `json:"id"`
	Text         string       `json:"text"`
	Povs         []string     `json:"povs"`
	UserID       string       `json:"user_id"`
	Username     string       `json:"username"`
	Score        *float32     `json:"score,omitempty"`
	Likes        int          `json:"likes"`
	Liked        bool         `json:"liked"`
	Saved        bool         `json:"saved,omitempty"`
	CommentCount int          `json:"commentCount"`
	POVStats     povStats     `json:"pov_stats,omitempty"`
	MatchReason  *matchReason `json:"match_reason,omitempty"`
	CreatedAt    string       `json:"created_at"`
}

type likeResp struct {
	Liked bool `json:"liked"`
	Likes int  `json:"likes"`
}

type likerResp struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type commentResp struct {
	ID        string  `json:"id"`
	Text      string  `json:"text"`
	AuthorID  string  `json:"authorId"`
	Username  *string `json:"username"`
	CreatedAt string  `json:"createdAt"`
}

type addCommentReq struct {
	Text string `json:"text"`
}

func cleanPOVs(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, p := range in {
		t := strings.TrimSpace(p)
		if t == "" || len([]rune(t)) > 300 || seen[strings.ToLower(t)] {
			continue
		}
		seen[strings.ToLower(t)] = true
		out = append(out, t)
	}
	return out
}
