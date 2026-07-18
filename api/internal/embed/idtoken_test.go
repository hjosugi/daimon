package embed

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestCloudRunEmbedAddsCachedIdentityToken(t *testing.T) {
	token := fakeToken(time.Now().Add(time.Hour))
	metadataCalls := 0
	metadata := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		metadataCalls++
		if r.Header.Get("Metadata-Flavor") != "Google" {
			t.Fatal("missing metadata header")
		}
		_, _ = w.Write([]byte(token))
	}))
	defer metadata.Close()
	t.Setenv("EMBED_AUTH", "true")
	t.Setenv("GCE_METADATA_URL", metadata.URL)

	inferenceCalls := 0
	inference := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inferenceCalls++
		if r.Header.Get("Authorization") != "Bearer "+token {
			t.Fatalf("authorization=%q", r.Header.Get("Authorization"))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"vector": testVector(VectorDim),
		})
	}))
	defer inference.Close()

	client := New(inference.URL)
	for range 2 {
		if _, err := client.Embed(t.Context(), "hello"); err != nil {
			t.Fatal(err)
		}
	}
	if metadataCalls != 1 || inferenceCalls != 2 {
		t.Fatalf("metadata=%d inference=%d", metadataCalls, inferenceCalls)
	}
}

func TestTokenExpiry(t *testing.T) {
	want := time.Now().Add(time.Hour).Truncate(time.Second)
	got := tokenExpiry(fakeToken(want))
	if !got.Equal(want) {
		t.Fatalf("expiry=%s want=%s", got, want)
	}
	if !tokenExpiry("not-a-token").IsZero() {
		t.Fatal("invalid token has an expiry")
	}
}

func fakeToken(expiry time.Time) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none"}`))
	payload := base64.RawURLEncoding.EncodeToString(
		[]byte(`{"exp":` + strconv.FormatInt(expiry.Unix(), 10) + `}`),
	)
	return header + "." + payload + ".signature"
}
