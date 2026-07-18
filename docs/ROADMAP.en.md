<!-- i18n: language-switcher -->
[English](ROADMAP.en.md) | [日本語](ROADMAP.md)

# Roadmap

Daimon’s priority is not to "show deep theories as they are," but rather to enable "deep connections through simple interactions."

In this roadmap, we differentiate between what is currently necessary, what will be needed next, and what should be avoided for now.

## Current Status

Things that are done:

- Posting creation
- Assigning POV
- Automatic POV suggestions
- POV search
- POV pages
- POV comments
- Follow / unfollow
- Removing followers
- Basic profile
- Saving posts
- Current API via Go API
- PostgreSQL main database
- Qdrant vector search
- Japanese embeddings via ML service
- Sense-Distance ranking
- Arbitrary read-model cache with Redis
- SQL externalization

Weak points:

- POVs are still close to tags.
- "How does this look from this POV?" for posts is not stored.
- POVs lack explanations, synonyms, parent-child relationships.
- POV pages are still weak as "rooms."
- POV activity is not sufficiently mixed into the timeline.
- No graph exploration.
- Coaxial disagreement is not an explicit experience.

## Phase 1: Make POV pages the core of Daimon

Goal:

Transform POV pages from tag search results into rooms based on perspectives.

Tasks:

- Display explanation fields for POVs.
- Highlight related posts.
- Show recent POV comments.
- Show popular/high-quality POV comments.
- Display users who frequently speak from that POV.
- Show one coaxial disagreement card.

Not yet to do:

- Large-scale statistics.
- Constant display of A/B/C distributions.
- Global rankings.

## Phase 2: post_pov_assertions

Goal:

Shift from `povs: string[]` to "assertions about posts from this perspective."

Minimal schema proposal:

```text
post_pov_assertions
  id
  post_id
  pov_text or pov_id
  lean
  comment
  spoiler
  confidence
  created_by
  created_at
```

The initial `lean` will be simple:

```text
I see
I'm curious
Maybe not
```

Internally, it can be represented as support / question / oppose, but the UI will not display multiple systems.

## Phase 3: Coaxial disagreement cards

Goal:

Convey Daimon’s essence with a single card.

Candidate conditions:

- Responding to the same POV.
- Different lean.
- Short reasoning provided.
- Recent activity.
- No risk of blocking/muting/reporting.
- Can read the other person's post or POV comment.

Tone of the card:

```text
A slightly different feeling from the same perspective
```

Avoid phrases like:

- `Opposition`
- `Debunk`
- `Conflict with you`
- `On fire (controversy)`

The purpose is not to win the debate but to create an entry point for hearing reasons.

## Phase 4: POV definitions

Goal:

Maintain an open vocabulary while making commonly used POVs understandable.

Schema proposal:

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
  created_by
  updated_at
```

Necessary features:

- Suggest existing POVs
- Merge synonyms
- Transfer from merged POVs to canonical POV
- Display similar/adjacent/opposite POVs
- Edit history of POV explanations

## Phase 5: Exploration view

Goal:

Enable exploration of POVs as a map.

Initially, we will not create a force-directed large node graph. Internally, data will be graph-based, but the UI will be an exploration space where you can walk through sense-distance.

Initial scope:

- "Exploration" tab within the POV page.
- Local map centered on the current POV.
- Up to 1-2 hops.
- Starting with about 30 nodes, max around 80.
- Begin with `POV / Post / User` nodes.
- Read `near / bridge / far`.
- Provide hints of information that make you want to explore further.

Later additions:

- Assertion nodes
- Comment nodes
- Similar/adjacent/opposite edges
- Same-axis disagreement edges
- Personal maps expanding from saved items

Not yet to do:

- Entire network diagram.
- 3D graphs.
- Making force-directed diagrams the main product feature.
- Centrality rankings.
- Complex statistical dashboards.

## Phase 6: Closure interaction

Goal:

Make coaxial disagreements a "slightly understood" rather than a conflict, closed experience.

Minimal flow:

1. React to a POV with one of three options.
2. Optionally write a brief reason.
3. Find one person with a different lean on the same POV.
4. Read their brief reason.
5. Receive one line each of `what was different` and `what was the same`.

This is a closure reward, not a numerical one. Since it has an endpoint, it offers a different experience from infinite scrolling or notification dependence.

## Phase 7: POV activity timeline

Goal:

Not just show recent posts.

Activities to mix in:

- Recent debates happening around this POV.
- People close to you reacting to this POV.
- Distant people expressing different opinions on the same POV.
- Related POVs moving from saved posts.
- Not just people you follow, but perspectives you follow moving.

Display prioritizes context over numbers.

```text
"Recently, the feeling of 'resonance' has increased with more diverse perspectives."
```

## Phase 8: Ranking refinement

Current ranking:

```text
semantic similarity
+ shared POV
+ bridge score
+ popularity / recency
+ save signal
```

Next ranking:

```text
semantic_similarity
+ shared_pov_weight
+ pov_activity_recency
+ pov_comment_quality
+ user_affinity_by_pov
+ disagreement_but_same_axis_bonus
+ save_quality_signal
+ safety_penalty
```

Important: do not only elevate similar items. Daimon is an app designed to surface posts with distant but shared perspectives.

## Phase 9: Moderation and trust

Since POV spaces handle deep discussions, safety design is more critical than in regular comment sections.

Necessary features:

- Reporting
- Blocking / muting
- Spoiler controls
- Deletion of POV comments
- Rate limiting for volatile POVs
- Excluding dangerous users from coaxial disagreement cards
- Internal use of quality signals instead of public rankings

## Things to avoid creating now

Currently, we will avoid:

- Fine-grained statistics pages.
- Overall user scores.
- Display of POV wins/losses.
- UI that inflates follower counts.
- Disagreement notifications.
- Continuous login rewards.
- Displaying huge graphs on the initial screen.
- Reward loops designed to be unfulfilling.
- ML making arbitrary judgments on people's sensibilities.

## MVP Ideal State

A strong MVP state includes:

1. Posting.
2. Attaching a POV.
3. Being able to place `I see / Curious / Maybe not` on that POV.
4. Optional brief reasoning.
5. Reading related posts and POV comments on the POV page.
6. Encountering someone with a different feeling on the same POV via a single card.
7. Saving reflects your sense.
8. Light exploration from perspective to perspective in the exploration view.

If these are achieved, Daimon ceases to be just a posting SNS.