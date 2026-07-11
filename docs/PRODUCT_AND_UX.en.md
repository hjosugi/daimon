<!-- i18n: language-switcher -->
[English](PRODUCT_AND_UX.en.md) | [日本語](PRODUCT_AND_UX.md)

# Product And UX

Daimon is not a "posting social network," but a place to encounter others' sensibilities through perspectives (POV).

This is the core of the product.

> Meeting briefly with someone who sees the same thing but feels differently.

Existing SNSs build networks mainly around similar people, followers, and posts with many reactions. Daimon, however, not only does that but also connects "people who see the same perspective but feel differently."

This is not a debate arena. It’s a small entry point for listening to the other person's reasons, not about winning or losing.

## Surface and Substrate

Daimon lightly handles the surface and deeply handles the underground.

### Surface

The surface that users interact with should require as few actions as possible.

```text
Looking from this perspective?

I see
Interesting
Maybe different

Optional brief reason
```

Labels can be adjusted later, but the entry point will be limited to a single three-choice system. Showing all options like `grade A/B/C`, `stance support/question/oppose/note`, `confidence`, etc., makes the theory deep but the operation cumbersome.

### Substrate

The underground handles many processes:

- Embedding the post content.
- Creating sense centroids from user posts and saves.
- Treating user-chosen POVs as strong signals.
- Accumulating POV comments by perspective.
- Finding people with different leanings on the same POV.
- Mixing distant posts that share a common POV, not just nearby posts.
- Modeling the similarity, adjacency, and tension relationships between POVs in a read model.

This complexity is managed by the system, not burdening the user.

## POV Comments

Normal comments:

```text
Talking about this post.
```

POV comments:

```text
Discussing how it looks from this perspective.
```

This distinction is central to Daimon. Post comments are confined to the post. POV comments are accumulated across perspectives, regardless of posts.

For example, a comment on the POV "Good tempo" applies not only to a specific post but becomes part of the discussion on "how do you feel about tempo as a perspective."

## New Network For Humans

Daimon’s network is not just a follow graph.

Existing SNS:

```text
Similar people
People you know
Popular people
```

Daimon:

```text
People who see the same perspective
People who see the same perspective but feel differently
People slightly distant from your sensibility but sharing a common axis
```

User followings remain. However, the backbone of the app is not just following people.

- People provide trust and continuity cues.
- POVs serve as maps for exploration and understanding.
- Posts are fragments reflecting a person’s sensibility.

## Same-Axis Divergent View Cards

The first hero experience should be a single card, not a huge graph.

```text
Slightly different feeling from the same perspective

@someone responds with "Good tempo," but reacts differently from you.
Reason: Because of a pause in the middle, which rather leaves an afterglow.

Read the reason
Open this perspective
```

The key is not to show the maximum conflict. Instead of provoking anger, it presents "someone on the same axis worth listening to."

Selection criteria:

```text
same_pov
+ different_lean
+ short_reason_exists
+ recent_activity
+ quality_signal
+ not_blocked_or_muted
- hostility_risk
```

In the MVP, it doesn’t need full ML; just existing POVs, POV comments, saves, likes, and created_at are enough for testing.

## Exploration View

Graph exploration is interesting, but showing all relationships from the start creates a heavy load. Daimon needs not an analysis tool but a map of sensibilities.

Internal data can be a graph, but the UI will be an exploration space where you can walk through `sense-distance`, not a huge force-directed graph.

```text
Close: Easy to empathize, comfortable
Slightly distant: New but understandable
Far but on the same axis: Bridge zone, divergent views
```

The thrill of exploration lies in following the scent of information to "discover" new insights. Daimon rewards the feeling of moving from perspective to perspective, not by numbers or notifications.

### Purpose

- Move from one POV to related posts.
- Move toward users strongly aligned with that POV.
- Explore similar POVs, adjacent POVs, or opposing/tensioned POVs.
- Find people who see the same perspective but feel differently.
- Feel how your interests have expanded.

### Not an Entrance but a Second Mode

The initial entry is a single gesture:

