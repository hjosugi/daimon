package config

import (
	"os"
	"strings"
)

// Config holds all runtime configuration, loaded from the environment.
type Config struct {
	DatabaseURL  string
	QdrantURL    string // e.g. http://localhost:6333 or https://xxx.cloud.qdrant.io:6333
	QdrantAPIKey string
	EmbedURL     string // Python ML service base URL, e.g. http://localhost:8001
	CORSOrigins  []string
	Port         string
}

func FromEnv() Config {
	return Config{
		DatabaseURL:  env("DATABASE_URL", "postgresql://daimon:daimon@localhost:5432/daimon"),
		QdrantURL:    env("QDRANT_URL", "http://localhost:6333"),
		QdrantAPIKey: os.Getenv("QDRANT_API_KEY"),
		EmbedURL:     env("EMBED_URL", "http://localhost:8001"),
		CORSOrigins:  splitCSV(env("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")),
		Port:         env("PORT", "8000"),
	}
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
