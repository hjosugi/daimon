package db

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Querier is the subset of pgx query APIs used by scan helpers.
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// QueryStrings runs a one-column string query and checks both Scan and rows.Err.
func QueryStrings(ctx context.Context, q Querier, sql string, args ...any) ([]string, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []string{}
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return out, err
		}
		out = append(out, value)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	return out, nil
}
