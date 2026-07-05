# API Feed Load Latency Memo

Date: 2026-07-05

## Scope

`api/internal/server/feed.loadBundle` materializes post cards for timeline,
search, saved, following, cached timeline, and profile-post views.

## Before

`loadBundle` executed these independent reads serially:

1. post POVs
2. post metadata
3. like counts
4. comment counts
5. viewer liked set
6. viewer saved set
7. POV like counts
8. viewer POV liked set

Timeline ranking then issued save counts after the bundle, making the timeline
materialization path 9 serial PostgreSQL round trips after Qdrant hits were
available.

## After

The bundle loader now runs independent reads in parallel:

1. Phase 1: post metadata, post POVs, like counts, comment counts, viewer liked
   set, viewer saved set, and timeline-only save counts.
2. Phase 2: POV like counts and viewer POV liked set after the phase-1 POV list
   is known.

This keeps response contents unchanged but reduces the DB critical path from
8 serial bundle round trips, or 9 for timeline, to 2 dependent PostgreSQL
phases. On a local 10 ms per-round-trip model, that is approximately 80-90 ms
of DB wait reduced to roughly 20 ms before row decode and rendering costs.

## Validation

Local validation commands:

- `cd api && go test ./...`
- `cd api && go vet ./...`

No local Postgres/Qdrant fixture is checked into this repository, so the memo
uses the measured query-phase count of the code path rather than a live database
trace. Production latency should still be confirmed with request tracing.
