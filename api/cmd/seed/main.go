// Command seed loads realistic test data into Postgres + Qdrant.
//
// This is the Go replacement for the old Python backend/seed.py — keeping the
// stack Python-free except the ML microservice. Embeddings come from that
// service over HTTP (or are synthesised locally with --fake-vectors).
//
//	go run ./cmd/seed                       # 12,000 posts, ~300 users
//	go run ./cmd/seed --posts 20000 --users 500
//	go run ./cmd/seed --fresh               # wipe test tables + Qdrant first
//	go run ./cmd/seed --fake-vectors --posts 1000000   # scale test, no ML
//
// All seeded accounts share the password "password123".
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"daimon/api/internal/config"
	"daimon/api/internal/db"
	"daimon/api/internal/embed"
	"daimon/api/internal/qdrant"
)

func main() {
	posts := flag.Int("posts", 12000, "number of posts to generate")
	users := flag.Int("users", 300, "number of users to generate")
	fresh := flag.Bool("fresh", false, "wipe test tables + Qdrant collection first")
	noLikes := flag.Bool("no-likes", false, "skip generating likes")
	noComments := flag.Bool("no-comments", false, "skip generating comments")
	batch := flag.Int("batch", 128, "embedding batch size")
	clustersArg := flag.String("clusters", "", "comma-separated clusters (default: all)")
	fakeVectors := flag.Bool("fake-vectors", false, "synthesise vectors locally (no ML service)")
	flag.Parse()

	gen := selectClusters(*clustersArg)
	cfg := config.FromEnv()
	ctx := context.Background()
	r := rand.New(rand.NewSource(42))

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()
	if err := db.EnsureSchema(ctx, pool); err != nil {
		log.Fatalf("schema: %v", err)
	}
	qc := qdrant.New(cfg.QdrantURL, cfg.QdrantAPIKey)

	if *fresh {
		truncate(ctx, pool)
		if err := qc.RecreateCollection(ctx); err != nil {
			log.Printf("  ! Qdrant reset skipped: %v", err)
		} else {
			log.Println("  ✓ Qdrant collection recreated")
		}
	} else if err := qc.EnsureCollection(ctx); err != nil {
		log.Fatalf("qdrant collection: %v", err)
	}

	base := countUsers(ctx, pool)
	log.Printf("Seeding %d users + %d posts (existing users: %d) ...", *users, *posts, base)

	// --- Users (one shared bcrypt hash for all seed accounts: fast) ----------
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}
	now := time.Now().UTC()
	type uref struct{ id, name string }
	urefs := make([]uref, *users)
	userRows := make([][]any, *users)
	for i := 0; i < *users; i++ {
		id := uuid.NewString()
		name := fmt.Sprintf("seeduser%d", base+i+1)
		urefs[i] = uref{id, name}
		userRows[i] = []any{id, name, name + "@example.com", string(hash), nil, nil, now, now}
	}
	copyInto(ctx, pool, "users",
		[]string{"id", "username", "email", "password_hash", "avatar_url", "bio", "created_at", "updated_at"},
		userRows)
	log.Printf("  ✓ %d users", len(userRows))

	// --- Posts + POVs (build in memory, then embed + bulk insert) ------------
	type qmeta struct {
		id, uid string
		povs    []string
		epoch   int64
		cidx    int
	}
	postRows := make([][]any, 0, *posts)
	povRows := make([][]any, 0, *posts*3)
	metas := make([]qmeta, 0, *posts)
	texts := make([]string, 0, *posts)
	for i := 0; i < *posts; i++ {
		u := urefs[r.Intn(len(urefs))]
		ci := gen[r.Intn(len(gen))]
		body, povs := makePost(r, ci)
		pid := uuid.NewString()
		created := now.Add(-time.Duration(r.Intn(60))*24*time.Hour - time.Duration(r.Intn(1440))*time.Minute)
		postRows = append(postRows, []any{pid, u.id, u.name, body, created, created})
		for _, p := range povs {
			povRows = append(povRows, []any{uuid.NewString(), pid, p, false, created})
		}
		texts = append(texts, body)
		metas = append(metas, qmeta{pid, u.id, povs, created.Unix(), ci})
	}

	// --- Vectors -------------------------------------------------------------
	var vectors [][]float32
	if *fakeVectors {
		log.Printf("  • Generating %d SYNTHETIC vectors (--fake-vectors) ...", len(texts))
		cidx := make([]int, len(metas))
		for i, m := range metas {
			cidx[i] = m.cidx
		}
		vectors = syntheticVectors(cidx)
	} else {
		log.Printf("  • Encoding %d embeddings via ML service (batch=%d) ...", len(texts), *batch)
		vectors = embedAll(ctx, cfg.EmbedURL, texts, *batch)
	}

	// --- Postgres bulk insert ------------------------------------------------
	log.Println("  • Bulk inserting posts + POVs into Postgres ...")
	copyInto(ctx, pool, "posts",
		[]string{"id", "user_id", "username", "text", "created_at", "updated_at"}, postRows)
	copyInto(ctx, pool, "povs",
		[]string{"id", "post_id", "pov", "is_auto", "created_at"}, povRows)
	log.Printf("  ✓ %d posts, %d POVs", len(postRows), len(povRows))

	// --- Qdrant upsert -------------------------------------------------------
	log.Println("  • Upserting vectors into Qdrant ...")
	const chunk = 1000
	for i := 0; i < len(metas); i += chunk {
		end := min(i+chunk, len(metas))
		pts := make([]qdrant.Point, 0, end-i)
		for j := i; j < end; j++ {
			m := metas[j]
			pts = append(pts, qdrant.Point{
				ID:     m.id,
				Vector: vectors[j],
				Payload: map[string]any{
					"post_id": m.id, "user_id": m.uid, "tags": m.povs, "created_at": m.epoch,
				},
			})
		}
		if err := qc.Upsert(ctx, pts); err != nil {
			log.Fatalf("qdrant upsert: %v", err)
		}
		log.Printf("    %d/%d", end, len(metas))
	}
	log.Printf("  ✓ %d vectors in Qdrant", len(metas))

	// --- Optional likes / comments ------------------------------------------
	if !*noLikes {
		seen := map[string]bool{}
		likeRows := make([][]any, 0, len(metas)*3)
		for _, m := range metas {
			for n := r.Intn(7); n > 0; n-- {
				liker := urefs[r.Intn(len(urefs))].id
				key := m.id + "|" + liker
				if seen[key] {
					continue
				}
				seen[key] = true
				likeRows = append(likeRows, []any{uuid.NewString(), m.id, liker, now})
			}
		}
		copyInto(ctx, pool, "likes", []string{"id", "post_id", "user_id", "created_at"}, likeRows)
		log.Printf("  ✓ %d likes", len(likeRows))
	}
	if !*noComments {
		commentRows := make([][]any, 0, len(metas)*2)
		for _, m := range metas {
			for n := r.Intn(4); n > 0; n-- {
				commentRows = append(commentRows, []any{
					uuid.NewString(), m.id, urefs[r.Intn(len(urefs))].id,
					commentTexts[r.Intn(len(commentTexts))], now,
				})
			}
		}
		copyInto(ctx, pool, "comments",
			[]string{"id", "post_id", "user_id", "text", "created_at"}, commentRows)
		log.Printf("  ✓ %d comments", len(commentRows))
	}

	log.Println("\n✅ Seed complete.")
	log.Printf("   Login with seeduser%d@example.com .. seeduser%d@example.com (password: password123)",
		base+1, base+*users)
}

