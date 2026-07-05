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

func TestLoginUserQueryIsCaseInsensitiveForUsername(t *testing.T) {
	q := SQL("auth.login_user")
	if !strings.Contains(q, "lower(username)=lower($2)") {
		t.Fatalf("expected case-insensitive username login query, got %q", q)
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
