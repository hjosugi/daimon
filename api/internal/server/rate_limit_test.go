package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterFixedWindow(t *testing.T) {
	limiter := newRateLimiter(2, time.Minute)
	now := time.Unix(100, 0)

	if !limiter.allow("client", now) {
		t.Fatal("first request should be allowed")
	}
	if !limiter.allow("client", now.Add(time.Second)) {
		t.Fatal("second request should be allowed")
	}
	if limiter.allow("client", now.Add(2*time.Second)) {
		t.Fatal("third request in the same window should be rejected")
	}
	if !limiter.allow("client", now.Add(time.Minute)) {
		t.Fatal("request after window reset should be allowed")
	}
}

func TestClientIPUsesForwardedForFirstHop(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	req.Header.Set("X-Forwarded-For", "203.0.113.10, 10.0.0.1")

	if got := clientIP(req); got != "203.0.113.10" {
		t.Fatalf("clientIP = %q, want first forwarded hop", got)
	}
}
