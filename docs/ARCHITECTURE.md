# Architecture: Daimon SNS

> Current note: the Docker stack now runs the Go API in `api/` plus the Python
> ML microservice in `ml-service/`. The Python FastAPI implementation in
> `backend/` still exists as a reference/local path and owns seed/migration
> tooling. See `docs/ARCHITECTURE.local.md` and `docs/ML_VECTOR.local.md` for
> the more detailed local implementation notes.

## Overview

Daimon is a "Sense Distance" SNS that connects users based on value similarity using Vector Search and POVs (Points of View). The system uses a hybrid approach combining explicit POV-based matching with implicit vector-based similarity.

## Design Philosophy

**PostgreSQL = System of Record (真実のDB)**  
**Qdrant = System of Search (検索・推薦のための近似インデックス)**

This separation ensures:
- **Strong consistency** for critical data (PostgreSQL)
- **High performance** for similarity search (Qdrant)
- **Regenerable index** (Qdrant can be rebuilt from PostgreSQL)
- **Scalability** through independent scaling strategies

---

## System Architecture

```
┌─────────────┐
│   Client    │ (React + TypeScript)
└──────┬──────┘
       │ HTTP/REST
┌──────▼─────────────────────────────────────┐
│         FastAPI Backend                     │
│  ┌──────────────────────────────────────┐  │
│  │  Authentication (Token-based)        │  │
│  │  - User registration/login           │  │
│  │  - Session management                 │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  Content Moderation                  │  │
│  │  - Text validation                   │  │
│  │  - Security checks                   │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  Embedding Service (Async)            │  │
│  │  - Sentence Transformers              │  │
│  │  - ThreadPoolExecutor                 │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  POV Generation (spaCy)              │  │
│  │  - Japanese (Janome)                 │  │
│  │  - English (NLTK)                    │  │
│  └──────────────────────────────────────┘  │
└──────┬──────────────────┬──────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  PostgreSQL  │   │    Qdrant    │
│ (System of   │   │ (System of   │
│  Record)     │   │  Search)     │
└──────────────┘   └──────────────┘
```

---

## Data Storage Strategy

### PostgreSQL (System of Record)

Stores all metadata and content that requires:
- Strong consistency (transactions, foreign keys, constraints)
- Relationships (JOIN operations)
- Aggregations and sorting
- Uniqueness constraints (duplicate prevention)

**Tables:**

1. **`posts`**
   - `id`: UUID (primary key)
   - `user_id`: Foreign key to user
   - `text`: Full post content
   - `tags`: Array of POVs (Points of View)
   - `auto_tags`: Array of auto-generated POVs (subset of tags)
   - `created_at`, `updated_at`: Timestamps

2. **`likes`**
   - `id`: UUID (primary key)
   - `post_id`: Foreign key to posts (CASCADE delete)
   - `user_id`: User who liked
   - Unique constraint: (post_id, user_id)

3. **`comments`**
   - `id`: UUID (primary key)
   - `post_id`: Foreign key to posts (CASCADE delete)
   - `user_id`: User who commented
   - `text`: Comment content
   - `created_at`: Timestamp

4. **`pov_likes`**
   - `id`: UUID (primary key)
   - `pov`: POV (tag) name (indexed)
   - `user_id`: User who liked the POV
   - Unique constraint: (pov, user_id)

**Stored in PostgreSQL:**
- Post text, tags (POVs), auto_tags, created_at
- User authentication data (in-memory for MVP, can migrate to PostgreSQL)
- Likes (with uniqueness constraint)
- Comments
- POV likes
- All relationships

### Qdrant (System of Search)

Stores only minimal information needed for:
- Vector similarity search
- Fast filtering (tags, user_id, created_at)

