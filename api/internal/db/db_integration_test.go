package db

import (
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEnsureSchemaConcurrent(t *testing.T) {
	dsn := os.Getenv("DAIMON_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("DAIMON_TEST_DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(t.Context(), dsn)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	const workers = 4
	start := make(chan struct{})
	errs := make(chan error, workers)
	var wg sync.WaitGroup
	wg.Add(workers)

	for range workers {
		go func() {
			defer wg.Done()
			<-start
			errs <- EnsureSchema(t.Context(), pool)
		}()
	}

	close(start)
	wg.Wait()
	close(errs)

	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent schema bootstrap: %v", err)
		}
	}
}
