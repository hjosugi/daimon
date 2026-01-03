from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from app.utils.enums import MatchType
from app.utils.security import validate_pov, validate_post_text

class PostCreate(BaseModel):
    text: str
    povs: List[str] = Field(default=[], max_length=100)  # Max 100 POVs per post
    
    @field_validator('text')
    @classmethod
    def validate_text(cls, v):
        """Validate post text for security and length"""
        if v is None:
            return v
        is_valid, error = validate_post_text(v)
        if not is_valid:
            raise ValueError(error)
        return v
    
    @field_validator('povs')
    @classmethod
    def validate_pov_length(cls, v):
        """Validate that each POV is at most 300 characters and safe"""
        if v is None:
            return v
        for pov in v:
            is_valid, error = validate_pov(pov)
            if not is_valid:
                raise ValueError(error)
        return v

class SimilarUserPost(BaseModel):
    """A user's post that contributed to the match"""
    id: str
    text: str  # Preview text (truncated if long)
    similarity_score: Optional[float] = None  # Similarity score with the matched post

class MatchReason(BaseModel):
    """Why this post was matched"""
    pov_matches: List[str] = []  # POVs that matched (from search query or user's posts)
    common_povs: List[str] = []  # POVs in common with user's posts
    pov_match_rate: Optional[float] = None  # POV match rate (0.0 to 1.0)
    matched_by: MatchType = MatchType.TAG  # Match type enum (TAG or BOTH)
    similar_to_user_posts: Optional[List[SimilarUserPost]] = None  # User's posts that contributed to the POV match (max 3)

class PostResponse(BaseModel):
    id: str
    text: str
    povs: List[str]  # POVs (Points of View) for this post
    user_id: Optional[str] = None  # User who created this post
    username: Optional[str] = None  # Username of the post author
    score: Optional[float] = None  # Similarity score
    likes: Optional[int] = 0
    liked: Optional[bool] = False
    commentCount: Optional[int] = 0
    match_reason: Optional[MatchReason] = None  # Why this post was recommended
    created_at: Optional[str] = None  # ISO format timestamp

class TimelineRequest(BaseModel):
    query_text: str  # Simulates "User Context" or "Current Thought"
    similarity_weight: float = 0.7  # 0.0 to 1.0 (1.0 = Pure Similarity, 0.0 = Diversity/Randomness)
    boost_popular: bool = False
    include_far_posts: bool = False

class POVGenerationRequest(BaseModel):
    text: str

class POVGenerationResponse(BaseModel):
    povs: List[str]

class CommentCreate(BaseModel):
    text: str
    
    @field_validator('text')
    @classmethod
    def validate_text(cls, v):
        """Validate comment text for security and length"""
        if v is None:
            return v
        is_valid, error = validate_post_text(v)
        if not is_valid:
            raise ValueError(error)
        return v

class CommentResponse(BaseModel):
    id: str
    text: str
    authorId: str
    username: Optional[str] = None  # Username of the comment author
    createdAt: Optional[datetime] = None

class LikeResponse(BaseModel):
    liked: bool
    likes: int

class SearchRequest(BaseModel):
    query: Optional[str] = None
    povs: Optional[List[str]] = None  # POVs to filter by
    limit: int = 20

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email_or_username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar_url: Optional[str] = None
    token: Optional[str] = None

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