**Stored in Qdrant payload:**
- `post_id`: Reference to PostgreSQL (required)
- `user_id`: For filtering (e.g., block user's posts)
- `tags`: For tag-based filtering (lightweight, normalized)
- `created_at`: For time-based filtering (epoch timestamp)

**Vector:**
- 384-dimensional embedding (all-MiniLM-L6-v2)
- Cosine similarity for matching

**NOT stored in Qdrant:**
- Full text (retrieved from PostgreSQL)
- Author details (can change)
- Likes/comments count (frequently updated)
- Complex relationships

---

## Core Concepts

### POVs (Points of View)

POVs are user-defined or auto-generated tags that represent perspectives, interests, or viewpoints. They enable:
- **Explicit matching**: Users can search and filter by specific POVs
- **Match rate calculation**: Jaccard similarity between user's POVs and post POVs
- **Recommendation**: Prioritize posts with matching POVs

**Constraints:**
- Maximum length: 300 characters
- Maximum per post: 100 POVs
- Can contain spaces (multi-word POVs)
- Auto-generated POVs are extracted using spaCy (Japanese/English)

### Hybrid Recommendation Logic

The system combines two matching strategies:

1. **Vector Similarity** (Implicit)
   - Cosine similarity between embeddings
   - Captures semantic meaning
   - Weight: `similarity_weight` (default 0.7)

2. **POV Matching** (Explicit)
   - Jaccard similarity: `len(common_povs) / len(union_povs)`
   - Tag-based filtering
   - Weight: `1 - similarity_weight`

**Final Score:**
```
score = α * vector_similarity + β * pov_match_rate
```

Where:
- `α = similarity_weight` (default 0.7)
- `β = 1 - similarity_weight` (default 0.3)

### Sense-Distance Discovery Ranking (Echo-Chamber Breaker)

Pure similarity ranking creates an echo chamber: you only ever see what you
already agree with. Daimon's timeline ranker (`services/discovery_service.py`)
deliberately surfaces **bridges** — posts that are semantically *distant* from
the user's own "sense" yet share a common-ground POV ("different conclusion,
shared value") — and then de-duplicates the feed with **MMR (Maximal Marginal
Relevance)** so it stays diverse instead of ten near-identical takes.

Per-candidate base score (then MMR rerank):
```
near   = cos(user_centroid, post)          # closeness to the user's sense
far    = 1 - near
bridge = far * 1[post.tags ∩ user.tags]    # distant AND shares a value
base   = α·near + (1-α)·bridge + 0.15·common_ground [+ 0.20·popularity]
```

- `user_centroid` = mean of the user's own post embeddings.
- `α = similarity_weight`: the UI slider becomes a real "near opinions ↔ far-but-bridged" dial.
- `include_far_posts` toggles the bridge term (otherwise "far" is just noise).
- `boost_popular` adds the popularity term.

This makes the previously-inert tuning knobs functional, and the result is
**explainable**: each post returns a `reason`, a `sense_distance` (0=near,
1=far) and an `is_bridge` flag, surfaced in the UI (🌉 BRIDGE badge).

This is the same family of ideas as bridging-based ranking (Twitter Community
Notes, Polis): rank for *constructive cross-perspective contact*, not just
agreement.

---

## API Patterns

### Pattern A: Qdrant → PostgreSQL (Recommended)

**Use case:** Vector similarity search, recommendations

1. **Qdrant**: Get candidate post IDs (100-200 candidates)
2. **PostgreSQL**: Batch fetch details, apply permissions, JOIN relationships
3. **PostgreSQL**: Final sorting (popularity, time decay, POV match rate)

**Example:** `get_timeline()`, `search_posts()` with query text

**Benefits:**
- Qdrant excels at finding similar posts quickly
- PostgreSQL ensures data accuracy and permissions
- Can filter out deleted/blocked posts in PostgreSQL step
- Calculate POV match rates from PostgreSQL data

### Pattern B: PostgreSQL Only (Cost-Effective)

**Use case:** Simple queries that don't need vector search

**Examples:**
- Tag-only search (exact match)
- User's own posts
- Recent posts (time-sorted)
- POV suggestions (popular POVs)

**When to use:**
- No semantic similarity needed
- Simple filtering/sorting is sufficient
- Avoid unnecessary Qdrant overhead

---

## Implementation Details

### Creating a Post

