package server

import (
	"net/http"
	"sort"
	"strings"

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
func (s *Server) handleSuggestPOVs(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))

	rows, err := s.pool.Query(r.Context(),
		`SELECT pov, count(*) AS c FROM povs
		 WHERE ($1 = '' OR lower(pov) LIKE '%' || $1 || '%')
		 GROUP BY pov ORDER BY c DESC LIMIT 50`, q)
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
	for _, p := range list {
		out = append(out, p.pov)
		if len(out) >= limit {
			break
		}
	}
	httpx.JSON(w, http.StatusOK, map[string][]string{"povs": out})
}
