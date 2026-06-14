"""
Sense-Distance discovery ranking.

Turns the (previously inert) timeline knobs — ``similarity_weight``,
``boost_popular`` and ``include_far_posts`` — into a ranking that can
deliberately escape the echo chamber.

Pure similarity ranking only ever shows you what you already agree with.
Daimon instead rewards posts that are semantically *distant* from the user
yet share a common-ground POV ("different conclusion, shared value") and
then de-duplicates the feed with MMR (Maximal Marginal Relevance) so the
result stays diverse rather than ten near-identical takes.

This module is intentionally free of FastAPI / DB / Qdrant imports: it
operates on plain numpy vectors and Python sets, which makes it trivial to
unit-test and to swap the algorithm without touching the router.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Candidate:
    """A scoring candidate. ``vector`` is the raw embedding (normalized here)."""

    post_id: str
    vector: np.ndarray
    tags: set[str]
    relevance: float = 0.0          # cosine sim to the query (Qdrant hit.score)
    popularity: float = 0.0         # normalized 0..1 (likes/comments)

    # Filled in by the ranker, surfaced to the UI for explainability:
    sim_to_user: float = 0.0        # cosine sim to the user's own "sense"
    bridge_score: float = 0.0       # distant-yet-shared-value signal
    final_score: float = 0.0
    reason: str = field(default="")


def _normalize(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n else v


def rank_by_sense_distance(
    candidates: list[Candidate],
    user_centroid: np.ndarray | None,   # mean of the user's own post vectors
    user_tags: set[str],
    *,
    similarity_weight: float = 0.7,     # 1.0 = near opinions, 0.0 = far / discovery
    boost_popular: bool = False,
    include_far_posts: bool = False,    # enables the bridge term
    diversity: float = 0.3,             # MMR: 0 = pure relevance, 1 = pure variety
    top_k: int = 10,
) -> list[Candidate]:
    """Score and rerank ``candidates``; returns the top_k in display order.

    The base score blends three product signals, then MMR removes redundancy:

        base = α·near + (1-α)·bridge + 0.15·common_ground [+ 0.20·popularity]

    where ``near`` is closeness to the user's sense, ``bridge`` is "far but we
    share a value", and α is ``similarity_weight``. A bridge only counts when
    ``include_far_posts`` is on, otherwise "far" would just be noise.
    """
    if not candidates:
        return []

    alpha = float(np.clip(similarity_weight, 0.0, 1.0))
    uc = _normalize(np.asarray(user_centroid, dtype=np.float64)) if user_centroid is not None else None

    # --- 1. per-candidate base score ---------------------------------------
    for c in candidates:
        c.vector = _normalize(np.asarray(c.vector, dtype=np.float64))

        # closeness to the user's own centroid; fall back to query relevance
        sim = float(np.dot(uc, c.vector)) if uc is not None else c.relevance
        c.sim_to_user = max(0.0, sim)

        near = c.sim_to_user
        far = 1.0 - c.sim_to_user

        shared = c.tags & user_tags
        common_ground = 1.0 if shared else 0.0

        # A bridge is valuable only if it is BOTH distant AND shares a value.
        c.bridge_score = far * common_ground if include_far_posts else 0.0

        base = alpha * near + (1.0 - alpha) * c.bridge_score
        base += 0.15 * common_ground                # always nudge shared-value posts
        if boost_popular:
            base += 0.20 * float(np.clip(c.popularity, 0.0, 1.0))

        c.final_score = base
        c.reason = _explain(c.sim_to_user, shared, include_far_posts)

    # --- 2. MMR rerank for diversity (kill near-duplicates) ----------------
    pool = sorted(candidates, key=lambda c: c.final_score, reverse=True)
    selected: list[Candidate] = []
    lam = float(np.clip(diversity, 0.0, 1.0))
    while pool and len(selected) < top_k:
        if not selected:
            selected.append(pool.pop(0))
            continue
        best_i, best_mmr = 0, -1e9
        for i, c in enumerate(pool):
            redundancy = max(float(np.dot(c.vector, s.vector)) for s in selected)
            mmr = (1.0 - lam) * c.final_score - lam * redundancy
            if mmr > best_mmr:
                best_mmr, best_i = mmr, i
        selected.append(pool.pop(best_i))

    return selected


def _explain(sim_to_user: float, shared: set[str], far_on: bool) -> str:
    """Human-readable reason a post surfaced (shown in the UI)."""
    if shared and far_on and sim_to_user < 0.45:
        return f"遠い視点・共通の価値観: {', '.join(list(shared)[:2])}"
    if shared:
        return f"共通の価値観: {', '.join(list(shared)[:2])}"
    if sim_to_user >= 0.6:
        return "あなたの感性に近い"
    return "新しい視点"