```python
# 1. Sanitize and validate input (security)
sanitized_text = sanitize_text(post.text)
validate_post_text(sanitized_text)
validate_pov(tag) for each tag

# 2. Content moderation check
is_safe = content_moderation_service.check_content(sanitized_text)

# 3. Generate embedding asynchronously (non-blocking)
vector = await embedding_service.embed_text_async(sanitized_text)

# 4. Save to PostgreSQL (System of Record) - Transaction
db_post = PostModel(
    id=post_id,
    user_id=user_id,
    text=sanitized_text,
    tags=final_tags,
    auto_tags=auto_tags,
    created_at=timestamp
)
db.add(db_post)
db.commit()

# 5. Save to Qdrant (System of Search) - Can fail, not fatal
qdrant_service.upsert_post(
    vector=vector,
    post_id=post_id,
    user_id=user_id,
    tags=final_tags,
    created_at=created_at_epoch
)
```

**Key points:**
- PostgreSQL transaction ensures consistency
- Qdrant upsert can fail without being fatal (regenerable)
- Embedding generation is async (non-blocking)
- Input sanitization prevents XSS attacks

### Searching Posts (Timeline/Recommendations)

```python
# Step 1: Generate query embedding (async)
vector = await embedding_service.embed_text_async(query_text)

# Step 2: Qdrant - Get candidates (System of Search)
hits = qdrant_service.search_similar(vector, limit=200)

# Step 3: PostgreSQL - Batch fetch details (System of Record)
post_ids = [hit.id for hit in hits]
db_posts_dict = {
    post.id: post 
    for post in db.query(PostModel)
    .filter(PostModel.id.in_(post_ids))
    .all()
}

# Step 4: Calculate POV match rates (Jaccard similarity)
for post in db_posts:
    common_povs = post.tags & user_post_tags
    total_povs = len(post.tags | user_post_tags)
    pov_match_rate = len(common_povs) / total_povs if total_povs > 0 else 0.0

# Step 5: Combine scores and sort
results.sort(key=lambda x: (
    similarity_weight * x.vector_similarity + 
    (1 - similarity_weight) * x.pov_match_rate
), reverse=True)
```

### Deleting a Post

```python
# 1. Delete from PostgreSQL (cascade deletes likes/comments)
db.delete(db_post)
db.commit()

# 2. Delete from Qdrant (can fail - not fatal)
try:
    qdrant_service.client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=PointIdsList(points=[post_id])
    )
except Exception as e:
    logger.warning("Qdrant deletion failed - can regenerate")
```

---

## Security Architecture

### Input Validation

**Frontend (`frontend/src/utils/security.ts`):**
- `sanitizeText()`: XSS prevention
- `validatePOV()`: POV input validation
- `validatePostText()`: Post text validation
- `escapeHtml()`: HTML escaping

**Backend (`backend/app/utils/security.py`):**
- `sanitize_text()`: Text sanitization
- `validate_pov()`: POV validation (max 300 chars, dangerous patterns)
- `validate_post_text()`: Post text validation
- `sanitize_sql_input()`: SQL injection prevention (defense-in-depth)

### Authentication

- **Token-based**: UUID session tokens
- **Header-based**: `Authorization: Bearer <token>`
- **Dependency injection**: `get_current_user()` in FastAPI
- **In-memory storage**: For MVP (can migrate to PostgreSQL)

### Content Moderation

- Keyword-based filtering
- Spam pattern detection
- Length validation
- (Can integrate Perspective API, AWS Comprehend, etc.)

---

## Component Architecture

### Frontend Structure

```
frontend/src/
├── components/
│   ├── PostCard/
│   │   ├── PostHeader.tsx      # User info, match details
│   │   ├── PostContent.tsx     # Text and POVs
│   │   ├── POVList.tsx         # POV display with likes
│   │   └── PostActions.tsx     # Like, comment actions
│   ├── PostInputForm/
│   │   └── POVInput.tsx        # POV input with suggestions
│   ├── PostCard.tsx            # Main post component
│   ├── PostInputForm.tsx       # Post creation form
│   ├── TimelinePage.tsx        # Timeline view
│   ├── SearchPage.tsx          # Search view
│   └── ...
├── api/
│   └── client.ts               # API client with types
├── types/
│   └── enums.ts                # TypeScript enums
└── utils/
    └── security.ts             # Security utilities
```