```text
React to a POV
↓
A single divergent view card appears
```

The exploration view is a subsequent second mode:

```text
Today I want to wander a bit
I want to see around this perspective
I want to see people who are distant but on the same axis
```

A blank exploration space is tough, so it will be accessible only after some density is built.

### MVP Form

Initially, add a `Explore` tab to the POV page.

```text
Center: Current POV
1 hop: Related posts, recent commenters, similar POVs
2 hops: Different POVs attached to those posts, same-axis divergent view cards
```

Limits:

- About 30 nodes initially displayed.
- Up to around 80 nodes max.
- Up to 2 hops.
- 2D, not 3D.
- Not a global map but a local map centered on the current position.
- Prioritize sense maps that show proximity/distance rather than spring layout.

### Nodes

| Node | Meaning | Display |
| --- | --- | --- |
| POV | Perspective | Short tip, center node |
| Post | Post | Small fragment of content |
| User | Person | Avatar/username |
| Assertion | Claim seen from this POV | 3-choice lean badge |
| Comment | POV comment | Small dot, expanded only when needed |

In MVP, start with only `POV / Post / User`. `Assertion` will be added after `post_pov_assertions` is available.

### Edges

| Edge | Meaning |
| --- | --- |
| `post_has_pov` | Post has a POV |
| `user_posted` | User posted |
| `user_commented_on_pov` | User commented on POV |
| `user_saved_post` | User saved |
| `pov_similar_to_pov` | Semantically similar POV |
| `pov_adjacent_to_pov` | Frequently co-occurring POV |
| `same_axis_disagreement` | Different reactions on the same POV |

Edge explanations will be briefly shown on hover or in a side panel. Showing all at once would be overwhelming.

### UI

The exploration view should not overshadow the main content.

- Embed as a tab on the POV page.
- Clicking nodes opens a detail panel on the right/bottom.
- Keep the center POV fixed; only move surrounding nodes.
- Make expanding nodes an explicit "expand a bit more."
- Show short loading until layout stabilizes.
- On mobile, avoid forcing a graph; switch to horizontal scroll or card list.
- Make `near / bridge / far` zones intuitive.
- Prioritize the `scent` that makes users want to proceed rather than many lines.

### Scent

The key in exploration is not the exactness of lines but the "reason to open next." This is expressed as the scent of information.

Examples:

```text
Close to this POV
Recently more comments
Close from your saves
Different feeling on the same perspective
Often appears together with this post
```

Users don’t want to decode an abstract graph; they want to know where to go next that looks interesting.

## Human Instinctive Rewards and UI

The reward UI here is not designed to create dependency. Daimon should use intrinsic rewards.

### Two Types of Rewards

Some reward UI elements should be used, others avoided.

Use:

- Seeking
- Foraging
- Self-disclosure
- Discovery
- Closure
- Reciprocity

Avoid:

- Variable-ratio rewards
- Infinite scroll
- Streak obligations
- FOMO from notifications
- Status via numbers
- Amplification of anger

The boundary is simple:

```text
Rewards that satisfy finding, connecting, understanding are used.
Rewards designed to leave you unsatisfied are avoided.
```

### Rewards to Use

#### 1. Exploration Rewards

People enjoy the act of "finding what’s next."

Daimon uses exploration from perspective to perspective, not infinite scroll.

UI:

- `Next perspective to open`
- `Close to this perspective`
- `Slightly tense with this perspective`
- `Different feeling on the same perspective`

#### 2. Self-Disclosure Rewards

Expressing your feeling briefly is itself rewarding.

UI:

- 3-choice + optional brief comment.
- Can set your stance before writing a long text.
- Possibly enable reciprocity: only those who write a brief comment can see others’ comments.

#### 3. Discovery Rewards

Realizing "someone else sees differently but I might understand" is powerful.

UI:

- Divergent view cards.
- Say "Different from you" or "Slightly different on the same perspective."
- Reveal the other’s reason first, avoid personal judgments.

#### 4. Collection Rewards

Saving/clipping is not just for later reading but for building your sensibility map.

UI:

