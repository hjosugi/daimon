<!-- i18n: language-switcher -->
[English](THEORY_TO_FEATURES.en.md) | [日本語](THEORY_TO_FEATURES.md)

# From Theory to Features

This document is intended to systematically derive Daimon's features starting from underlying theories.

Academic papers and theories are not directly exposed on the product interface. The theories are kept in the background, while the surface that users interact with is simplified.

```text
Theory
  ↓
Hypotheses about humans
  ↓
Daimon's features
  ↓
Form presented in UI
  ↓
Elements not shown in UI
```

## 1. Tesler's Law

### Theory

Systems inherently contain unavoidable complexity. The design decision is whether to burden the user with that complexity or to hide it within the system.

### Interpretation in Daimon

Daimon has a complex foundation of POV, vector, ranking, bridging, graph, moderation. However, exposing too much of this complexity to users makes it unusable.

### Features

- 3-choice POV reactions
- Coaxial dissent cards
- Match reason
- Hidden ranking
- Hidden graph read model
- Hidden safety filtering

### Shown in UI

```text
From this perspective?

I see
I'm curious
Maybe not
```

### Not shown in UI

- Complex scoring formulas
- Vector distance
- Matrix factorization
- Dual systems of A/B/C and stance
- Global statistics dashboard

## 2. Perspective-getting

### Theory

Other people's perspectives are more accurately understood by asking them directly rather than imagining. Daimon avoids guessing others' minds; instead, it presents their brief reasons.

### Interpretation in Daimon

Conflicts on SNS often intensify because users guess and misunderstand others. Daimon asks "Why did you feel that way from this perspective?" in its UI.

### Features

- POV comments
- Brief reasons for POV reactions
- Coaxial dissent cards
- `Read reasons`
- `Open this perspective`

### Shown in UI

```text
A slightly different feeling from the same perspective

Reason: The mid-section actually resonated as an echo.
```

### Not shown in UI

- `Opposing side`
- `Debunk`
- `Contradiction with you`
- Labels about personality

## 3. Opinion Space

### Theory

Opinions are not just one-dimensional agree/disagree but can be represented as multi-dimensional space. Systems like Pol.is create an opinion space from many reactions, visualizing proximity, divergence, and splits.

### Interpretation in Daimon

Daimon’s `sense` is not only based on embedding the post text. The choice of POV and how users react within that POV also form coordinates in the opinion space.

### Features

- POV reactions
- User sense centroid
- Activity per POV
- Same-axis disagreement
- Sense-distance ranking

### Shown in UI

- `Close to your sensibility`
- `Distant viewpoints / shared values`
- `Different feelings from the same perspective`

### Not shown in UI

- PCA plots themselves
- Clustering labels
- Divisive charts

## 4. Bridging-Based Ranking

### Theory

Instead of ranking by majority vote, promote content that reaches even those with different stances. Bridging ranking, like Community Notes / Birdwatch, aligns with this idea.

### Interpretation in Daimon

Daimon does not only surface "close" content. It also shows posts that are distant but share a common POV, or those with the same POV but different feelings.

### Features

- `Disagreement but same axis bonus`
- `Bridge zone`
- Coaxial dissent cards
- POV activity timeline
- Safety-aware candidate selection

### Shown in UI

```text
Distant viewpoints / shared values
```

```text
Same perspective, slightly different feelings
```

### Not shown in UI

- Most conflicting opponents
- Ongoing flame wars
- Number of rebuttals
- Victory/defeat metrics

## 5. Habermas Machine / Common Ground

### Theory

Instead of merely showing conflicts, find and present overlaps between differing opinions. The goal is not persuasion but discovering common ground.

### Interpretation in Daimon

Coaxial dissent cards are weak if they only present opposing views. Ending with "where they agree" transforms conflict into understanding.

### Features

- Closure beat
- `Differences`
- `Where they agree`
- Deep dive links to POV pages

### Shown in UI

