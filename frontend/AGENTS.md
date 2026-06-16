# Codex Context: Daimon Frontend Workspace

このworkspaceは `daimon/frontend` 単独で開かれる想定です。Daimon全体では、ここがReact UIです。

## Project Overview

Daimon は、投稿本文の意味ベクトルと POV(Point of View / 観点)を組み合わせて、近い投稿だけでなく「遠いが共通の観点を持つ投稿」を見つけるSNSプロトタイプです。

全体構成:

```text
frontend/      React UI (:5173)  ← this workspace
api/           Go API (:8000)
ml-service/    Python ML service (:8001)  ← the only Python
PostgreSQL     system of record
Qdrant         vector search index
Redis          optional read-model cache
```

Frontend は Go API と通信します。API base URL は `VITE_API_BASE_URL`、未設定時は `http://localhost:8000` です。

## What This Workspace Owns

- app shell and routing state: `src/App.tsx`
- API client/types: `src/api/client.ts`
- timeline/search/saved/profile/POV pages: `src/components/`
- post card decomposition: `src/components/PostCard/`
- input and POV suggestion UI: `src/components/PostInputForm.tsx`
- global styles and performance containment: `src/index.css`
- small hooks: `src/hooks/`
- utility functions: `src/utils/`

## Product Concepts

Daimon is not a normal engagement-maximizing SNS.

Important UX concepts:

- POV comments are different from normal comments.
  - Normal comment: talk about this post.
  - POV comment: talk about how this looks from this point of view.
- Same-axis disagreement is valuable: same POV, different feeling.
- UI should be light; theory/ranking complexity should stay underground.
- Avoid user ranking, follower-count status games, anger notifications, or statistics dashboards as primary UX.
- Graph exploration should be a sense-distance exploration/map, not a huge force-directed graph as the main screen.

## Frontend Stack

- React 19
- Vite
- TypeScript
- TanStack Query
- ky
- lucide-react
- Tailwind CSS v4 via `@import "tailwindcss"`
- Biome for lint/check

## Runtime

Install:

```bash
pnpm install
```

Run dev server:

```bash
VITE_API_BASE_URL=http://localhost:8000 pnpm dev
```

Build:

```bash
pnpm build
```

Lint/check:

```bash
pnpm lint
```

The backend stack can be started from repo root with:

```bash
make docker
```

or, if running Go API on host:

```bash
make deps-up
cd ../api
go run ./cmd/server
```

## API Contract

Types live in `src/api/client.ts`. Keep frontend assumptions aligned with Go API responses.

Important API areas:

- auth: `/auth/*`
- timeline: `POST /posts/timeline`
- search: `POST /posts/search`
- post creation: `POST /posts/`
- POV suggestions: `GET /posts/povs/suggest`
- POV comments: `/posts/povs/{pov}/comments`
- follow/profile: `/users/{id}`
- saves/bookmarks: `/posts/{id}/save`, `/posts/saved`

## Performance Rules

Frontend performance matters a lot for this project.

- Keep list rendering cheap. `PostCard` and subcomponents should stay memo-friendly.
- Avoid creating new inline callbacks in large `.map()` lists when a stable callback can be used.
- Use TanStack Query cache updates for optimistic actions instead of broad refetches where safe.
- Avoid N+1 UI-triggered API calls from card lists.
- Keep search and POV suggestions debounced.
- Keep `content-visibility: auto` for post cards.
- Avoid expensive formatting/parsing inside large lists unless memoized.
- Do not put huge graph visualizations in the first viewport.
- Mobile should degrade graph/exploration views to card/list style if needed.

## UI Rules

- Build the actual app experience, not a landing page.
- Use icons for tool buttons when possible.
- Text must not overflow compact controls on mobile.
- Do not put cards inside cards unless it is a modal or a repeated item.
- Keep controls familiar: buttons for commands, toggles for binary settings, inputs/sliders for values.
- Avoid making UI feel like a statistics dashboard. Prefer short "why this appeared" reasons.

## Common Pitfalls

- Do not call `getCurrentUser()` in many pages if App already has the user.
- Do not duplicate API response types outside `src/api/client.ts`.
- Do not assume all users are logged in; many read endpoints work with optional auth.
- Do not expose raw vector scores as primary UI.
- Do not add frontend-only features that require backend data without updating API contracts.
- Do not break `VITE_API_BASE_URL`; Antigravity workspaces may run frontend alone.
