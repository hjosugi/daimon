package qdrant

import (
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/db"
)

func TestPostgresVectorStore(t *testing.T) {
	dsn := os.Getenv("DAIMON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("DAIMON_TEST_DATABASE_URL is not set")
	}
	ctx := t.Context()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := db.EnsureSchema(ctx, pool); err != nil {
		t.Fatal(err)
	}

	userID := uuid.NewString()
	firstID := uuid.NewString()
	secondID := uuid.NewString()
	now := time.Now().UTC()
	if _, err := pool.Exec(ctx, `
		INSERT INTO users(id,username,email,password_hash,created_at,updated_at)
		VALUES($1,$2,$3,'test',$4,$4)
	`, userID, "vector-"+userID, userID+"@example.test", now); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO posts(id,user_id,username,text,created_at,updated_at)
		VALUES($1,$2,$3,'first',$4,$4),($5,$2,$3,'second',$4,$4)
	`, firstID, userID, "vector-"+userID, now, secondID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, userID)
	})

	first := make([]float32, VectorSize)
	second := make([]float32, VectorSize)
	first[0] = 1
	second[1] = 1
	client := New(pool)
	if err := client.EnsureCollection(ctx); err != nil {
		t.Fatal(err)
	}
	if err := client.Upsert(ctx, []Point{
		{
			ID:     firstID,
			Vector: first,
			Payload: map[string]any{
				"user_id": userID,
				"tags":    []string{"craft"},
			},
		},
		{
			ID:     secondID,
			Vector: second,
			Payload: map[string]any{
				"user_id": userID,
				"tags":    []string{"travel"},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}

	hits, err := client.Search(ctx, first, 5, []string{"craft"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0].ID != firstID || hits[0].Score != 1 {
		t.Fatalf("hits=%+v", hits)
	}
	points, err := client.UserPoints(ctx, userID, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 2 {
		t.Fatalf("user points=%d", len(points))
	}
	retrieved, err := client.Retrieve(ctx, []string{secondID}, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(retrieved) != 1 || retrieved[0].ID != secondID || retrieved[0].Vector != nil {
		t.Fatalf("retrieved=%+v", retrieved)
	}
	if err := client.Delete(ctx, []string{secondID}); err != nil {
		t.Fatal(err)
	}
	retrieved, err = client.Retrieve(ctx, []string{secondID}, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(retrieved) != 0 {
		t.Fatalf("deleted point still present: %+v", retrieved)
	}
}
