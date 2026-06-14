package db

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"strings"
)

//go:embed queries/*.sql
var queryFiles embed.FS

var queries = mustLoadQueries()

// SQL returns a named SQL statement embedded from internal/db/queries/*.sql.
func SQL(name string) string {
	q, ok := queries[name]
	if !ok {
		panic(fmt.Sprintf("unknown SQL query %q", name))
	}
	return q
}

func mustLoadQueries() map[string]string {
	out := map[string]string{}
	err := fs.WalkDir(queryFiles, "queries", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".sql") {
			return err
		}
		b, err := queryFiles.ReadFile(path)
		if err != nil {
			return err
		}
		return parseNamedQueries(path, string(b), out)
	})
	if err != nil {
		panic(err)
	}
	return out
}

func parseNamedQueries(path, src string, out map[string]string) error {
	var name string
	var body []string
	flush := func() error {
		if name == "" {
			return nil
		}
		q := strings.TrimSpace(strings.Join(body, "\n"))
		if q == "" {
			return fmt.Errorf("%s: empty query %q", path, name)
		}
		if _, exists := out[name]; exists {
			return fmt.Errorf("%s: duplicate query %q", path, name)
		}
		out[name] = q
		return nil
	}

	sc := bufio.NewScanner(strings.NewReader(src))
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "-- name:") {
			if err := flush(); err != nil {
				return err
			}
			name = strings.TrimSpace(strings.TrimPrefix(line, "-- name:"))
			body = body[:0]
			continue
		}
		if name != "" {
			body = append(body, line)
		}
	}
	if err := sc.Err(); err != nil {
		return err
	}
	return flush()
}
