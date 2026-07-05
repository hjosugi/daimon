package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type decodeReq struct {
	Text string `json:"text"`
}

func TestDecodeValidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"text":"ok"}`))
	rec := httptest.NewRecorder()

	var out decodeReq
	if !Decode(rec, req, &out) {
		t.Fatalf("expected decode success, got status %d", rec.Code)
	}
	if out.Text != "ok" {
		t.Fatalf("decoded text = %q, want ok", out.Text)
	}
}

func TestDecodeRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"text":"ok","extra":true}`))
	rec := httptest.NewRecorder()

	var out decodeReq
	if Decode(rec, req, &out) {
		t.Fatal("expected decode failure")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDecodeRejectsOversizedBody(t *testing.T) {
	body := `{"text":"` + strings.Repeat("x", int(MaxJSONBodyBytes)+1) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	rec := httptest.NewRecorder()

	var out decodeReq
	if Decode(rec, req, &out) {
		t.Fatal("expected decode failure")
	}
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
}

func TestDecodeRejectsTrailingJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"text":"ok"}{"text":"again"}`))
	rec := httptest.NewRecorder()

	var out decodeReq
	if Decode(rec, req, &out) {
		t.Fatal("expected decode failure")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
