package server

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"daimon/api/internal/httpx"
)

type rateWindow struct {
	count int
	reset time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	clients map[string]rateWindow
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		limit:   limit,
		window:  window,
		clients: map[string]rateWindow{},
	}
}

func (l *rateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	win := l.clients[key]
	if win.reset.IsZero() || !now.Before(win.reset) {
		l.clients[key] = rateWindow{count: 1, reset: now.Add(l.window)}
		return true
	}
	if win.count >= l.limit {
		return false
	}
	win.count++
	l.clients[key] = win
	return true
}

func (s *Server) publicMLRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientIP(r)
		if !s.publicMLLimiter.allow(key, time.Now()) {
			httpx.Error(w, http.StatusTooManyRequests, "Too many requests")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			xff = xff[:i]
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
