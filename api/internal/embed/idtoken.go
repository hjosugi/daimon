package embed

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type identityTokenSource struct {
	audience    string
	metadataURL string
	client      *http.Client
	mutex       sync.Mutex
	token       string
	expiresAt   time.Time
}

func newIdentityTokenSource(audience string) *identityTokenSource {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("EMBED_AUTH")))
	enabled := mode == "true" || mode == "1" ||
		(mode != "false" && mode != "0" && os.Getenv("K_SERVICE") != "")
	if !enabled {
		return nil
	}
	metadataURL := strings.TrimRight(os.Getenv("GCE_METADATA_URL"), "/")
	if metadataURL == "" {
		metadataURL = "http://metadata.google.internal/computeMetadata/v1"
	}
	return &identityTokenSource{
		audience:    strings.TrimRight(audience, "/"),
		metadataURL: metadataURL,
		client:      &http.Client{Timeout: 3 * time.Second},
	}
}

func (s *identityTokenSource) Token(ctx context.Context) (string, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.token != "" && time.Until(s.expiresAt) > 5*time.Minute {
		return s.token, nil
	}
	endpoint := s.metadataURL +
		"/instance/service-accounts/default/identity?audience=" +
		url.QueryEscape(s.audience)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("Metadata-Flavor", "Google")
	response, err := s.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return "", fmt.Errorf(
			"metadata status %d: %s",
			response.StatusCode,
			strings.TrimSpace(string(detail)),
		)
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, 16*1024))
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(raw))
	if token == "" {
		return "", fmt.Errorf("metadata returned an empty token")
	}
	expiresAt := tokenExpiry(token)
	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(10 * time.Minute)
	}
	s.token = token
	s.expiresAt = expiresAt
	return token, nil
}

func tokenExpiry(token string) time.Time {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}
	}
	var claims struct {
		ExpiresAt int64 `json:"exp"`
	}
	if json.Unmarshal(payload, &claims) != nil || claims.ExpiresAt <= 0 {
		return time.Time{}
	}
	return time.Unix(claims.ExpiresAt, 0)
}