```text
Differences
You: The mid-section feels heavy
Opponent: The mid-section resonates as an echo

Where they agree
Both see tempo as core to the experience
```

### Not shown in UI

- `Which is correct?`
- `Majority here`
- `Minority here`

## 6. Information Foraging

### Theory

People explore information like food, guided by clues, expected value, and movement costs. Good exploration UI provides "scent" that motivates the next step.

### Interpretation in Daimon

Graph exploration does not mean showing a huge node network. It’s important that users feel reasons to move from one perspective to another.

### Features

- Exploration tab
- Sense-distance map
- Local graph read model
- Related POVs
- Adjacent POVs
- Bridge zone
- Scent labels

### Shown in UI

```text
Close to this POV
Recent comments increasing
From your saved perspectives
Different feelings on the same perspective
```

### Not shown in UI

- Entire network graph
- Force-directed graph as main
- Centrality rankings
- Large, incomprehensible lines

## 7. Information As Reward

### Theory

People desire information about future rewards or uncertainty reduction as an intrinsic reward. Daimon treats information seeking itself as a reward.

### Interpretation in Daimon

Instead of endless scrolling with "next post," it provides a sense of completion like "I understand a bit more about this perspective."

### Features

- Exploration view
- Coaxial dissent cards
- Closure beat
- `Expand a little more`
- `Save this perspective`

### Shown in UI

- The feeling of discovering a new perspective
- The sense of understanding different reasons
- The realization of overlaps

### Not shown in UI

- Infinite scroll stretching
- Excessive notifications
- FOMO triggers
- Streaks

## 8. Self-Disclosure Reward

### Theory

Sharing one's thoughts and feelings with others is inherently rewarding.

### Interpretation in Daimon

Before writing long posts, it’s helpful to have a quick way to state one’s position. Users can react to POVs or leave brief responses without posting full texts.

### Features

- 3-choice POV reactions
- Optional brief reasons
- Profile bio
- Recent POVs
- Sense derived from saved responses

### Shown in UI

```text
Add a brief comment
```

```text
You have recently opened this perspective often
```

### Not shown in UI

- Forcing long posts
- Requiring public reactions
- Scores that compete for self-disclosure

## 9. Optimal Distinctiveness

### Theory

Humans have both a desire to belong (similarity) and to be unique (difference).

### Interpretation in Daimon

"Seeing the same POV" fosters a sense of belonging; "feeling slightly different" preserves individuality. This balance creates comfortable diversity within shared perspectives.

### Features

- POV rooms
- POV follow
- Coaxial dissent cards
- `These people see the same perspective`
- `Slightly different feelings`

### Shown in UI

```text
People seeing the same perspective
```

```text
Slightly different feelings
```

### Not shown in UI

- Faction names
- Allies/enemies
- Faction victory/defeat

## 10. Folksonomy / Open Vocabulary

### Theory

Tags and classifications often evolve from user vocabulary rather than top-down assignment. However, unchecked, this can lead to duplicates, ambiguity, and spam.

### Interpretation in Daimon

POVs are open vocabulary. Frequently used POVs are supplemented with explanations, synonyms, parent/child relations, and merged_into links.

### Features

- POV suggestions
- POV definitions
- Synonyms
- Parent POVs
- Merged_into relations
- Related POV cache

### Shown in UI

- Suggestions for existing POVs
- `Similar POV exists`
- `This POV has been merged`

### Not shown in UI

- Fixed, rigid categories
- ML automatically fixing POVs

## 11. Aspect-Based Sentiment

### Theory

Evaluation can be broken down by specific aspects, not just overall like/dislike.

### Interpretation in Daimon

Relying solely on overall like is coarse. It’s necessary to save "How does this post look from this POV?" as a separate assertion.

### Features

- post_pov_assertions
- Lean
- Comment
- Spoiler
- Confidence
- Created_by

### Shown in UI

```text
From this perspective?
```

```text
Contains spoilers
```

### Not shown in UI

