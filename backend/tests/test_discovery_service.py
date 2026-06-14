"""
Unit tests for the Sense-Distance discovery ranker.

These are pure (no DB / Qdrant / network), so they run fast in CI and pin
down the product behaviour: similarity_weight steers near-vs-far, bridges
only count with shared values, and MMR removes near-duplicates.
"""
import numpy as np

from app.services.discovery_service import Candidate, rank_by_sense_distance


def _vec(*xs: float) -> np.ndarray:
    return np.asarray(xs, dtype=np.float64)


def test_high_similarity_weight_prefers_near_posts():
    user_centroid = _vec(1.0, 0.0)
    near = Candidate(post_id="near", vector=_vec(0.99, 0.14), tags=set())
    far = Candidate(post_id="far", vector=_vec(0.0, 1.0), tags=set())

    ranked = rank_by_sense_distance(
        [far, near], user_centroid, user_tags=set(),
        similarity_weight=1.0, top_k=2,
    )
    assert ranked[0].post_id == "near"


def test_bridge_outranks_plain_far_post_in_discovery_mode():
    # Two posts equally far from the user, but only one shares a value (POV).
    user_centroid = _vec(1.0, 0.0)
    user_tags = {"ethics"}
    bridge = Candidate(post_id="bridge", vector=_vec(0.0, 1.0), tags={"ethics"})
    noise = Candidate(post_id="noise", vector=_vec(0.0, -1.0), tags={"crypto"})

    ranked = rank_by_sense_distance(
        [noise, bridge], user_centroid, user_tags,
        similarity_weight=0.0, include_far_posts=True, top_k=2,
    )
    assert ranked[0].post_id == "bridge"
    assert ranked[0].bridge_score > 0.0
    assert ranked[0].reason.startswith("遠い視点")


def test_far_term_inert_without_include_far_posts():
    # Same setup, but discovery off -> the far bridge must NOT win on distance.
    user_centroid = _vec(1.0, 0.0)
    bridge = Candidate(post_id="bridge", vector=_vec(0.0, 1.0), tags={"ethics"})
    near = Candidate(post_id="near", vector=_vec(1.0, 0.0), tags={"ethics"})

    ranked = rank_by_sense_distance(
        [bridge, near], user_centroid, user_tags={"ethics"},
        similarity_weight=0.5, include_far_posts=False, top_k=2,
    )
    assert ranked[0].post_id == "near"
    assert all(c.bridge_score == 0.0 for c in ranked)


def test_mmr_demotes_near_duplicate():
    # Two identical relevant posts + one distinct; diversity should surface
    # the distinct one in slot 2 rather than the redundant twin.
    user_centroid = _vec(1.0, 0.0)
    a1 = Candidate(post_id="a1", vector=_vec(0.95, 0.05), tags=set(), relevance=0.95)
    a2 = Candidate(post_id="a2", vector=_vec(0.95, 0.05), tags=set(), relevance=0.95)
    b = Candidate(post_id="b", vector=_vec(0.80, 0.60), tags=set(), relevance=0.80)

    ranked = rank_by_sense_distance(
        [a1, a2, b], user_centroid, user_tags=set(),
        similarity_weight=1.0, diversity=0.7, top_k=2,
    )
    ids = [c.post_id for c in ranked]
    assert ids[0] in {"a1", "a2"}
    assert ids[1] == "b"  # the duplicate twin is demoted by MMR


def test_empty_candidates_returns_empty():
    assert rank_by_sense_distance([], None, set()) == []
