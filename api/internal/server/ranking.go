package server

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
