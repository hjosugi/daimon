<!-- i18n: language-switcher -->
[English](CONTENT_MODERATION.en.md) | [日本語](CONTENT_MODERATION.md)

# Content Moderation

Daimon's moderation is slightly more complex than typical social media comment sections. The reason is that Daimon treats not only posts but also "points of view (POV)" as units of conversation.

In ordinary comment sections, the target of trouble is the post itself. In Daimon, the target of trouble can extend to the POV itself, the person taking that POV, or people who hold the same POV but feel differently.

This document organizes the safety design for Daimon.

## What to Protect

There are four targets to protect:

1. The poster
2. People reacting to the POV
3. People writing POV comments
4. The POV space itself

Especially important is that the core of Daimon, "Orthogonal Divergence" (同軸異見), does not turn into attacks or exposure.

## Basic Policies

### 1. Provide reasons, not conflicts

The Orthogonal Divergence card is not a UI to expose opposing parties.

Bad display:

```text
People opposing you
```

Good display:

```text
Same perspective, with a slightly different feeling
```

It is safer to show reasons briefly before usernames. Focus on perspectives rather than personalities.

### 2. Do not inflame with numbers

In Daimon, it is better not to prominently display the following numbers:

- Number of oppositions
- Wins and losses
- Degree of flame (flame level)
- User influence score
- Graph centrality

Numbers can be used internally for ranking or safety judgments, but displaying them in the UI can provoke competition or attacks.

### 3. Make spoiler control a top priority

Since POV comments tend to delve into deep discussions about works or posts, spoiler management is necessary.

Required:

- Spoiler tags at the post level
- Spoiler tags at the POV assertion level
- Spoiler tags at the POV comment level
- Hide spoiler content in lists
- Allow users to choose spoiler display policies in settings

### 4. Maintain an open vocabulary while ensuring order

POV is an open vocabulary. Its freedom makes it interesting, but it also introduces trolls, discriminatory words, personal attacks, duplicates, and vague language.

Countermeasures:

- Validation when creating new POVs
- Suggestions for existing POVs
- Synonym consolidation
- `merged_into` management
- Explanation edits by administrators/trusted users
- Temporary hiding of reported POVs

## Current Capabilities

The current Go API provides a foundation for safety:

- Session authentication
- Deleting one's own posts
- Deleting one's own POV comments
- Follow / unfollow
- Removing followers
- Profile bio editing
- Bookmarking
- Input validation
- Externalized SQL + parameterized queries

Missing features include:

- Reporting
- Block / mute
- Admin interface
- Spoiler flags
- Merging / freezing POV definitions
- Rate limiting
- Safety filters for Orthogonal Divergence cards

## Next Safety Features to Implement

### Phase 1: Reporting

The first essential feature is reporting.

Targets:

- Post
- Comment
- POV comment
- POV
- User

Minimum schema:

```text
reports
  id
  target_type
  target_id
  reporter_id
  reason
  detail
  created_at
  status
```

`target_type` can be a string, but the API will fix allowed values.

### Phase 2: Block / Mute

Orthogonal Divergence is about "differences worth listening to." If you cannot remove people you don't want to see, the system cannot function properly.

Necessary:

- Block user
- Mute user
- Mute POV
- Exclude muted/blocked users from ranking candidates
- Exclude from Orthogonal Divergence card candidates

### Phase 3: Spoiler

This naturally goes in conjunction with `post_pov_assertions`.

```text
spoiler boolean
spoiler_scope optional
```

Hide content in lists, reveal upon explicit action.

### Phase 4: Rate Limiting

Reactions to POV comments and Orthogonal Divergence cards can cause trouble if spammed.

Necessary:

- Login / signup rate limit
- Post creation rate limit
- Comment creation rate limit
- POV comment creation rate limit
- Spam detection for reports

Using Redis, tokens can be managed via token buckets. If not available, start with simple DB-based limits.

### Phase 5: Quality and Safety Ranking

Candidates for Orthogonal Divergence cards should not be just "any differing opinion."

Criteria for inclusion:

- Has a brief reason
- Is recent
- Has few reports
- No block relationships
- No insulting or attacking language
- Shares the same POV

Conditions for exclusion:

- Offensive expressions
- Personal attacks
- Persistent spamming
- Spoiler violations
- Excessive reports
- Block/mute relationships

## Positioning of ML/API Assistance

External APIs and ML models are supplementary. It is safer to use them gradually rather than automatically deleting posts from the start.

Use cases:

- Soft flag obvious spam/attacks
- Prioritize review queues
- Exclude from Orthogonal Divergence card candidates
- Warn users before posting

Avoid:

- Banning POVs without context
- Treating dissent as attack
- Deleting posts without explanation
- Showing ML judgments as definitive in UI

## UI Language

Safe expressions:

- `There are also slightly different feelings in this perspective`
- `Read reasons`
- `Mute this POV`
- `Report this content`
- `Show spoiler`

Expressions to avoid:

- `Opposition`
- `Hostility`
- `Debunk`
- `Flame`
- `Winning opinion`
- `Losing opinion`

## Operational Notes

In the initial MVP, prioritize the following over complex automatic moderation:

1. Reporting available
2. Users can delete their own posts
3. Hide users or POVs they don't want to see
4. Hide spoilers
5. Prevent dangerous candidates from appearing in Orthogonal Divergence cards

Daimon’s value lies in safely hearing different feelings. Safety features are not just management tools added later—they are core to the product.