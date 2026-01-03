from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Dict, Optional, Tuple
import re
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.api import (
    PostCreate,
    PostResponse,
    TimelineRequest,
    POVGenerationRequest,
    POVGenerationResponse,
    CommentCreate,
    CommentResponse,
    LikeResponse,
    SearchRequest,
    MatchReason,
    SimilarUserPost,
)
from app.utils.enums import MatchType, HTTPStatus
from app.utils.security import sanitize_text, validate_pov, validate_post_text
from app.services.embedding_service import embedding_service
from app.services.qdrant_service import qdrant_service, COLLECTION_NAME
from app.services.content_moderation_service import content_moderation_service
from app.database import get_db, Post as PostModel, Like as LikeModel, Comment as CommentModel, POVLike as POVLikeModel, POV as POVModel, User as UserModel
from app.logger import logger
from app.routers.auth import get_current_user, get_current_user_optional

router = APIRouter(
    prefix="/posts",
    tags=["posts"]
)

@router.post("/", response_model=PostResponse)
async def create_post(post: PostCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    sanitized_text = sanitize_text(post.text)
    is_valid, error = validate_post_text(sanitized_text)
    if not is_valid:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=error,
        )
    
    for pov in post.povs:
        is_valid, error = validate_pov(pov)
        if not is_valid:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail=error,
            )
    
    is_safe, reason, metadata = content_moderation_service.check_content(sanitized_text)
    if not is_safe:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail=f"Content moderation failed: {reason}",
        )
    
    vector = await embedding_service.embed_text_async(sanitized_text)
    
    post_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    username = user.username if user else f"User_{user_id[:8]}"
    
    db_post = PostModel(
        id=post_id,
        user_id=user_id,
        username=username,
        text=sanitized_text,
        created_at=timestamp,
        updated_at=timestamp
    )
    db.add(db_post)
    db.flush()
    
    pov_list = []
    for pov_name in post.povs:
        pov_obj = POVModel(
            post_id=post_id,
            pov=pov_name,
            is_auto=False,
            created_at=timestamp
        )
        db.add(pov_obj)
        pov_list.append(pov_name)
    
    db.commit()
    db.refresh(db_post)
    
    created_at_epoch = int(timestamp.timestamp())
    qdrant_service.upsert_post(
        vector=vector,
        post_id=post_id,
        user_id=user_id,
        tags=pov_list,
        created_at=created_at_epoch
    )
    
    return PostResponse(
        id=post_id,
        text=post.text,
        povs=pov_list,
        user_id=user_id,
        username=username,
        created_at=timestamp.isoformat()
    )

from app.services.matching_service import (
    calculate_pov_similarity,
    build_match_reason,
    rank_posts,
    find_similar_user_posts,
    calculate_pov_match_rate,
    determine_match_type
)

def detect_language(text: str) -> str:
    japanese_pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]')
    if japanese_pattern.search(text):
        return 'ja'
    return 'en'

def extract_phrases_spacy(text: str, language: str) -> List[str]:
    """
    Extract phrases (noun phrases, chunks) from text using spaCy.
    POVs are expected to be phrases or sentences up to 10 words.
    """
    try:
        import spacy
        
        model_name = 'ja_core_news_sm' if language == 'ja' else 'en_core_web_sm'
        
        try:
            nlp = spacy.load(model_name)
        except OSError:
            logger.warning(f"spaCy model '{model_name}' not found. Please install: python -m spacy download {model_name}")
            return extract_phrases_fallback(text, language)
        
        doc = nlp(text)
        phrases = []
        
        for chunk in doc.noun_chunks:
            token_count = len([t for t in chunk])
            if 1 <= token_count <= 10:
                phrase = chunk.text.strip()
                phrase = re.sub(r'^[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+|[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$', '', phrase)
                if phrase and len(phrase) >= 2 and len(phrase) <= 300:
                    phrases.append(phrase)
        
        if language == 'ja':
            noun_sequences = []
            current_sequence = []
            for token in doc:
                if token.pos_ in ['NOUN', 'PROPN']:
                    current_sequence.append(token.text)
                else:
                    if 1 <= len(current_sequence) <= 10:
                        phrase = ''.join(current_sequence)
                        if len(phrase) >= 2 and len(phrase) <= 300:
                            noun_sequences.append(phrase)
                    current_sequence = []
            if 1 <= len(current_sequence) <= 10:
                phrase = ''.join(current_sequence)
                if len(phrase) >= 2 and len(phrase) <= 300:
                    noun_sequences.append(phrase)
            phrases.extend(noun_sequences)
        
        return phrases
    except ImportError:
        logger.warning("spaCy not installed, using fallback extraction")
        return extract_phrases_fallback(text, language)