// ---- generation ----------------------------------------------------------

func makePost(r *rand.Rand, ci int) (string, []string) {
	c := clusters[ci]
	ja := r.Float64() < 0.5
	pool := c.en
	sep := " "
	if ja {
		pool = c.ja
		sep = ""
	}
	k := 4 + r.Intn(6) // 4..9
	if k > len(pool) {
		k = len(pool)
	}
	body := strings.Join(sampleStrings(r, pool, k), sep)

	nPov := 2 + r.Intn(3) // 2..4
	if nPov > len(c.tags) {
		nPov = len(c.tags)
	}
	set := map[string]bool{}
	for _, t := range sampleStrings(r, c.tags, nPov) {
		set[t] = true
	}
	// ~15% borrow a POV from another cluster (seeds "bridge" posts for discovery).
	if r.Float64() < 0.15 {
		o := r.Intn(len(clusters))
		if o != ci {
			ot := clusters[o].tags
			set[ot[r.Intn(len(ot))]] = true
		}
	}
	povs := make([]string, 0, len(set))
	for p := range set {
		povs = append(povs, p)
	}
	return body, povs
}

// sampleStrings returns k distinct elements of src (Fisher–Yates on a copy).
func sampleStrings(r *rand.Rand, src []string, k int) []string {
	cp := make([]string, len(src))
	copy(cp, src)
	r.Shuffle(len(cp), func(i, j int) { cp[i], cp[j] = cp[j], cp[i] })
	if k > len(cp) {
		k = len(cp)
	}
	return cp[:k]
}

