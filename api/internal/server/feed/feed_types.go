package feed

import (
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/cache"
	"daimon/api/internal/embed"
	"daimon/api/internal/qdrant"
)

type Handler struct {
	pool   *pgxpool.Pool
	embed  *embed.Client
	qdrant *qdrant.Client
	cache  *cache.Cache
	logger *slog.Logger
}

func New(pool *pgxpool.Pool, embed *embed.Client, qdrant *qdrant.Client, cache *cache.Cache, logger *slog.Logger) *Handler {
	return &Handler{pool: pool, embed: embed, qdrant: qdrant, cache: cache, logger: logger}
}

type timelineReq struct {
	QueryText        string  `json:"query_text"`
	SimilarityWeight float32 `json:"similarity_weight"`
	BoostPopular     bool    `json:"boost_popular"`
	IncludeFarPosts  bool    `json:"include_far_posts"`
	Limit            int     `json:"limit"`
	Offset           int     `json:"offset"`
}

type searchReq struct {
	Query string   `json:"query"`
	Povs  []string `json:"povs"`
	Limit int      `json:"limit"`
	Sort  string   `json:"sort"`
}

type povLikeSummary struct {
	Liked bool `json:"liked"`
	Likes int  `json:"likes"`
}

type povStats map[string]povLikeSummary

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

type postMeta struct {
	userID, username, text string
	createdAt              time.Time
}

// bundle holds everything needed to render a set of posts (loaded in bulk).
type bundle struct {
	meta          map[string]postMeta
	povs          map[string][]string
	likeCounts    map[string]int
	saveCounts    map[string]int
	commentCounts map[string]int
	liked         map[string]bool
	saved         map[string]bool
	povLikeCounts map[string]int
	povLiked      map[string]bool
}