### Backend Structure

```
backend/app/
├── routers/
│   ├── auth.py                 # Authentication endpoints
│   └── posts.py                # Post endpoints
├── services/
│   ├── embedding_service.py   # Async embedding generation
│   ├── qdrant_service.py      # Qdrant operations
│   └── content_moderation_service.py
├── models/
│   └── api.py                 # Pydantic models
├── database.py                # SQLAlchemy models
├── utils/
│   ├── enums.py               # Python enums
│   └── security.py            # Security utilities
└── main.py                    # FastAPI app
```

---

## Error Handling

### Qdrant Failures
- **Not fatal**: Qdrant is a regenerable index
- **Recovery**: Can rebuild from PostgreSQL data
- **Logging**: Log warnings but continue operation
- **Graceful degradation**: Return results from PostgreSQL only

### PostgreSQL Failures
- **Fatal**: PostgreSQL is the source of truth
- **Transaction rollback**: Ensure data consistency
- **Error propagation**: Return appropriate HTTP errors
- **Validation**: Pydantic models validate input before database operations

### Embedding Generation Failures
- **Async handling**: Non-blocking, uses ThreadPoolExecutor
- **Fallback**: Can use cached embeddings or default vectors
- **Timeout**: Set reasonable timeouts for embedding generation

---

## Performance Considerations

### Batch Operations
- Use `IN` queries for batch fetching from PostgreSQL
- Aggregate likes/comments counts in single queries
- Avoid N+1 query problems
- Batch POV like status checks

### Caching Opportunities
- User's own posts (for match reason calculation)
- Popular POVs (for suggestions)
- User preferences
- Embedding cache (for repeated queries)

### Async Processing
- **Embedding generation**: Async with ThreadPoolExecutor
- **Qdrant upsert**: Can be async (background job in production)
- **POV generation**: Debounced (800ms) to reduce API calls
- **Background jobs**: For heavy operations (future)

### Database Indexing
- `posts.user_id`: Indexed for user queries
- `posts.created_at`: Indexed for time-based sorting
- `likes.post_id`, `likes.user_id`: Indexed for like queries
- `pov_likes.pov`, `pov_likes.user_id`: Indexed for POV like queries

---

## Interview Talking Points

### 1. Separation of Concerns
- PostgreSQL handles consistency and relationships
- Qdrant handles similarity search performance
- Clear boundaries: System of Record vs System of Search

### 2. Regenerable Index
- Qdrant can be rebuilt from PostgreSQL
- Failures in Qdrant don't affect data integrity
- Eventual consistency acceptable for search index

### 3. Hybrid Recommendation
- Combines explicit (POV) and implicit (vector) signals
- Tunable weights for different use cases
- Explainable: Users can see why posts matched

### 4. Security First
- Input validation at multiple layers
- XSS prevention (React + sanitization)
- SQL injection prevention (ORM + validation)
- Content moderation integration

### 5. Scalability
- PostgreSQL scales for transactional workloads
- Qdrant scales for vector search workloads
- Independent scaling strategies
- Async processing prevents blocking

### 6. Code Quality
- Component-based architecture (frontend)
- Service-oriented architecture (backend)
- Type safety (TypeScript + Pydantic)
- Enum usage for constants
- Security utilities for common patterns

---

## Future Improvements

### Short-term
- [ ] Migrate user authentication to PostgreSQL
- [ ] Add Redis caching layer
- [ ] Implement rate limiting
- [ ] Add comprehensive test coverage

### Medium-term
- [ ] Background job queue (Celery/RQ)
- [ ] Real-time updates (WebSockets)
- [ ] Advanced content moderation (ML models)
- [ ] User blocking/muting features

### Long-term
- [ ] Multi-region deployment
- [ ] GraphQL API option
- [ ] Mobile app support
- [ ] Advanced recommendation algorithms (collaborative filtering)