def extract_phrases_fallback(text: str, language: str) -> List[str]:
    """
    Fallback phrase extraction when spaCy is not available.
    Simple pattern-based extraction for phrases up to 10 words.
    """
    phrases = []
    
    if language == 'ja':
        japanese_chars = re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+', text)
        for char_seq in japanese_chars:
            if 2 <= len(char_seq) <= 20:
                phrases.append(char_seq)
    else:
        sentences = re.split(r'[.!?]\s+', text)
        for sentence in sentences:
            words = sentence.split()
            for i in range(len(words)):
                for j in range(i + 2, min(i + 11, len(words) + 1)):
                    phrase = ' '.join(words[i:j])
                    if not phrase.lower().startswith(('the ', 'a ', 'an ', 'and ', 'or ')):
                        phrases.append(phrase)
    
    return phrases

@router.post("/generate-povs", response_model=POVGenerationResponse)
def generate_povs(request: POVGenerationRequest, db: Session = Depends(get_db)):
    """
    Generate POV suggestions from text using spaCy for phrase extraction.
    Prioritizes existing POVs from the database.
    POVs are phrases or sentences up to 10 words.
    Supports Japanese and English.
    """
    if not request.text.strip():
        return POVGenerationResponse(povs=[])
    
    language = detect_language(request.text)
    phrases = extract_phrases_spacy(request.text, language)
    
    unique_phrases = []
    seen = set()
    for phrase in phrases:
        normalized = phrase.lower() if language == 'en' else phrase
        if normalized not in seen and len(phrase) <= 300:
            seen.add(normalized)
            unique_phrases.append(phrase)
    
    existing_povs = []
    if unique_phrases:
        pov_counts_query = db.query(POVModel.pov, func.count(POVModel.id)).group_by(POVModel.pov).all()
        pov_counts = {}
        for pov_name, count in pov_counts_query:
            normalized_pov = pov_name.lower() if language == 'en' else pov_name
            pov_counts[normalized_pov] = pov_counts.get(normalized_pov, 0) + count
        
        matched_povs = []
        new_phrases = []
        for phrase in unique_phrases:
            normalized = phrase.lower() if language == 'en' else phrase
            if normalized in pov_counts:
                matched_povs.append((phrase, pov_counts[normalized]))
            else:
                new_phrases.append(phrase)
        
        matched_povs.sort(key=lambda x: x[1], reverse=True)
        existing_povs = [pov for pov, _ in matched_povs]
    
    result = existing_povs[:5]
    remaining_slots = 5 - len(result)
    if remaining_slots > 0:
        result.extend(new_phrases[:remaining_slots])
    
    return POVGenerationResponse(povs=result[:5])

