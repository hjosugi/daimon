"""
Matching service for post recommendations.

This service contains core matching logic that can be easily swapped or extended.
All matching algorithms are implemented as functions that can be replaced.
"""
from typing import List, Set, Tuple, Optional, Dict, Any
from app.models.api import MatchReason, SimilarUserPost
from app.utils.enums import MatchType
from app.database import Post as PostModel
from sqlalchemy.orm import Session
import numpy as np


def calculate_pov_similarity(tags1: Set[str], tags2: Set[str]) -> Tuple[Set[str], float]:
    """
    Calculate POV similarity considering partial matches.
    Returns (common_povs, match_rate)
    
    This is the core POV matching algorithm. Can be replaced with different implementations.
    
    Partial match logic:
    - Exact match: full score (1.0)
    - Partial match (one POV contains another): partial score (0.5)
    - Keyword overlap: minimal score (0.1 per overlapping keyword)
    
    Args:
        tags1: First set of POVs
        tags2: Second set of POVs
    
    Returns:
        Tuple of (common_povs set, match_rate float)
    """
    if not tags1 or not tags2:
        return set(), 0.0
    
    import re
    
    common_povs = set()
    partial_matches = 0
    keyword_overlaps = 0
    
    tags1_normalized = {tag.lower(): tag for tag in tags1}
    tags2_normalized = {tag.lower(): tag for tag in tags2}
    
    exact_matches = set(tags1_normalized.keys()) & set(tags2_normalized.keys())
    common_povs.update(tags1_normalized[tag] for tag in exact_matches)
    
    for tag1_norm, tag1_orig in tags1_normalized.items():
        if tag1_norm in exact_matches:
            continue
        for tag2_norm, tag2_orig in tags2_normalized.items():
            if tag2_norm in exact_matches:
                continue
            if len(tag1_norm) >= 3 and len(tag2_norm) >= 3:
                if tag1_norm in tag2_norm or tag2_norm in tag1_norm:
                    partial_matches += 1
                    if len(tag1_norm) <= len(tag2_norm):
                        common_povs.add(tag1_orig)
                    else:
                        common_povs.add(tag2_orig)
                    break
    
    def extract_keywords(tag: str) -> Set[str]:
        words = re.split(r'[\s\-_・、。]+', tag.lower())
        stop_words = {'の', 'が', 'を', 'に', 'は', 'で', 'と', 'も', 'か', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'}
        return {w for w in words if len(w) >= 2 and w not in stop_words}
    
    all_keywords1 = set()
    all_keywords2 = set()
    for tag in tags1:
        all_keywords1.update(extract_keywords(tag))
    for tag in tags2:
        all_keywords2.update(extract_keywords(tag))
    
    keyword_overlaps = len(all_keywords1 & all_keywords2)
    
    exact_score = len(exact_matches)
    partial_score = partial_matches * 0.5
    keyword_score = min(keyword_overlaps * 0.1, 0.3)
    
    total_score = exact_score + partial_score + keyword_score
    total_unique_povs = len(tags1 | tags2)
    
    if total_unique_povs > 0:
        match_rate = min(total_score / total_unique_povs, 1.0)
    else:
        match_rate = 0.0
    
    if exact_score == 0 and partial_score == 0 and keyword_overlaps > 0:
        match_rate = max(match_rate, 0.1)
    
    return common_povs, match_rate


def find_similar_user_posts(
    post_tags: Set[str],
    user_post_ids: List[str],
    db: Session,
    limit: int = 3,
    max_check: int = 20
) -> List[SimilarUserPost]:
    """
    Find user posts that contributed to POV match.
    
    This function can be replaced with different similarity search algorithms.
    
    Args:
        post_tags: POVs of the matched post
        user_post_ids: List of user's post IDs to check
        db: Database session
        limit: Maximum number of similar posts to return
        max_check: Maximum number of user posts to check
    
    Returns:
        List of SimilarUserPost (max limit)
    """
    similar_user_posts = []
    
    if not user_post_ids or not post_tags:
        return similar_user_posts
    
    for up_id in user_post_ids[:max_check]:
        up_db_post = db.query(PostModel).filter(PostModel.id == up_id).first()
        if up_db_post:
            up_tags = set(up_db_post.tags or [])
            shared_povs, shared_rate = calculate_pov_similarity(post_tags, up_tags)
            if shared_povs or shared_rate > 0:
                up_text = up_db_post.text
                preview_text = up_text[:100] + "..." if len(up_text) > 100 else up_text
                similar_user_posts.append(SimilarUserPost(
                    id=up_id,
                    text=preview_text,
                    similarity_score=None
                ))
                if len(similar_user_posts) >= limit:
                    break
    
    return similar_user_posts


def calculate_pov_match_rate(
    user_post_tags: Set[str],
    post_tags: Set[str]
) -> Tuple[Set[str], float]:
    """
    Calculate POV match rate between user's posts and a post.
    
    This is a wrapper around calculate_pov_similarity with proper handling of edge cases.
    Can be replaced with different match rate calculation algorithms.
    
    Args:
        user_post_tags: Set of POVs from user's posts
        post_tags: Set of POVs from the post
    
    Returns:
        Tuple of (common_povs set, match_rate float)
    """
    common_povs = set()
    pov_match_rate = 0.0
    
    if user_post_tags and post_tags:
        common_povs, pov_match_rate = calculate_pov_similarity(user_post_tags, post_tags)
    elif post_tags and not user_post_tags:
        pov_match_rate = 0.0
    elif user_post_tags and not post_tags:
        pov_match_rate = 0.0
    
    return common_povs, pov_match_rate


def determine_match_type(
    common_povs: Set[str],
    pov_match_rate: float,
    has_query: bool = False
) -> MatchType:
    """
    Determine the match type based on POV matching and query presence.
    
    This function can be replaced with different match type determination logic.
    
    Args:
        common_povs: Common POVs between user and post
        pov_match_rate: POV match rate (0.0 to 1.0)
        has_query: Whether a query text was provided
    
    Returns:
        MatchType enum value
    """
    if (common_povs or pov_match_rate > 0) and has_query:
        return MatchType.BOTH
    return MatchType.TAG


def calculate_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
    
    Returns:
        Cosine similarity score (0.0 to 1.0)
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    
    try:
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        similarity = dot_product / (norm1 * norm2)
        return max(0.0, min(1.0, similarity))
    except Exception:
        return 0.0


def find_similar_user_posts_by_vector(
    post_vector: List[float],
    user_post_vectors: List[Tuple[str, List[float]]],
    db: Session,
    limit: int = 3
) -> List[SimilarUserPost]:
    """
    Find user posts that are similar to the current post based on vector similarity.
    
    Args:
        post_vector: Vector of the current post
        user_post_vectors: List of (post_id, vector) tuples for user's posts
        db: Database session
        limit: Maximum number of similar posts to return
    
    Returns:
        List of SimilarUserPost (max limit)
    """
    similar_user_posts = []
    
    if not post_vector or not user_post_vectors:
        return similar_user_posts
    
    similarities = []
    for up_id, up_vector in user_post_vectors:
        similarity = calculate_cosine_similarity(post_vector, up_vector)
        if similarity > 0.5:
            similarities.append((up_id, similarity))
    
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    for up_id, similarity in similarities[:limit]:
        up_db_post = db.query(PostModel).filter(PostModel.id == up_id).first()
        if up_db_post:
            up_text = up_db_post.text
            preview_text = up_text[:100] + "..." if len(up_text) > 100 else up_text
            similar_user_posts.append(SimilarUserPost(
                id=up_id,
                text=preview_text,
                similarity_score=similarity
            ))
    
    return similar_user_posts


def build_match_reason(
    post_tags: Set[str],
    user_post_tags: Set[str],
    user_post_ids: List[str],
    db: Session,
    query_tags: Optional[List[str]] = None,
    has_query: bool = False,
    post_vector: Optional[List[float]] = None,
    user_post_vectors: Optional[List[Tuple[str, List[float]]]] = None
) -> Optional[MatchReason]:
    """
    Build MatchReason for a post.
    
    This is the main function for calculating match reasons. Can be replaced entirely
    with different matching algorithms.
    
    Now uses vector similarity (content-based) instead of POV matching.
    
    Args:
        post_tags: POVs of the post
        user_post_tags: POVs from user's posts
        user_post_ids: List of user's post IDs
        db: Database session
        query_tags: Optional tags from search query
        has_query: Whether a query text was provided
        post_vector: Vector embedding of the post text
        user_post_vectors: List of (post_id, vector) tuples for user's posts
    
    Returns:
        MatchReason or None if no match
    """
    content_match_rate = 0.0
    similar_user_posts = []
    
    if post_vector and user_post_vectors:
        max_similarity = 0.0
        for up_id, up_vector in user_post_vectors:
            similarity = calculate_cosine_similarity(post_vector, up_vector)
            if similarity > max_similarity:
                max_similarity = similarity
        
        content_match_rate = max_similarity
        
        similar_user_posts = find_similar_user_posts_by_vector(
            post_vector=post_vector,
            user_post_vectors=user_post_vectors,
            db=db,
            limit=3
        )
    
    common_povs, _ = calculate_pov_match_rate(user_post_tags, post_tags)
    
    matched_by = MatchType.TAG
    if content_match_rate > 0:
        matched_by = MatchType.BOTH
    
    pov_matches = list(common_povs)
    if query_tags:
        query_tag_set = set(query_tags)
        matched_query_povs = post_tags & query_tag_set
        pov_matches = list(common_povs | matched_query_povs)
    
    return MatchReason(
        pov_matches=pov_matches,
        common_povs=list(common_povs),
        pov_match_rate=content_match_rate,
        matched_by=matched_by,
        similar_to_user_posts=similar_user_posts[:3]
    )


def rank_posts(
    posts: List[Any],
    sort_by: str = "created_at",
    reverse: bool = True
) -> List[Any]:
    """
    Rank and sort posts.
    
    This function can be replaced with different ranking algorithms.
    Works with both PostResponse objects and dictionaries.
    
    Args:
        posts: List of post objects (PostResponse) or dictionaries
        sort_by: Field to sort by ("created_at", "score", "pov_match_rate", "combined")
        reverse: Whether to sort in reverse order
    
    Returns:
        Sorted list of posts (same type as input)
    """
    def get_value(post: Any, key: str) -> Any:
        """Get value from post (dict or object)"""
        if isinstance(post, dict):
            return post.get(key)
        else:
            return getattr(post, key, None)
    
    def get_match_rate(post: Any) -> float:
        """Get POV match rate from post"""
        match_reason = get_value(post, "match_reason")
        if isinstance(match_reason, dict):
            return match_reason.get("pov_match_rate") or 0.0
        elif match_reason:
            return getattr(match_reason, "pov_match_rate", 0.0) or 0.0
        return 0.0
    
    if sort_by == "created_at":
        return sorted(
            posts,
            key=lambda x: get_value(x, "created_at") or "1970-01-01T00:00:00",
            reverse=reverse
        )
    elif sort_by == "score":
        return sorted(
            posts,
            key=lambda x: get_value(x, "score") if get_value(x, "score") is not None else 0.0,
            reverse=reverse
        )
    elif sort_by == "pov_match_rate":
        return sorted(
            posts,
            key=lambda x: (
                get_match_rate(x),
                get_value(x, "created_at") or "1970-01-01T00:00:00"
            ),
            reverse=reverse
        )
    elif sort_by == "combined":
        return sorted(
            posts,
            key=lambda x: (
                get_value(x, "created_at") or "1970-01-01T00:00:00",
                get_value(x, "score") if get_value(x, "score") is not None else 0.0
            ),
            reverse=reverse
        )
    return posts
