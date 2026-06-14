// Package db handles the connection pool and (idempotent) schema bootstrap.
package db

import (
	"context"
	_ "embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

// EnsureSchema applies the idempotent schema (CREATE TABLE IF NOT EXISTS ...).
// Safe to run on every startup against fresh or already-populated databases.
func EnsureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, schema)
	return err
}
