package feed

import (
	"context"

	"daimon/api/internal/feedcore"
)

// userSense loads the user's POV set and centroid vector.
func (h *Handler) userSense(ctx context.Context, uid string) (map[string]bool, []float32) {
	tags := map[string]bool{}
	if uid == "" {
		return tags, nil
	}
	tags, err := feedcore.UserTagSet(ctx, h.pool, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "user pov query failed", "error", err)
	}
	centroid, err := feedcore.UserCentroid(ctx, h.qdrant, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "user vector points failed", "error", err)
	}
	return tags, centroid
}

// savedCentroid returns the mean vector of the posts a user has saved.
// A save is a stronger preference signal than a like, so the timeline blends
// this into the user's "sense" to surface more of what they clip.
func (h *Handler) savedCentroid(ctx context.Context, uid string) []float32 {
	if uid == "" {
		return nil
	}
	centroid, err := feedcore.SavedCentroid(ctx, h.pool, h.qdrant, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "saved centroid failed", "error", err)
		return nil
	}
	return centroid
}

// userTagSet loads just the user's POV set (no Qdrant centroid call).
func (h *Handler) userTagSet(ctx context.Context, uid string) map[string]bool {
	tags := map[string]bool{}
	if uid == "" {
		return tags
	}
	tags, err := feedcore.UserTagSet(ctx, h.pool, uid)
	if err != nil {
		h.logger.WarnContext(ctx, "user tag query failed", "error", err)
	}
	return tags
}
