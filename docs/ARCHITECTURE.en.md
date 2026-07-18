<!-- i18n: language-switcher -->
[English](ARCHITECTURE.en.md) | [日本語](ARCHITECTURE.md)

# Architecture

Daimon's current implementation is a SNS/search app centered around a Go API. Python is separated as an ML microservice responsible only for embedding and POV extraction, not as the main API.

This document explains the actual operational configuration as the authoritative source. The stack is primarily Go, with Python only for the ML microservice (`ml-service/`). The seed data and schema bootstrap are integrated into Go (`api/cmd/seed`, `CREATE TABLE IF NOT EXISTS` at startup), with no separate migration procedures or Python backend.

## Overall Architecture

```text
React / Vite frontend
        |
        | REST
        v
Go API
        | SQL                         | HTTP
        v                             v
PostgreSQL                    Python ML service
System of Record              embedding / POV extraction
        |
        | IDs, relations, metadata
        v
Qdrant
System of Search

Redis
optional read-model cache
```

On the local `compose.yml`, components start on these ports:

| Component | Port | Role |
| --- | --- | --- |
| frontend | `5173` | React UI |
| api | `8000` | Go HTTP API |
| ml | `8001` | Python ML service |
| PostgreSQL | `5432` | Main database |
| Qdrant | `6333` | Vector index |
| Redis | `6379` | Optional cache |

## Directory Responsibilities

| Path | Responsibility |
| --- | --- |
| `frontend/` | React + Vite + TypeScript. Timeline, search, posting, POV pages, profile. |
| `api/` | Go API. Authentication, posting, search, ranking, follow, save, POV comments. (`cmd/server`, `cmd/seed`, `cmd/batch`) |
| `ml-service/` | Only Python. Handles `/embed`, `/embed_batch`, `/povs`. |
| `docs/` | Shared documentation. |

## Design Principles

### PostgreSQL as the System of Record

Data that must not be lost is stored in PostgreSQL.

- users
- sessions
- posts
- povs
- likes
- comments
- pov_likes
- pov_comments
- follows
- bookmarks

Qdrant and Redis hold derived data that can be regenerated. Even if writing to Qdrant fails, the post remains in PostgreSQL.

### Qdrant as Search Index

Qdrant's `posts` collection stores 384-dimensional cosine vectors. Payloads are auxiliary for search.

```text
collection: posts
vector size: 384
distance: Cosine
payload:
  post_id
  user_id
  tags
  created_at
```

Qdrant is used for candidate generation. The final display uses bulk-loaded data from PostgreSQL: the post content, username, POV, like/comment/save counts.

### Keep ML Service Lightweight

`ml-service/app.py` exposes only three endpoints:

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /health` | none | health status |
| `POST /embed` | `{"text": "..."}` | `{"vector": [...]}` |
| `POST /povs` | `{"text": "..."}` | `{"povs": [...]}` |

The embedding model is `paraphrase-multilingual-MiniLM-L12-v2`, a 384-dimensional model capable of handling Japanese, so Qdrant's vector size remains unchanged.

For long texts, instead of just the beginning, split into approximately 1200-character chunks, embed each, and average the vectors. This reflects multiple points in long posts within a single vector.

### Redis as an Optional Read-Model Cache

Redis operates optionally. When configured, it stores derived data such as:

- `feed:{userId}`: precomputed home feed IDs for each user
- `suggest:popular`: frequently used POVs
- `suggest:related:{pov}`: semantically similar POV candidates

Even if Redis fails, the main data remains intact. APIs can fall back to live computation or respond with near-empty data safely.

## Current Data Model

### users

Stores account info, display name, email, password hash, avatar, bio. Basic profile registration is completed here.

### sessions

Login sessions. Currently a simple cookie/session-based authentication.

### posts

Stores post content and author. Post content is vectorized and registered in Qdrant with the same ID.

### povs

POVs attached to posts. Currently, duplicates are prevented by `post_id + pov`.

The current limitation is that POVs are still close to tags. In the future, they will be moved to `post_pov_assertions`, holding:

```text
post_id
pov_id or pov_text
grade: A/B/C or lean
comment
spoiler
confidence
created_by
created_at
```

### pov_comments

Comments on POVs themselves, not on posts.

Normal comments are about "discussing the post," while POV comments are about "viewing from this perspective." This distinction is core to Daimon.

### pov_likes

Light reactions like "adopt this POV" or "follow this stance." Currently implemented as likes, but in the future, they will evolve toward POV followings or stance indicators.

### follows

Follow relationships between people. Daimon does not fully eliminate person-following but aligns the network backbone more with POVs. People are signals of content and trust; POVs are exploration maps.

### bookmarks

Post saving/clipping. Treated as a stronger preference signal than likes, heavily influencing the user sense centroid in timelines.

## SQL Management

SQL queries are not hardcoded in Go code but are externalized with named queries in `api/internal/db/queries/server.sql`.

```sql
-- name: feed.load_posts
SELECT id, user_id, COALESCE(username,''), text, created_at
FROM posts
WHERE id = ANY($1)
```

In Go, queries are referenced via `db.SQL("feed.load_posts")`. Implementation uses standard `embed` and a lightweight parser.

This approach is sufficient at current scale. When query count increases and benefits of type safety or code generation outweigh, `sqlc` will be considered.

## Main Request Flows

### Creating a Post

1. Frontend calls `POST /posts`.
2. Go API validates content and POV.
3. Go API sends post content to ML service `POST /embed`.
4. Stores in PostgreSQL: `posts` and `povs`.
5. If embedding succeeds, upsert into Qdrant's `posts` collection.
6. Even if Qdrant write fails, post storage is considered successful; search index can be rebuilt later.

### Generating POVs

1. Frontend sends text to `POST /posts/generate-povs`.
2. Go API calls ML service `POST /povs`.
3. ML service uses spaCy noun chunks, Japanese noun sequences, fallback regex to suggest short candidates.
4. Frontend displays candidates for user selection.

POV extraction is not automatic; human selection remains crucial for Daimon’s ranking quality.

### Timeline

1. Frontend calls `POST /posts/timeline`.
2. Go API converts query text or user centroid into a search vector.
3. Retrieves 100–200 candidates from Qdrant.
4. Bulk loads post content, POV, like/comment/save counts from PostgreSQL.
5. Creates sense centroid from user's own post vectors and saved posts.
6. Ranks with `RankBySenseDistance`.
7. Uses MMR to prune overly similar candidates.

Current ranking philosophy:

```text
near   = similarity(user_centroid, post_vector)
far    = 1 - near
common = shares_pov(user, post)
bridge = far * common