@router.get("/povs/suggest", response_model=POVGenerationResponse)
def suggest_povs(query: str = "", db: Session = Depends(get_db)):
    """
    Suggest POVs based on partial input (for autocomplete).
    Prioritizes existing POVs from the database.
    Returns popular POVs that match the query.
    Supports POVs with spaces.
    """
    query_lower = query.lower() if query else ""
    
    pov_counts_query = db.query(POVModel.pov, func.count(POVModel.id)).group_by(POVModel.pov).all()
    pov_counts = {pov: count for pov, count in pov_counts_query}
    
    sorted_povs = sorted(pov_counts.items(), key=lambda x: x[1], reverse=True)
    
    if not query:
        popular_povs = [pov for pov, _ in sorted_povs[:5]]
        if len(popular_povs) < 5:
            fallback_povs = [
                "k8s", "snowflake", "react", "python", "devops", "ai", "ml", 
                "frontend", "backend", "data engineering", "cloud computing",
                "machine learning", "web development"
            ]
            for pov in fallback_povs:
                if pov not in popular_povs:
                    popular_povs.append(pov)
                    if len(popular_povs) >= 5:
                        break
        return TagGenerationResponse(tags=popular_povs[:5])
    
    # Filter POVs that match the query (case-insensitive, supports spaces)
    matching_povs = []
    for pov, count in sorted_povs:
        pov_lower = pov.lower()
        if query_lower in pov_lower or pov_lower.startswith(query_lower):
            matching_povs.append((pov, count))
    
    def match_score(pov_tuple):
        pov, count = pov_tuple
        pov_lower = pov.lower()
        if pov_lower.startswith(query_lower):
            return (0, -count)
        else:
            return (1, -count)
    
    matching_povs.sort(key=match_score)
    
    result = [pov for pov, _ in matching_povs[:10]]
    if len(result) < 10:
        fallback_povs = [
            "kubernetes", "k8s", "docker", "devops", "aws", "gcp", "azure",
            "react", "vue", "angular", "nextjs", "svelte",
            "python", "javascript", "typescript", "go", "rust", "java",
            "snowflake", "postgresql", "mongodb", "redis",
            "ai", "ml", "machine-learning", "deep-learning", "nlp",
            "frontend", "backend", "fullstack", "webdev",
            "design", "ui", "ux", "css", "tailwind",
            "data engineering", "cloud computing", "machine learning",
            "web development", "software engineering", "data science",
            "artificial intelligence", "natural language processing",
            "user experience", "user interface", "system design",
            "distributed systems", "microservices", "api design",
        ]
        for pov in fallback_povs:
            pov_lower = pov.lower()
            if (query_lower in pov_lower or pov_lower.startswith(query_lower)) and pov not in result:
                result.append(pov)
                if len(result) >= 10:
                    break
    
    return POVGenerationResponse(povs=result[:10])

