package server

import (
	"net/http"
	"sort"
	"strings"

	dbq "daimon/api/internal/db"
	"daimon/api/internal/httpx"
)

type genPOVReq struct {
	Text string `json:"text"`
}

// handleGeneratePOVs proxies POV extraction to the Python ML service (spaCy).
func (s *Server) handleGeneratePOVs(w http.ResponseWriter, r *http.Request) {
	var req genPOVReq
	if !httpx.Decode(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		httpx.JSON(w, http.StatusOK, map[string][]string{"povs": {}})
		return
	}
	povs, err := s.embed.POVs(r.Context(), req.Text)
	if err != nil {
		povs = []string{} // ML service down -> empty, non-fatal
	}
	httpx.JSON(w, http.StatusOK, map[string][]string{"povs": povs})
}

// handleSuggestPOVs suggests POVs by popularity, matching an optional query.
// Prefix matches rank above substring matches; ties broken by frequency.
// Uses batch-precomputed popular + vector-related POVs from cache when present.
func (s *Server) handleSuggestPOVs(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))

	// Empty query -> serve precomputed popular list if the batch produced one.
	if q == "" {
		var popular []string
		if s.cache.GetJSON(r.Context(), "suggest:popular", &popular) && len(popular) > 0 {
			httpx.JSON(w, http.StatusOK, map[string][]string{"povs": popular[:min(10, len(popular))]})
			return
		}
	}

	rows, err := s.pool.Query(r.Context(), dbq.SQL("povs.suggest"), q)
	if err != nil {
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
		if s.cache.GetJSON(r.Context(), "suggest:related:"+strings.ToLower(out[0]), &related) {
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
