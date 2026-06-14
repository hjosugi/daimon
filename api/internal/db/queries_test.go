package db

import (
	"strings"
	"testing"
)

func TestSQLLoadsNamedQuery(t *testing.T) {
	q := SQL("feed.load_posts")
	if !strings.Contains(q, "FROM posts") {
		t.Fatalf("expected feed.load_posts to query posts, got %q", q)
	}
}

func TestSQLPanicsForUnknownQuery(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic for unknown query")
		}
	}()
	_ = SQL("missing.query")
}