- Save posts.
- From saved posts, create `your recent perspectives`.
- Do not compete on save counts; foster a sense of your map growing.

#### 5. Belonging Rewards

People want to feel they belong. Daimon avoids factionalization.

UI:

- `People who see the same perspective`
- `Recently discussed in this room`
- `People distant from you but reacting to this perspective`

Focus on "people who see the same question," not "enemies or allies."

#### 6. Growth Rewards

Show how your sensibility broadens, not just streaks or rankings.

UI:

- `Recently opened perspectives`
- `Perspectives expanded from your saves`
- `Perspectives you didn’t see before`
- `More reasons to listen on the same perspective`

#### 7. Closure Rewards

The strongest reward in Daimon is the moment of slight understanding at the end.

```text
You react
↓
Someone with a different feeling on the same POV appears
↓
Read their brief reason
↓
A one-line reply that shows the overlap
```

Example:

```text
It was a different feeling.
But both see that "resonance influences the experience."
```

This is a reward deeper than likes. It’s about finding overlaps, not winning or losing. Because it concludes, it doesn’t drag infinitely.

### Rewards Not Used

Daimon avoids:

- Making follower count a status symbol.
- Ranking users.
- Notifications that provoke arguments or anger.
- Creating obligation via streaks.
- Publishing centrality to rank users.
- Turning POVs into competitive stats.
- Showing "You are wrong" messages.

## Closure Beat

Divergent view cards are not just shown and finished; they are designed to give a brief sense of completion.

Minimal flow:

1. User reacts to a POV with a 3-choice.
2. Optional brief reason.
3. System presents one person with a different lean on the same POV.
4. User reads their reason.
5. System briefly shows `what was different` and `what was the same`.

UI example:

```text
What was different
You: The middle part feels a bit heavy
Other: That part leaves an afterglow

What was the same
Both see that tempo is core to the experience
```

Even after this, users can feel satisfied and leave. Only those wanting further discussion proceed to the POV page.

This design makes Daimon less like a "react more" SNS and more like a "small understanding, then close" SNS.

## Strengthening the POV Page

The POV page is Daimon’s most important page.

Necessary elements:

- Explanation of the POV
- Related posts
- Recent POV comments
- Popular POV comments
- Users strongly aligned with this POV
- Similar POVs
- Opposing/adjacent POVs
- Divergent view cards
- Exploration tab

But do not show everything at once initially.

Initial display:

```text
POV title
Brief explanation
React with 3-choice
One divergent view card
Recent comments
Related posts
```

Deepening:

```text
Exploration tab
Related POVs
Strong users
Past discussions
```

## Ranking Approach

The final rank cannot rely solely on semantic similarity.

```text
score =
  semantic_similarity
  + shared_pov_weight
  + pov_activity_recency
  + pov_comment_quality
  + user_affinity_by_pov
  + disagreement_but_same_axis_bonus
  + save_quality_signal
```

Particularly important is `disagreement_but_same_axis_bonus`.

In typical SNS, differing opinions often lead to conflict. Daimon creates a context where "seeing the same perspective" is established first, turning differences into curiosity.

## Frontend Performance Policy

Since exploration views can be heavy, performance constraints are built into the design from the start.

- The exploration API returns only necessary nodes.
- Fix the initial number of nodes displayed.
- Do not recalculate layout on every re-render.
- Memoize node/edge components.
- Debounce suggestion inputs.
- Separate content, header, and POV list in post cards to avoid unnecessary updates.
- On mobile, prefer card exploration over forcing a graph.
- Do not load heavy images or ML results initially.
- Do not turn hover info into modals unless necessary.

If the exploration view dominates, users may get lost. Daimon’s core remains perspectives and reasons, not just the graph.

## First Features to Build

1. Strengthen the initial display of the POV page.
2. Create POV reactions with 3-choice + brief reason.
3. Show one divergent view card.
4. Treat saves as sense signals.
5. Build a sense-distance exploration tab centered on POV.

This order prioritizes creating the experience of "meeting different feelings on the same perspective" quickly, rather than building a huge graph from the start.