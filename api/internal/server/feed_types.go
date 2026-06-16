package server

import "time"

type timelineReq struct {
	QueryText        string  `json:"query_text"`
	SimilarityWeight float32 `json:"similarity_weight"`
	BoostPopular     bool    `json:"boost_popular"`
	IncludeFarPosts  bool    `json:"include_far_posts"`
}

type searchReq struct {
	Query string   `json:"query"`
	Povs  []string `json:"povs"`
	Limit int      `json:"limit"`
}

type postMeta struct {
	userID, username, text string
	createdAt              time.Time
}

// bundle holds everything needed to render a set of posts (loaded in bulk).
type bundle struct {
	meta          map[string]postMeta
	povs          map[string][]string
	likeCounts    map[string]int
	commentCounts map[string]int
	liked         map[string]bool
	saved         map[string]bool
	povLikeCounts map[string]int
	povLiked      map[string]bool
}
