# Graph Report - daimon  (2026-07-27)

## Corpus Check
- 190 files · ~78,130 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1593 nodes · 2744 edges · 131 communities (115 shown, 16 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 254 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4dd2dd54`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- timelineJob
- .HandleTimeline
- SearchPostCard.tsx
- Server
- Architecture
- ignore
- app.py
- Architecture
- server_integration_test.go
- Cache
- NewWithTimeout
- Product And UX
- useI18n
- Product And UX
- PostCard.tsx
- useSearchController.ts
- User
- What You Must Do When Invoked
- AuthModal.tsx
- Client
- .HandleRegister
- App.tsx
- usePostCardActions.ts
- compilerOptions
- i18n/index.ts
- .HandleAddPOVComment
- .HandleAddComment
- Content Moderation
- DAIMON — 研究・理論ドシエ（武器庫 / 完全版）
- DAIMON — Research & Theoretical Dossier (Armory / Complete Edition)
- devDependencies
- Content Moderation
- scripts
- UserID
- test_app.py
- seed/main.go
- Roadmap
- Decode
- Internal
- Roadmap
- dependencies
- @biomejs/biome
- Codex Context: Daimon API Workspace
- API Feed Load Latency Memo
- Codex Context: Daimon Frontend Workspace
- Codex Context: Daimon ML Service Workspace
- Daimon
- Daimon
- .HandleLikePOV
- frontend/package.json
- graphify reference: extra exports and benchmark
- compilerOptions
- .HandleLike
- post_types.go
- Prioritization of Features
- 機能優先順位
- Daimon Runbook
- vercel.json
- .HandleFollowingFeed
- Handler
- Handler
- .requirePost
- graphify reference: query, path, explain
- Daimon Docs
- 10. Folksonomy / Open Vocabulary
- 11. Aspect-Based Sentiment
- 12. Explainable Recommendation
- 1. Tesler's Law
- 2. Perspective-getting
- 3. Opinion Space
- 4. Bridging-Based Ranking
- 5. Habermas Machine / Common Ground
- 6. Information Foraging
- 7. Information As Reward
- 8. Self-Disclosure Reward
- 9. Optimal Distinctiveness
- 10. Folksonomy / Open Vocabulary
- 11. Aspect-Based Sentiment
- 12. Explainable Recommendation
- 1. Tesler's Law
- 2. Perspective-getting
- 3. Opinion Space
- 4. Bridging-Based Ranking
- 5. Habermas Machine / Common Ground
- 6. Information Foraging
- 7. Information As Reward
- 8. Self-Disclosure Reward
- 9. Optimal Distinctiveness
- scripts
- PULL_REQUEST_TEMPLATE.md
- auth.go
- Post
- .HandleGeneratePOVs
- Handler
- Daimon Docs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- From Theory to Features
- follows.go
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Theory To Features
- AGENTS.md
- corpus.go
- povs.go
- extraction-spec.md
- postcss
- tailwindcss
- @tailwindcss/postcss
- @testing-library/react
- @types/react-dom
- vitest
- daimon/api
- daimon-ml-service
- schema.sql
- SQL

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 71 edges
2. `SQL()` - 59 edges
3. `User` - 46 edges
4. `Internal()` - 35 edges
5. `UserID()` - 29 edges
6. `Post` - 25 edges
7. `timelineJob()` - 17 edges
8. `Decode()` - 16 edges
9. `compilerOptions` - 16 edges
10. `From Theory to Features` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `FromEnv()`  [INFERRED]
  api/cmd/batch/main.go → api/internal/config/config.go
- `sessionCleanupJob()` --calls--> `SQL()`  [INFERRED]
  api/cmd/batch/main.go → api/internal/db/queries.go
- `deepAnalyzeJob()` --calls--> `SQL()`  [INFERRED]
  api/cmd/batch/main.go → api/internal/db/queries.go
- `suggestJob()` --calls--> `SQL()`  [INFERRED]
  api/cmd/batch/main.go → api/internal/db/queries.go
- `suggestJob()` --calls--> `Cosine()`  [INFERRED]
  api/cmd/batch/main.go → api/internal/ranking/ranking.go

## Import Cycles
- None detected.

## Communities (131 total, 16 thin omitted)

### Community 0 - "timelineJob"
Cohesion: 0.07
Nodes (47): deepAnalyzeJob(), distinctPosters(), Client, Context, Pool, main(), sessionCleanupJob(), suggestJob() (+39 more)

### Community 1 - ".HandleTimeline"
Cohesion: 0.08
Nodes (41): clamp01(), Cosine(), dot(), explainReason(), normalize(), RankBySenseDistance(), T, tags() (+33 more)

### Community 2 - "SearchPostCard.tsx"
Cohesion: 0.19
Nodes (13): PostHeader, PostHeaderComponent(), viewer, POVCommentList(), SearchPostCardComponent(), absoluteFormatters, formatRelativeDate(), relativeFormatters (+5 more)

### Community 3 - "Server"
Cohesion: 0.07
Nodes (29): env(), FromEnv(), splitCSV(), T, TestSplitCSV(), clientIP(), Duration, Handler (+21 more)

### Community 4 - "Architecture"
Cohesion: 0.05
Nodes (37): API, Architecture, Batch Jobs, bookmarks, Creating a Post, Current Data Model, deepAnalyzeJob, Design Principles (+29 more)

### Community 5 - "ignore"
Cohesion: 0.05
Nodes (37): source, assist, actions, noUnusedImports, noUnusedPrivateClassMembers, noUnusedVariables, files, includes (+29 more)

### Community 6 - "app.py"
Cohesion: 0.10
Nodes (33): BaseModel, Exception, FastAPI, field_validator, get, middleware, BatchReq, _chunks() (+25 more)

### Community 7 - "Architecture"
Cohesion: 0.05
Nodes (37): API, Architecture, Batch jobs, bookmarks, deepAnalyzeJob, follows, frontend, graph / exploration read model (+29 more)

### Community 8 - "server_integration_test.go"
Cohesion: 0.21
Nodes (22): assertHealthResponse(), get(), Handler, ResponseRecorder, T, routerWithUnavailableDatabase(), TestLivenessDoesNotDependOnDatabase(), TestReadinessReportsUnavailableDatabase() (+14 more)

### Community 9 - "Cache"
Cohesion: 0.10
Nodes (24): Client, Context, Duration, New(), bundle, Client, bundle, Handler (+16 more)

### Community 10 - "NewWithTimeout"
Cohesion: 0.12
Nodes (23): Context, Duration, New(), NewWithTimeout(), T, TestEmbedBatchValidatesVectorCount(), TestEmbedBatchValidatesVectorDimension(), TestEmbedValidatesVectorDimension() (+15 more)

### Community 11 - "Product And UX"
Cohesion: 0.06
Nodes (31): 1. Exploration Rewards, 2. Self-Disclosure Rewards, 3. Discovery Rewards, 4. Collection Rewards, 5. Belonging Rewards, 6. Growth Rewards, 7. Closure Rewards, Closure Beat (+23 more)

### Community 12 - "useI18n"
Cohesion: 0.15
Nodes (18): createPost(), CommentsPanel(), PostActions(), PostActionsProps, PostCardActions, AutoPOVSuggestions(), AutoPOVSuggestionsProps, ManualPOVInput() (+10 more)

### Community 13 - "Product And UX"
Cohesion: 0.06
Nodes (31): 1. 探索の報酬, 2. 自己開示の報酬, 2種類の報酬, 3. 発見の報酬, 4. 収集の報酬, 5. 所属の報酬, 6. 成長の報酬, 7. Closureの報酬 (+23 more)

### Community 14 - "PostCard.tsx"
Cohesion: 0.14
Nodes (15): getTimeline(), getSavedPosts(), MyPostsPage(), MyPostsPageProps, DeletePostDialog(), DeletePostDialogProps, PostCard, PostCardProps (+7 more)

### Community 15 - "useSearchController.ts"
Cohesion: 0.13
Nodes (22): searchPosts(), suggestPOVs(), UsePostComposerOptions, emptyInitialTags, SearchControls(), SearchControlsProps, SearchPage(), SearchPageProps (+14 more)

### Community 16 - "User"
Cohesion: 0.22
Nodes (15): POVCommentStance, User, POVCommentComposer(), POVCommentComposerProps, POVCommentListProps, POVDiscussionPage(), POVDiscussionPageProps, POVHero() (+7 more)

### Community 17 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 18 - "AuthModal.tsx"
Cohesion: 0.12
Nodes (26): deleteAccount(), login(), register(), updateProfile(), apiErrorMessage(), errorMessage(), hasJsonResponse(), localizedErrorMessage() (+18 more)

### Community 19 - "Client"
Cohesion: 0.18
Nodes (14): cosineSimilarity(), Context, Pool, matchesAnyTag(), New(), scanPoints(), T, TestCosineSimilarity() (+6 more)

### Community 20 - ".HandleRegister"
Cohesion: 0.19
Nodes (14): Handler, Context, Request, ResponseWriter, Time, HashToken(), T, TestHashTokenIsDeterministicAndNotPlaintext() (+6 more)

### Community 21 - "App.tsx"
Cohesion: 0.07
Nodes (33): getCurrentUser(), logout(), clearAuthSession(), App(), AuthModal, MyPostsPage, pageFromPath(), pagePaths (+25 more)

### Community 22 - "usePostCardActions.ts"
Cohesion: 0.05
Nodes (58): resolveAPIBaseURL(), api, API_BASE_URL, getAuthToken(), addComment(), deletePost(), generateMockPOVs(), generatePOVs() (+50 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+14 more)

### Community 24 - "i18n/index.ts"
Cohesion: 0.13
Nodes (22): MatchReasonDetailsModal(), MatchReasonDetailsModalProps, SettingsModal(), SettingsModalProps, ModalFrame(), ModalFrameProps, detectLocale(), getStorage() (+14 more)

### Community 25 - ".HandleAddPOVComment"
Cohesion: 0.31
Nodes (7): cleanStance(), Handler, Request, ResponseWriter, povFromRoute(), povCommentReq, povCommentResp

### Community 26 - ".HandleAddComment"
Cohesion: 0.60
Nodes (3): Handler, Request, ResponseWriter

### Community 27 - "Content Moderation"
Cohesion: 0.11
Nodes (17): 1. Provide reasons, not conflicts, 2. Do not inflame with numbers, 3. Make spoiler control a top priority, 4. Maintain an open vocabulary while ensuring order, Basic Policies, Content Moderation, Current Capabilities, Next Safety Features to Implement (+9 more)

### Community 28 - "DAIMON — 研究・理論ドシエ（武器庫 / 完全版）"
Cohesion: 0.11
Nodes (18): 0. 一行で, 10. 一段落でのまとめ（面接で言うなら）, 1. 解決しようとしている課題, 2. 中核アイデア: 観点(POV)を一級市民にする, 3. Sense-Distance ランキング（署名機能）, 4. アーキテクチャ（要点）, 5.1 脳科学（“通信”と“距離”が脳レベルで実在する）, 5.2 心理学（“観点分解”と“距離越え”が人を動かす） (+10 more)

### Community 29 - "DAIMON — Research & Theoretical Dossier (Armory / Complete Edition)"
Cohesion: 0.11
Nodes (18): 0. In a sentence, 10. One-paragraph summary (like in an interview), 1. The challenges we aim to solve, 2. Core idea: Making perspectives (POV) first-class citizens, 3. Sense-Distance Ranking (Signature feature), 4. Architecture (Key points), 5.1 Neuroscience (“communication” and “distance” exist at brain level), 5.2 Psychology (“perspective decomposition” and “cross-distance” influence people) (+10 more)

### Community 30 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, jsdom, @testing-library/jest-dom, @types/node, @types/react, typescript (+9 more)

### Community 31 - "Content Moderation"
Cohesion: 0.12
Nodes (17): 1. 衝突ではなく理由を出す, 2. 数字で煽らない, 3. ネタバレ制御を一級にする, 4. open vocabularyを守りつつ整える, Content Moderation, ML/APIを使う場合の位置づけ, Phase 1: report, Phase 2: block / mute (+9 more)

### Community 32 - "scripts"
Cohesion: 0.12
Nodes (15): license, name, packageManager, private, scripts, all, build, clean (+7 more)

### Community 33 - "UserID"
Cohesion: 0.39
Nodes (5): UserID(), Request, ResponseWriter, Handler, ctxKey

### Community 34 - "test_app.py"
Cohesion: 0.15
Nodes (5): fixture, reset_model_state(), test_embed_batch_rejects_count_mismatch(), test_embed_endpoint_contract(), vector()

### Community 35 - "seed/main.go"
Cohesion: 0.11
Nodes (24): copyInto(), countUsers(), embedAll(), Context, Pool, main(), makePost(), normalize() (+16 more)

### Community 36 - "Roadmap"
Cohesion: 0.14
Nodes (13): Current Status, MVP Ideal State, Phase 1: Make POV pages the core of Daimon, Phase 2: post_pov_assertions, Phase 3: Coaxial disagreement cards, Phase 4: POV definitions, Phase 5: Exploration view, Phase 6: Closure interaction (+5 more)

### Community 37 - "Decode"
Cohesion: 0.26
Nodes (11): Decode(), Error(), Request, ResponseWriter, JSON(), T, TestDecodeRejectsOversizedBody(), TestDecodeRejectsTrailingJSON() (+3 more)

### Community 38 - "Internal"
Cohesion: 0.29
Nodes (10): Handler, Request, ResponseWriter, Logger, Request, ResponseWriter, Internal(), logRequest() (+2 more)

### Community 39 - "Roadmap"
Cohesion: 0.15
Nodes (13): MVP完成形, Phase 1: POVページをDaimonの中心にする, Phase 2: post_pov_assertions, Phase 3: 同軸異見カード, Phase 4: POV definitions, Phase 5: 探索ビュー, Phase 6: Closure beat, Phase 7: POV activity timeline (+5 more)

### Community 40 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, ky, lucide-react, react, react-dom, react-router-dom, @tanstack/react-query, ky (+5 more)

### Community 43 - "Codex Context: Daimon API Workspace"
Cohesion: 0.17
Nodes (11): API Surface, Architecture Rules, Codex Context: Daimon API Workspace, Common Pitfalls, Important Data Model, Product Direction To Preserve, Project Overview, Ranking (+3 more)

### Community 44 - "API Feed Load Latency Memo"
Cohesion: 0.17
Nodes (10): After, API Feed Load Latency Memo, Before, APIフィード読み込み遅延メモ, 以前, 変更後, 検証, 範囲 (+2 more)

### Community 46 - "Codex Context: Daimon Frontend Workspace"
Cohesion: 0.18
Nodes (10): API Contract, Codex Context: Daimon Frontend Workspace, Common Pitfalls, Frontend Stack, Performance Rules, Product Concepts, Project Overview, Runtime (+2 more)

### Community 48 - "Codex Context: Daimon ML Service Workspace"
Cohesion: 0.18
Nodes (10): API Surface, Codex Context: Daimon ML Service Workspace, Common Pitfalls, Docker, Embedding Model, Long Text Embedding, Performance Rules, POV Extraction (+2 more)

### Community 49 - "Daimon"
Cohesion: 0.18
Nodes (11): CI/CD, Daimon, Host 開発, License, ML と Vector の流れ, Quick Start, まず知ること, よく使うコマンド (+3 more)

### Community 50 - "Daimon"
Cohesion: 0.18
Nodes (11): CI/CD, Daimon, ML とベクトルの流れ, Quick Start, まず知ること, よく使うコマンド, アーキテクチャ概要, ディレクトリ (+3 more)

### Community 51 - ".HandleLikePOV"
Cohesion: 0.44
Nodes (5): Handler, Request, ResponseWriter, povParam(), likeResp

### Community 52 - "frontend/package.json"
Cohesion: 0.20
Nodes (9): engines, node, pnpm, license, name, packageManager, private, type (+1 more)

### Community 53 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 54 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include, vite.config.ts

### Community 55 - ".HandleLike"
Cohesion: 0.57
Nodes (4): Context, Handler, Request, ResponseWriter

### Community 56 - "post_types.go"
Cohesion: 0.25
Nodes (7): cleanPOVs(), addCommentReq, commentResp, createPostReq, likeResp, likerResp, postResp

### Community 57 - "Prioritization of Features"
Cohesion: 0.25
Nodes (8): P0: 1 Gesture, P1: Closure Beat, P1: Coaxial Dissent Cards, P2: Enhance POV Page, P2: post_pov_assertions, P3: Exploration View, P3: POV Activity Timeline, Prioritization of Features

### Community 58 - "機能優先順位"
Cohesion: 0.25
Nodes (8): P0: 1ジェスチャー, P1: Closure beat, P1: 同軸異見カード, P2: post_pov_assertions, P2: POVページ強化, P3: POV activity timeline, P3: 探索ビュー, 機能優先順位

### Community 59 - "Daimon Runbook"
Cohesion: 0.25
Nodes (7): CI Gates, Cloud Deploy, Daimon Runbook, Incident Triage, Local Checks, Local Startup, Rollback

### Community 60 - "vercel.json"
Cohesion: 0.25
Nodes (7): buildCommand, framework, ignoreCommand, installCommand, outputDirectory, rewrites, $schema

### Community 61 - ".HandleFollowingFeed"
Cohesion: 0.62
Nodes (4): Context, Handler, Request, ResponseWriter

### Community 63 - "Handler"
Cohesion: 0.60
Nodes (5): Handler, Client, Logger, Pool, New()

### Community 64 - "Handler"
Cohesion: 0.60
Nodes (5): Client, Logger, Pool, Handler, New()

### Community 65 - ".requirePost"
Cohesion: 0.47
Nodes (4): Context, Handler, Request, ResponseWriter

### Community 66 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 67 - "Daimon Docs"
Cohesion: 0.33
Nodes (6): Daimon Docs, Daimonを一文で, まず読む順, 正本とローカルメモ, 現時点のMVP, 設計の合言葉

### Community 68 - "10. Folksonomy / Open Vocabulary"
Cohesion: 0.33
Nodes (6): 10. Folksonomy / Open Vocabulary, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 69 - "11. Aspect-Based Sentiment"
Cohesion: 0.33
Nodes (6): 11. Aspect-Based Sentiment, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 70 - "12. Explainable Recommendation"
Cohesion: 0.33
Nodes (6): 12. Explainable Recommendation, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 71 - "1. Tesler's Law"
Cohesion: 0.33
Nodes (6): 1. Tesler's Law, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 72 - "2. Perspective-getting"
Cohesion: 0.33
Nodes (6): 2. Perspective-getting, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 73 - "3. Opinion Space"
Cohesion: 0.33
Nodes (6): 3. Opinion Space, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 74 - "4. Bridging-Based Ranking"
Cohesion: 0.33
Nodes (6): 4. Bridging-Based Ranking, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 75 - "5. Habermas Machine / Common Ground"
Cohesion: 0.33
Nodes (6): 5. Habermas Machine / Common Ground, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 76 - "6. Information Foraging"
Cohesion: 0.33
Nodes (6): 6. Information Foraging, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 77 - "7. Information As Reward"
Cohesion: 0.33
Nodes (6): 7. Information As Reward, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 78 - "8. Self-Disclosure Reward"
Cohesion: 0.33
Nodes (6): 8. Self-Disclosure Reward, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 79 - "9. Optimal Distinctiveness"
Cohesion: 0.33
Nodes (6): 9. Optimal Distinctiveness, Daimonでの解釈, UIに出さない, UIに出す, 機能, 理論

### Community 80 - "10. Folksonomy / Open Vocabulary"
Cohesion: 0.33
Nodes (6): 10. Folksonomy / Open Vocabulary, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 81 - "11. Aspect-Based Sentiment"
Cohesion: 0.33
Nodes (6): 11. Aspect-Based Sentiment, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 82 - "12. Explainable Recommendation"
Cohesion: 0.33
Nodes (6): 12. Explainable Recommendation, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 83 - "1. Tesler's Law"
Cohesion: 0.33
Nodes (6): 1. Tesler's Law, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 84 - "2. Perspective-getting"
Cohesion: 0.33
Nodes (6): 2. Perspective-getting, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 85 - "3. Opinion Space"
Cohesion: 0.33
Nodes (6): 3. Opinion Space, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 86 - "4. Bridging-Based Ranking"
Cohesion: 0.33
Nodes (6): 4. Bridging-Based Ranking, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 87 - "5. Habermas Machine / Common Ground"
Cohesion: 0.33
Nodes (6): 5. Habermas Machine / Common Ground, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 88 - "6. Information Foraging"
Cohesion: 0.33
Nodes (6): 6. Information Foraging, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 89 - "7. Information As Reward"
Cohesion: 0.33
Nodes (6): 7. Information As Reward, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 90 - "8. Self-Disclosure Reward"
Cohesion: 0.33
Nodes (6): 8. Self-Disclosure Reward, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 91 - "9. Optimal Distinctiveness"
Cohesion: 0.33
Nodes (6): 9. Optimal Distinctiveness, Features, Interpretation in Daimon, Not shown in UI, Shown in UI, Theory

### Community 92 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 93 - "PULL_REQUEST_TEMPLATE.md"
Cohesion: 0.33
Nodes (5): Checklist, Description, Related Issues, Testing, Type of Change

### Community 94 - "auth.go"
Cohesion: 0.40
Nodes (4): loginReq, profileUpdateReq, registerReq, userResp

### Community 95 - "Post"
Cohesion: 0.16
Nodes (14): Post, MatchDetailsModal(), MatchDetailsModalProps, PostContent, PostContentComponent(), PostContentProps, renderTextWithHashtags(), PostHeaderProps (+6 more)

### Community 96 - ".HandleGeneratePOVs"
Cohesion: 0.60
Nodes (3): Handler, Request, ResponseWriter

### Community 97 - "Handler"
Cohesion: 0.70
Nodes (4): Logger, Pool, Handler, New()

### Community 98 - "Daimon Docs"
Cohesion: 0.40
Nodes (5): Canon and Local Notes, Current MVP, Daimon Docs, Daimon in One Sentence, Recommended Reading Order

### Community 99 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 100 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 101 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 102 - "From Theory to Features"
Cohesion: 0.50
Nodes (3): From Theory to Features, References, Summary

### Community 107 - "Theory To Features"
Cohesion: 0.67
Nodes (3): References, Theory To Features, まとめ

### Community 133 - "schema.sql"
Cohesion: 0.36
Nodes (11): bookmarks, comments, follows, likes, post_vectors, posts, pov_comments, pov_likes (+3 more)

### Community 135 - "SQL"
Cohesion: 0.24
Nodes (10): mustLoadQueries(), parseNamedQueries(), SQL(), T, TestLoginUserQueryIsCaseInsensitiveForUsername(), TestSQLLoadsNamedQuery(), TestSQLPanicsForUnknownQuery(), Handler (+2 more)

## Knowledge Gaps
- **639 isolated node(s):** `cluster`, `daimon/api`, `decodeReq`, `registerReq`, `loginReq` (+634 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SQL()` connect `SQL` to `timelineJob`, `.HandleTimeline`, `.requirePost`, `.HandleGeneratePOVs`, `Server`, `UserID`, `Internal`, `.HandleLikePOV`, `.HandleRegister`, `.HandleLike`, `.HandleAddPOVComment`, `.HandleAddComment`, `.HandleFollowingFeed`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `Theory To Features` connect `Theory To Features` to `10. Folksonomy / Open Vocabulary`, `11. Aspect-Based Sentiment`, `12. Explainable Recommendation`, `1. Tesler's Law`, `2. Perspective-getting`, `3. Opinion Space`, `4. Bridging-Based Ranking`, `5. Habermas Machine / Common Ground`, `6. Information Foraging`, `docs/README.md`, `7. Information As Reward`, `8. Self-Disclosure Reward`, `9. Optimal Distinctiveness`, `機能優先順位`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `From Theory to Features` connect `From Theory to Features` to `10. Folksonomy / Open Vocabulary`, `11. Aspect-Based Sentiment`, `12. Explainable Recommendation`, `1. Tesler's Law`, `2. Perspective-getting`, `3. Opinion Space`, `4. Bridging-Based Ranking`, `5. Habermas Machine / Common Ground`, `6. Information Foraging`, `7. Information As Reward`, `8. Self-Disclosure Reward`, `9. Optimal Distinctiveness`, `Prioritization of Features`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 58 inferred relationships involving `SQL()` (e.g. with `deepAnalyzeJob()` and `distinctPosters()`) actually correct?**
  _`SQL()` has 58 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `Internal()` (e.g. with `.HandleDeleteAccount()` and `.HandleLogin()`) actually correct?**
  _`Internal()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `UserID()` (e.g. with `logRequest()` and `.HandleDeleteAccount()`) actually correct?**
  _`UserID()` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `cluster`, `daimon/api`, `decodeReq` to the rest of the system?**
  _639 weakly-connected nodes found - possible documentation gaps or missing edges._