package feed

import (
	"context"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/vec"
)

// userSense loads the user's POV set and centroid vector.
func (h *Handler) userSense(ctx context.Context, uid string) (map[string]bool, []float32) {
	tags := map[string]bool{}
	if uid == "" {
		return tags, nil
	}
	povs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.user_povs"), uid)
	if err == nil {
		for _, pov := range povs {
			tags[pov] = true
		}
	} else {
		h.logger.WarnContext(ctx, "user pov query failed", "error", err)
	}
	var centroid []float32
	if pts, err := h.qdrant.UserPoints(ctx, uid, 200); err == nil && len(pts) > 0 {
		vs := make([][]float32, 0, len(pts))
		for _, p := range pts {
			if len(p.Vector) > 0 {
				vs = append(vs, p.Vector)
			}
		}
		centroid = vec.Mean(vs)
	} else if err != nil {
		h.logger.WarnContext(ctx, "user qdrant points failed", "error", err)
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
	ids, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.user_saved_ids"), uid)
	if err != nil {
		h.logger.WarnContext(ctx, "saved centroid ids failed", "error", err)
		return nil
	}
	if len(ids) == 0 {
		return nil
	}
	pts, err := h.qdrant.Retrieve(ctx, ids, true)
	if err != nil || len(pts) == 0 {
		if err != nil {
			h.logger.WarnContext(ctx, "saved centroid qdrant retrieve failed", "error", err)
		}
		return nil
	}
	vs := make([][]float32, 0, len(pts))
	for _, p := range pts {
		if len(p.Vector) > 0 {
			vs = append(vs, p.Vector)
		}
	}
	return vec.Mean(vs)
}

// userTagSet loads just the user's POV set (no Qdrant centroid call).
func (h *Handler) userTagSet(ctx context.Context, uid string) map[string]bool {
	tags := map[string]bool{}
	if uid == "" {
		return tags
	}
	povs, err := dbq.QueryStrings(ctx, h.pool, dbq.SQL("feed.user_povs"), uid)
	if err == nil {
		for _, pov := range povs {
			tags[pov] = true
		}
	} else {
		h.logger.WarnContext(ctx, "user tag query failed", "error", err)
	}
	return tags
}
