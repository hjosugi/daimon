package povs

import (
	"net/http"
	"sort"
	"strings"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
	"daimon/api/internal/server/respond"
)

type genPOVReq struct {
	Text string `json:"text"`
}

const generatePOVTextMaxRunes = 40000

// HandleGeneratePOVs proxies POV extraction to the Python ML service (spaCy).
func (h *Handler) HandleGeneratePOVs(w http.ResponseWriter, r *http.Request) {
	var req genPOVReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		httpx.JSON(w, http.StatusOK, map[string][]string{"povs": {}})
		return
	}
	if len([]rune(req.Text)) > generatePOVTextMaxRunes {
		httpx.Error(w, http.StatusBadRequest, "Text must be 40,000 characters or less")
		return
	}
	povs, err := h.embed.POVs(r.Context(), req.Text)
	if err != nil {
		respond.Warn(h.logger, r, "pov generation failed", err)
		povs = []string{} // ML service down -> empty, non-fatal
	}
	httpx.JSON(w, http.StatusOK, map[string][]string{"povs": povs})
}

// HandleSuggestPOVs suggests POVs by popularity, matching an optional query.
// Prefix matches rank above substring matches; ties broken by frequency.
// Uses batch-precomputed popular + vector-related POVs from cache when present.
func (h *Handler) HandleSuggestPOVs(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))

	// Empty query -> serve precomputed popular list if the batch produced one.
	if q == "" {
		var popular []string
		if h.cache.GetJSON(r.Context(), "suggest:popular", &popular) && len(popular) > 0 {
			httpx.JSON(w, http.StatusOK, map[string][]string{"povs": popular[:min(10, len(popular))]})
			return
		}
	}

	rows, err := h.pool.Query(r.Context(), dbq.SQL("povs.suggest"), q)
	if err != nil {
		respond.Warn(h.logger, r, "pov suggestion query failed", err)
		httpx.JSON(w, http.StatusOK, map[string][]string{"povs": {}})
		return
	}
	defer rows.Close()

	type pc struct {
		pov   string
		count int
	}
	var list []pc
	for rows.Next() {
		var p pc
		if rows.Scan(&p.pov, &p.count) == nil {
			list = append(list, p)
		}
	}
	if err := rows.Err(); err != nil {
		respond.Warn(h.logger, r, "pov suggestion rows failed", err)
		httpx.JSON(w, http.StatusOK, map[string][]string{"povs": {}})
		return
	}

	sort.SliceStable(list, func(a, b int) bool {
		ap := q != "" && strings.HasPrefix(strings.ToLower(list[a].pov), q)
		bp := q != "" && strings.HasPrefix(strings.ToLower(list[b].pov), q)
		if ap != bp {
			return ap // prefix matches first
		}
		return list[a].count > list[b].count
	})

	limit := 10
	out := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, p := range list {
		out = append(out, p.pov)
		seen[strings.ToLower(p.pov)] = true
		if len(out) >= limit {
			break
		}
	}

	// Enrich with batch-precomputed vector-related POVs of the best match.
	if q != "" && len(out) > 0 {
		var related []string
		if h.cache.GetJSON(r.Context(), "suggest:related:"+strings.ToLower(out[0]), &related) {
			for _, rp := range related {
				if len(out) >= limit {
					break
				}
				if !seen[strings.ToLower(rp)] {
					seen[strings.ToLower(rp)] = true
					out = append(out, rp)
				}
			}
		}
	}
	httpx.JSON(w, http.StatusOK, map[string][]string{"povs": out})
}