func selectClusters(arg string) []int {
	if strings.TrimSpace(arg) == "" {
		idx := make([]int, len(clusters))
		for i := range clusters {
			idx[i] = i
		}
		return idx
	}
	byName := map[string]int{}
	for i, c := range clusters {
		byName[c.name] = i
	}
	var out []int
	for _, name := range strings.Split(arg, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		i, ok := byName[name]
		if !ok {
			log.Fatalf("unknown cluster %q", name)
		}
		out = append(out, i)
	}
	return out
}

// ---- embeddings ----------------------------------------------------------

func embedAll(ctx context.Context, embedURL string, texts []string, batch int) [][]float32 {
	em := embed.NewWithTimeout(embedURL, 5*time.Minute)
	out := make([][]float32, 0, len(texts))
	for i := 0; i < len(texts); i += batch {
		end := min(i+batch, len(texts))
		vecs, err := em.EmbedBatch(ctx, texts[i:end])
		if err != nil {
			log.Fatalf("embed batch %d-%d: %v (is the ML service up? try --fake-vectors)", i, end, err)
		}
		out = append(out, vecs...)
		log.Printf("    embedded %d/%d", end, len(texts))
	}
	return out
}

// syntheticVectors builds per-cluster centroids + noise so search still returns
// topically coherent results without the ML model (for scale testing).
func syntheticVectors(cidx []int) [][]float32 {
	rng := rand.New(rand.NewSource(7))
	dim := qdrant.VectorSize
	centroids := make([][]float32, len(clusters))
	for c := range clusters {
		v := make([]float32, dim)
		for i := range v {
			v[i] = float32(rng.NormFloat64())
		}
		centroids[c] = normalize(v)
	}
	out := make([][]float32, len(cidx))
	for n, c := range cidx {
		v := make([]float32, dim)
		ce := centroids[c]
		for i := range v {
			v[i] = ce[i] + 0.55*float32(rng.NormFloat64())
		}
		out[n] = normalize(v)
	}
	return out
}

func normalize(v []float32) []float32 {
	var s float64
	for _, x := range v {
		s += float64(x) * float64(x)
	}
	if s == 0 {
		return v
	}
	inv := float32(1 / math.Sqrt(s))
	for i := range v {
		v[i] *= inv
	}
	return v
}

// ---- db helpers ----------------------------------------------------------

func copyInto(ctx context.Context, pool *pgxpool.Pool, table string, cols []string, rows [][]any) {
	if len(rows) == 0 {
		return
	}
	if _, err := pool.CopyFrom(ctx, pgx.Identifier{table}, cols, pgx.CopyFromRows(rows)); err != nil {
		log.Fatalf("copy into %s: %v", table, err)
	}
}

func countUsers(ctx context.Context, pool *pgxpool.Pool) int {
	var n int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM users").Scan(&n)
	return n
}

func truncate(ctx context.Context, pool *pgxpool.Pool) {
	log.Println("  ⚠️  --fresh: truncating posts/povs/likes/comments/follows/bookmarks/sessions/users ...")
	_, err := pool.Exec(ctx, `TRUNCATE TABLE pov_likes, pov_comments, povs, comments, likes,
		bookmarks, follows, sessions, posts, users RESTART IDENTITY CASCADE`)
	if err != nil {
		log.Fatalf("truncate: %v", err)
	}
}