@router.post("/timeline", response_model=List[PostResponse])
async def get_timeline(request: TimelineRequest, user_id: Optional[str] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    vector = await embedding_service.embed_text_async(request.query_text)
    
    user_posts_db = db.query(PostModel).filter(PostModel.user_id == user_id).all() if user_id else []
    user_post_povs = set()
    user_post_vectors = []
    user_post_ids = []
    for user_post_db in user_posts_db:
        povs = db.query(POVModel.pov).filter(POVModel.post_id == user_post_db.id).all()
        user_post_povs.update([pov[0] for pov in povs])
        user_post_ids.append(user_post_db.id)
        user_posts_qdrant = qdrant_service.get_user_posts(user_id)
        for qp in user_posts_qdrant:
            if str(qp.id) == user_post_db.id:
                user_post_vectors.append((str(qp.id), qp.vector))
                break
    
    candidate_limit = 200 if request.include_far_posts else 100
    hits = qdrant_service.search_similar(vector, limit=candidate_limit)
    
    post_ids = [hit.id for hit in hits]
    if not post_ids:
        return []
    
    db_posts_dict = {post.id: post for post in db.query(PostModel).filter(PostModel.id.in_(post_ids)).all()}
    
    results = []
    for hit in hits:
        post_id = hit.id
        payload = hit.payload
        post_user_id = payload.get("user_id")
        is_own_post = post_user_id == user_id
        
        db_post = db_posts_dict.get(post_id)
        if not db_post:
            continue
        
        povs_query = db.query(POVModel.pov).filter(POVModel.post_id == post_id).all()
        post_povs = set([pov[0] for pov in povs_query])
        post_povs_list = [pov[0] for pov in povs_query]
        
        likes_count = db.query(LikeModel).filter(LikeModel.post_id == post_id).count()
        liked = db.query(LikeModel).filter(LikeModel.post_id == post_id, LikeModel.user_id == user_id).first() is not None if user_id else False
        comment_count = db.query(CommentModel).filter(CommentModel.post_id == post_id).count()
        
        match_reason = None
        if not is_own_post:
            post_vector = None
            try:
                retrieved = qdrant_service.client.retrieve(
                    collection_name=COLLECTION_NAME,
                    ids=[post_id],
                    with_vectors=True
                )
                if retrieved and retrieved[0].vector:
                    post_vector = retrieved[0].vector
            except Exception:
                pass
            
            match_reason = build_match_reason(
                post_tags=post_povs,
                user_post_tags=user_post_povs,
                user_post_ids=user_post_ids,
                db=db,
                has_query=bool(request.query_text),
                post_vector=post_vector,
                user_post_vectors=user_post_vectors if user_post_vectors else []
            )
        
        username = db_post.username
        if not username and post_user_id:
            user = db.query(UserModel).filter(UserModel.id == post_user_id).first()
            username = user.username if user else f"User_{post_user_id[:8]}"
        
        results.append(PostResponse(
            id=post_id,
            text=db_post.text,
            povs=post_povs_list,
            user_id=post_user_id,
            username=username,
            score=None if is_own_post else hit.score,
            likes=likes_count,
            liked=liked,
            commentCount=comment_count,
            match_reason=match_reason,
            created_at=db_post.created_at.isoformat() if db_post.created_at else None
        ))
    
    results = rank_posts(results, sort_by="combined", reverse=True)
    
    return results[:10]

@router.post("/{post_id}/like", response_model=LikeResponse)
def like_post(post_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    existing_like = db.query(LikeModel).filter(
        LikeModel.post_id == post_id,
        LikeModel.user_id == user_id
    ).first()
    
    if existing_like:
        likes_count = db.query(LikeModel).filter(LikeModel.post_id == post_id).count()
        return LikeResponse(
            liked=True,
            likes=likes_count
        )
    
    new_like = LikeModel(
        id=str(uuid.uuid4()),
        post_id=post_id,
        user_id=user_id
    )
    db.add(new_like)
    db.commit()
    
    likes_count = db.query(LikeModel).filter(LikeModel.post_id == post_id).count()
    return LikeResponse(
        liked=True,
        likes=likes_count
    )

@router.delete("/{post_id}/like", response_model=LikeResponse)
def unlike_post(post_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unlike a post"""
    like = db.query(LikeModel).filter(
        LikeModel.post_id == post_id,
        LikeModel.user_id == user_id
    ).first()
    
    if like:
        db.delete(like)
        db.commit()
    
    likes_count = db.query(LikeModel).filter(LikeModel.post_id == post_id).count()
    return LikeResponse(
        liked=False,
        likes=likes_count
    )

@router.delete("/{post_id}")
def delete_post(post_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_post = db.query(PostModel).filter(PostModel.id == post_id).first()
    if not db_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if db_post.user_id != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    db.delete(db_post)
    db.commit()
    
    try:
        from qdrant_client.models import PointIdsList
        qdrant_service.client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=PointIdsList(points=[post_id])
        )
    except Exception as e:
        logger.warning(f"Error deleting post from Qdrant: {e} - can be regenerated from PostgreSQL")
    
    return {"message": "Post deleted successfully"}

@router.get("/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(post_id: str, db: Session = Depends(get_db)):
    comments = db.query(CommentModel).filter(
        CommentModel.post_id == post_id
    ).order_by(CommentModel.created_at.asc()).all()
    
    result = []
    for comment in comments:
        username = None
        if comment.user_id:
            user = db.query(UserModel).filter(UserModel.id == comment.user_id).first()
            username = user.username if user else f"User_{comment.user_id[:8]}"
        
        result.append(CommentResponse(
            id=comment.id,
            text=comment.text,
            authorId=comment.user_id,
            username=username,
            createdAt=comment.created_at
        ))
    
    return result

@router.post("/search", response_model=List[PostResponse])
async def search_posts(request: SearchRequest, current_user_id: Optional[str] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """
    Search posts by text query and/or tags.
    
    Pattern A: Qdrantで候補を取って、Postgresで仕上げる（王道）
    1) Qdrantで候補を取得（System of Search）
    2) Postgresで詳細をJOIN（System of Record）
    3) Postgres側で最終ソート
    
    - If query is provided: uses vector similarity search
    - If tags are provided: filters by tags in PostgreSQL
    - If both: combines vector search with tag filter
    """
    results = []
    
    user_posts_db = db.query(PostModel).filter(PostModel.user_id == current_user_id).all() if current_user_id else []
    user_post_povs = set()
    user_post_vectors = []
    user_post_ids = []
    for user_post_db in user_posts_db:
        povs = db.query(POVModel.pov).filter(POVModel.post_id == user_post_db.id).all()
        user_post_povs.update([pov[0] for pov in povs])
        user_post_ids.append(user_post_db.id)
        if current_user_id:
            user_posts_qdrant = qdrant_service.get_user_posts(current_user_id)
            for qp in user_posts_qdrant:
                if str(qp.id) == user_post_db.id:
                    user_post_vectors.append((str(qp.id), qp.vector))
                    break
    
    if request.query and request.povs and len(request.povs) > 0:
        vector = await embedding_service.embed_text_async(request.query)
        candidate_limit = min(request.limit * 3, 200)
        hits = qdrant_service.search_similar(
            vector,
            limit=candidate_limit,
            required_tags=request.povs,
        )
        
        post_ids = [hit.id for hit in hits]
        if not post_ids:
            return []
        
        db_posts_dict = {post.id: post for post in db.query(PostModel).filter(PostModel.id.in_(post_ids)).all()}
        
        post_ids_list = list(db_posts_dict.keys())
        
        likes_counts = {
            row[0]: row[1]
            for row in db.query(LikeModel.post_id, func.count(LikeModel.id))
            .filter(LikeModel.post_id.in_(post_ids_list))
            .group_by(LikeModel.post_id).all()
        } if post_ids_list else {}
        
        user_liked_post_ids = [
            row[0] for row in db.query(LikeModel.post_id)
            .filter(LikeModel.post_id.in_(post_ids_list), LikeModel.user_id == current_user_id)
            .all()
        ] if current_user_id and post_ids_list else []
        user_liked_posts = set(user_liked_post_ids)
        
        comment_counts = {
            row[0]: row[1]
            for row in db.query(CommentModel.post_id, func.count(CommentModel.id))
            .filter(CommentModel.post_id.in_(post_ids_list))
            .group_by(CommentModel.post_id).all()
        } if post_ids_list else {}
        
        for hit in hits:
            post_id = hit.id
            payload = hit.payload
            post_user_id = payload.get("user_id")
            is_own_post = post_user_id == current_user_id
            
            db_post = db_posts_dict.get(post_id)
            if not db_post:
                continue
            
            povs_query = db.query(POVModel.pov).filter(POVModel.post_id == post_id).all()
            post_povs = set([pov[0] for pov in povs_query])
            post_povs_list = [pov[0] for pov in povs_query]
            
            likes_count = likes_counts.get(post_id, 0)
            liked = post_id in user_liked_posts
            comment_count = comment_counts.get(post_id, 0)
            
            match_reason = None
            if not is_own_post:
                post_vector = None
                try:
                    retrieved = qdrant_service.client.retrieve(
                        collection_name=COLLECTION_NAME,
                        ids=[post_id],
                        with_vectors=True
                    )
                    if retrieved and retrieved[0].vector:
                        post_vector = retrieved[0].vector
                except Exception:
                    pass
                
                match_reason = build_match_reason(
                    post_tags=post_povs,
                    user_post_tags=user_post_povs,
                    user_post_ids=user_post_ids,
                    db=db,
                    query_tags=request.povs if request.povs else None,
                    has_query=bool(request.query),
                    post_vector=post_vector,
                    user_post_vectors=user_post_vectors if user_post_vectors else []
                )
            
            username = db_post.username
            if not username and post_user_id:
                user = db.query(UserModel).filter(UserModel.id == post_user_id).first()
                username = user.username if user else f"User_{post_user_id[:8]}"
            
            results.append(PostResponse(
                id=post_id,
                text=db_post.text,
                povs=post_povs_list,
                user_id=post_user_id,
                username=username,
                score=None if is_own_post else hit.score,
                likes=likes_count,
                liked=liked,
                commentCount=comment_count,
                match_reason=match_reason,
                created_at=db_post.created_at.isoformat() if db_post.created_at else None,
            ))
    
    elif request.povs and len(request.povs) > 0:
        post_ids_with_povs = db.query(POVModel.post_id).filter(
            POVModel.pov.in_(request.povs)
        ).distinct().all()
        post_ids_list = [pid[0] for pid in post_ids_with_povs]
        
        if not post_ids_list:
            return []
        
        db_posts = db.query(PostModel).filter(
            PostModel.id.in_(post_ids_list)
        ).order_by(PostModel.created_at.desc()).limit(request.limit).all()
        
        for db_post in db_posts:
            post_id = db_post.id
            # Get POVs from povs table
            povs_query = db.query(POVModel.pov).filter(POVModel.post_id == post_id).all()
            post_povs = set([pov[0] for pov in povs_query])
            post_povs_list = [pov[0] for pov in povs_query]
            post_user_id = db_post.user_id
            is_own_post = post_user_id == current_user_id
            
            # Get likes and comments count from PostgreSQL
            likes_count = db.query(LikeModel).filter(LikeModel.post_id == post_id).count()
            liked = db.query(LikeModel).filter(LikeModel.post_id == post_id, LikeModel.user_id == current_user_id).first() is not None if current_user_id else False
            comment_count = db.query(CommentModel).filter(CommentModel.post_id == post_id).count()
            
            # Calculate match reason (only for other users' posts)
            match_reason = None
            if not is_own_post:
                # Get post vector from Qdrant
                post_vector = None
                try:
                    retrieved = qdrant_service.client.retrieve(
                        collection_name=COLLECTION_NAME,
                        ids=[post_id],
                        with_vectors=True
                    )
                    if retrieved and retrieved[0].vector:
                        post_vector = retrieved[0].vector
                except Exception:
                    pass
                
                match_reason = build_match_reason(
                    post_tags=post_povs,
                    user_post_tags=user_post_povs,
                    user_post_ids=user_post_ids,
                    db=db,
                    query_tags=request.povs if request.povs else None,
                    has_query=False,
                    post_vector=post_vector,
                    user_post_vectors=user_post_vectors if user_post_vectors else []
                )
            
            # Get username from database
            username = db_post.username
            if not username and post_user_id:
                # Fallback: get from users table
                user = db.query(UserModel).filter(UserModel.id == post_user_id).first()
                username = user.username if user else f"User_{post_user_id[:8]}"
            
            results.append(PostResponse(
                id=post_id,
                text=db_post.text,
                povs=post_povs_list,
                user_id=post_user_id,
                username=username,
                likes=likes_count,
                liked=liked,
                commentCount=comment_count,
                match_reason=match_reason,
                created_at=db_post.created_at.isoformat() if db_post.created_at else None,
            ))
    
    # Pattern A: Qdrantで候補を取って、Postgresで仕上げる
    # If only query text is provided, use vector search
    elif request.query:
        # Step 1: Qdrantで候補を取得（System of Search）
        vector = await embedding_service.embed_text_async(request.query)
        candidate_limit = min(request.limit * 3, 200)  # Get more candidates
        hits = qdrant_service.search_similar(
            vector,
            limit=candidate_limit,
            required_tags=None,
        )
        
        # Step 2: Postgresで詳細を取得（System of Record）
        post_ids = [hit.id for hit in hits]
        if not post_ids:
            return []
        
        # Batch fetch from PostgreSQL
        db_posts_dict = {post.id: post for post in db.query(PostModel).filter(PostModel.id.in_(post_ids)).all()}
        
        # Batch fetch likes and comments counts
        post_ids_list = list(db_posts_dict.keys())
        
        likes_counts = {
            row[0]: row[1]
            for row in db.query(LikeModel.post_id, func.count(LikeModel.id))
            .filter(LikeModel.post_id.in_(post_ids_list))
            .group_by(LikeModel.post_id).all()
        } if post_ids_list else {}
        
        user_liked_post_ids = [
            row[0] for row in db.query(LikeModel.post_id)
            .filter(LikeModel.post_id.in_(post_ids_list), LikeModel.user_id == current_user_id)
            .all()
        ] if current_user_id and post_ids_list else []
        user_liked_posts = set(user_liked_post_ids)
        
        comment_counts = {
            row[0]: row[1]
            for row in db.query(CommentModel.post_id, func.count(CommentModel.id))
            .filter(CommentModel.post_id.in_(post_ids_list))
            .group_by(CommentModel.post_id).all()
        } if post_ids_list else {}
        
        for hit in hits:
            post_id = hit.id
            payload = hit.payload
            post_user_id = payload.get("user_id")
            is_own_post = post_user_id == current_user_id
            
            # Get post data from PostgreSQL (System of Record)
            db_post = db_posts_dict.get(post_id)
            if not db_post:
                continue  # Skip if post not found in PostgreSQL
            
            # Get POVs from povs table
            povs_query = db.query(POVModel.pov).filter(POVModel.post_id == post_id).all()
            post_povs = set([pov[0] for pov in povs_query])
            post_povs_list = [pov[0] for pov in povs_query]
            
            # Get likes and comments count from batch results
            likes_count = likes_counts.get(post_id, 0)
            liked = post_id in user_liked_posts
            comment_count = comment_counts.get(post_id, 0)
            
            # Calculate match reason (only for other users' posts)
            match_reason = None
            if not is_own_post:
                # Get post vector from Qdrant
                post_vector = None
                try:
                    retrieved = qdrant_service.client.retrieve(
                        collection_name=COLLECTION_NAME,
                        ids=[post_id],
                        with_vectors=True
                    )
                    if retrieved and retrieved[0].vector:
                        post_vector = retrieved[0].vector
                except Exception:
                    pass
                
                match_reason = build_match_reason(
                    post_tags=post_povs,
                    user_post_tags=user_post_povs,
                    user_post_ids=user_post_ids,
                    db=db,
                    has_query=bool(request.query),
                    post_vector=post_vector,
                    user_post_vectors=user_post_vectors if user_post_vectors else []
                )
            
            # Get username from database
            username = db_post.username
            if not username and post_user_id:
                # Fallback: get from users table
                user = db.query(UserModel).filter(UserModel.id == post_user_id).first()
                username = user.username if user else f"User_{post_user_id[:8]}"
            
            results.append(PostResponse(
                id=post_id,
                text=db_post.text,
                povs=post_povs_list,
                user_id=post_user_id,
                username=username,
                score=None if is_own_post else hit.score,
                likes=likes_count,
                liked=liked,
                commentCount=comment_count,
                match_reason=match_reason,
                created_at=db_post.created_at.isoformat() if db_post.created_at else None,
            ))
    
    # Sort by created_at (newest first) for search results
    # Use ranking service (can be swapped with different algorithms)
    results = rank_posts(results, sort_by="created_at", reverse=True)
    
    # If neither query nor tags, return empty
    return results

@router.post("/povs/{pov}/like", response_model=LikeResponse)
def like_pov(pov: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Like a POV (tag)"""
    # Check if already liked
    existing_like = db.query(POVLikeModel).filter(
        POVLikeModel.pov == pov,
        POVLikeModel.user_id == user_id
    ).first()
    
    if existing_like:
        # Already liked
        likes_count = db.query(POVLikeModel).filter(POVLikeModel.pov == pov).count()
        return LikeResponse(
            liked=True,
            likes=likes_count
        )
    
    # Create new like
    new_like = POVLikeModel(
        id=str(uuid.uuid4()),
        pov=pov,
        user_id=user_id
    )
    db.add(new_like)
    db.commit()
    
    likes_count = db.query(POVLikeModel).filter(POVLikeModel.pov == pov).count()
    return LikeResponse(
        liked=True,
        likes=likes_count
    )