- Overall score of the post
- Simple star ratings

## 12. Explainable Recommendation

### Theory

Recommendations are more trusted if the reasons why are understandable.

### Interpretation in Daimon

Daimon’s ranking can be complex, but the reasons for display are kept concise.

### Features

- match_reason
- pov_matches
- sense_distance
- is_bridge
- saved signals

### Shown in UI

```text
Shared perspective: resonance, tempo
```

```text
Distant viewpoints / shared values
```

### Not shown in UI

- Raw scores
- Cosine similarity
- Excessive explanations

## Prioritization of Features

Based on the theories, the feature priorities are as follows:

### P0: 1 Gesture

Corresponding theories:

- Tesler's Law
- Self-Disclosure Reward
- Aspect-Based Sentiment

Features:

- React to POV with 3 choices.
- Optional brief reason.
- Only one UI presentation system.

### P1: Coaxial Dissent Cards

Corresponding theories:

- Perspective-getting
- Bridging-Based Ranking
- Optimal Distinctiveness

Features:

- Show one person with a different lean within the same POV.
- Read their brief reason.
- Present differences worth listening to, not just maximum conflict.

### P1: Closure Beat

Corresponding theories:

- Habermas Machine / Common Ground
- Information As Reward

Features:

- Show one line about differences.
- Show one line about similarities.
- Closure feels satisfying.

### P2: Enhance POV Page

Corresponding theories:

- Perspective-getting
- Folksonomy
- Aspect-Based Sentiment

Features:

- POV description
- Recent comments
- Related posts
- Strong users
- Similar / adjacent POVs

### P2: post_pov_assertions

Corresponding theories:

- Aspect-Based Sentiment
- Opinion Space

Features:

- Save assertions about the relationship between posts and POVs.
- Include lean, comment, spoiler, confidence.

### P3: Exploration View

Corresponding theories:

- Information Foraging
- Information As Reward
- Opinion Space

Features:

- sense-distance map
- local graph read model
- scent label
- bridge zone
- `Expand a little more`

### P3: POV Activity Timeline

Corresponding theories:

- Bridging-Based Ranking
- Weak Ties / Structural Holes
- Explainable Recommendation

Features:

- Recent discussions on this POV
- Reactions from people close to you
- Different opinions from distant people on the same POV

## Summary

All Daimon features circle back to this core sentence:

```text
Lightly encounter people who see the same thing but feel differently.
```

The theories underpin this experience in the background. The UI is designed not to explain the theories but to facilitate this light, effortless experience.

## References

- Tessler et al. (2024), "AI can help humans find common ground in democratic deliberation", Science. https://www.science.org/doi/10.1126/science.adq2852
- Wojcik et al. (2022), "Birdwatch: Crowd Wisdom and Bridging Algorithms can Inform Understanding and Reduce the Spread of Misinformation", arXiv. https://arxiv.org/abs/2210.15723
- Eyal, Steffel, and Epley (2018), "Perspective mistaking", Journal of Personality and Social Psychology. https://www.nicholasepley.com/publications
- Small et al. (2021), "Polis: Scaling Deliberation by Mapping High Dimensional Opinion Spaces", Recerca. https://philpapers.org/rec/SMAPED
- Pirolli and Card (1999), "Information Foraging", Psychological Review. https://link.springer.com/rwe/10.1007/978-0-387-39940-9_205
- Bromberg-Martin and Hikosaka (2009), "Midbrain dopamine neurons signal preference for advance information about upcoming rewards", Neuron. https://pmc.ncbi.nlm.nih.gov/articles/PMC2723053/
- Tamir and Mitchell (2012), "Disclosing information about the self is intrinsically rewarding", PNAS. https://www.pnas.org/doi/10.1073/pnas.1202129109
- Brewer (1991), "The Social Self: On Being the Same and Different at the Same Time", Personality and Social Psychology Bulletin. https://journals.sagepub.com/doi/10.1177/0146167291175001