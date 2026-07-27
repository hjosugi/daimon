// Package db handles the connection pool and (idempotent) schema bootstrap.
package db

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

// schemaLockKey is the ASCII value "DAIMON". PostgreSQL advisory locks are
// scoped to the current database, so this only serializes Daimon schema
// bootstraps that target the same database.
const schemaLockKey int64 = 0x4441494d4f4e

// EnsureSchema applies the idempotent schema (CREATE TABLE IF NOT EXISTS ...).
// The transaction-scoped advisory lock also makes concurrent startup safe:
// PostgreSQL's IF NOT EXISTS checks alone do not serialize catalog writes.
func EnsureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(context.WithoutCancel(ctx))
	}()

	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", schemaLockKey); err != nil {
		return fmt.Errorf("lock schema bootstrap: %w", err)
	}
	if _, err := tx.Exec(ctx, schema); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	return nil
}