@router.delete("/povs/{pov}/like", response_model=LikeResponse)
def unlike_pov(pov: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unlike a POV (tag)"""
    existing_like = db.query(POVLikeModel).filter(
        POVLikeModel.pov == pov,
        POVLikeModel.user_id == user_id
    ).first()
    
    if not existing_like:
        # Not liked
        likes_count = db.query(POVLikeModel).filter(POVLikeModel.pov == pov).count()
        return LikeResponse(
            liked=False,
            likes=likes_count
        )
    
    # Delete like
    db.delete(existing_like)
    db.commit()
    
    likes_count = db.query(POVLikeModel).filter(POVLikeModel.pov == pov).count()
    return LikeResponse(
        liked=False,
        likes=likes_count
    )

@router.get("/povs/{pov}/like-status", response_model=LikeResponse)
def get_pov_like_status(pov: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get like status for a POV"""
    liked = db.query(POVLikeModel).filter(
        POVLikeModel.pov == pov,
        POVLikeModel.user_id == user_id
    ).first() is not None
    
    likes_count = db.query(POVLikeModel).filter(POVLikeModel.pov == pov).count()
    return LikeResponse(
        liked=liked,
        likes=likes_count
    )

@router.post("/{post_id}/comments", response_model=CommentResponse)
def add_comment(post_id: str, comment: CommentCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a comment to a post"""
    # Verify post exists
    post = db.query(PostModel).filter(PostModel.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    new_comment = CommentModel(
        id=str(uuid.uuid4()),
        post_id=post_id,
        user_id=user_id,
        text=comment.text
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    return CommentResponse(
        id=new_comment.id,
        text=new_comment.text,
        authorId=new_comment.user_id,
        createdAt=new_comment.created_at
    )