score =
  alpha * near
  + (1 - alpha) * bridge
  + common_pov_bonus
  + optional popularity / recency
```

Saves are treated as a stronger signal than likes. `bookmark` signals not only "want to read later" but also "this post is valuable for my model," aiding ML improvements.

### Search

Two types of search are combined:

- Text query: generate embedding via ML service, perform semantic search in Qdrant.
- POV query: directly fetch existing POVs from PostgreSQL.

This allows suggesting not only semantically similar texts but also existing POVs.

### POV Pages

POV pages are more than tag lists; they are "discussion rooms" from that perspective.

Current features:

- Search related posts
- List POV comments
- Save light reactions to POV

Future enhancements:

- Recent POV comments
- Popular POV comments
- Users strongly associated with the POV
- Similar, adjacent, opposing, or tensioned POVs
- People/posts with different perspectives on the same point

## Batch Jobs

`api/cmd/batch` precomputes heavy read models.

### deepAnalyzeJob

Splits long posts into chunks, extracts additional POVs from each. Since detailed posts contain multiple viewpoints, this decomposes one post into multiple POV nodes.

### suggestJob

Caches popular and semantically related POVs in Redis:

```text
suggest:popular
suggest:related:{pov}
```

### timelineJob

Precomputes home feed candidates per user, storing in Redis as `feed:{userId}`.

## Future Architectural Extensions

### post_pov_assertions

Currently, `povs` are tags. Next, relationships between posts and POVs will be stored as assertions:

```text
post_pov_assertions
  id
  post_id
  pov_id
  lean or grade
  comment
  spoiler
  confidence
  created_by
  created_at
```

This enables storing "this post has this POV" as well as "viewing this post from this POV feels like..."

### pov_definitions

POV definitions will have descriptions:

```text
pov_definitions
  id
  title
  category
  description
  examples
  synonyms
  parent_pov
  merged_into
```

Open vocabulary will be maintained. Frequently used POVs will have explanations and synonyms to improve search, merging, and safety.

### Graph / Exploration Read Model

Exploration views will not generate huge graphs directly from PostgreSQL tables each time but will be built as small POV-centered read models.

Data can be stored as graphs internally, but the UI will prioritize a "sense map"—a local, readable map with `sense-distance`—rather than a massive force-directed graph.

Initial nodes:

- POV
- Post
- User

Initial edges:

- post has POV
- user asserted POV
- user commented on POV
- user saved post
- POV similar to POV
- same-axis disagreement

In MVP, the entire graph won't be shown. The API will return only 1-2 hops centered on a single POV.

Sample API response:

```json
{
  "center": { "type": "pov", "id": "tempo", "label": "テンポがよい" },
  "nodes": [],
  "edges": [],
  "zones": {
    "near": [],
    "bridge": [],
    "far": []
  }
}
```

`zones` assist the UI in rendering the sense map. Prioritizing readability over precise physics simulation, the zones indicate "close," "slightly distant," and "distant but on the same axis."

## Performance Policies

### Frontend

- Timeline avoids re-rendering the entire page.
- PostCards are split into small, memoizable components.
- POV suggestions debounce.
- Exploration views load lightly initially, with node limits.
- For over 100 nodes, avoid DOM overload—consider canvas/WebGL or virtualization.

### API

- Avoid N+1 queries; bulk load from ID lists.
- Use Qdrant for candidate generation, PostgreSQL for authoritative and final display data.
- Use Redis for speed, not correctness.
- When ML fails, fall back to empty candidates or degraded responses, ensuring core posting/viewing flows continue.

### ML/Vector

- When models change, re-embed all existing posts.
- Changing Qdrant vector dimensions is treated as a migration.
- Search quality is judged not only by semantic similarity but also by POV match, saves, recency, and same-axis disagreement.

## Things Not Yet Implemented

- User scoring-based global ranking.
- Exposure of a global centrality score.
- Massive 3D graph visualizations.
- Using force-directed graphs as the main UI.
- POV pages as statistical dashboards.
- Fully ML-driven POV determination.