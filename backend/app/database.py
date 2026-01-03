"""
Database connection and models using SQLAlchemy
"""
import os
from sqlalchemy import create_engine, Column, String, Text, ARRAY, DateTime, ForeignKey, Integer, Boolean, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from typing import List
import uuid

# Database URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://daimon:daimon@localhost:5432/daimon"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Post(Base):
    """
    Post model - stores post metadata and content (System of Record)
    
    PostgreSQL = System of Record (真実のDB)
    - Full text, metadata
    - Strong consistency (transactions, foreign keys, constraints)
    - JOIN operations, aggregations, sorting
    """
    __tablename__ = "posts"
    
    id = Column(String, primary_key=True)  # UUID as string (from Qdrant)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String, nullable=True, index=True)  # Username of the post author (snapshot at creation time)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="posts")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    povs = relationship("POV", back_populates="post", cascade="all, delete-orphan", lazy="joined")


class Like(Base):
    """
    Like model - stores user likes on posts (System of Record)
    
    Consistency and uniqueness constraints are critical here.
    Qdrant is not suitable for this type of data.
    """
    __tablename__ = "likes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID as string
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    post = relationship("Post", back_populates="likes")
    user = relationship("User", back_populates="likes")
    
    # Unique constraint: one like per user per post
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_likes_post_user"),
    )


class Comment(Base):
    """
    Comment model - stores comments on posts (System of Record)
    
    Requires strong consistency and relationships with posts.
    """
    __tablename__ = "comments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID as string
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")


class POV(Base):
    """
    POV model - stores POVs (Points of View) for posts
    
    Normalized table for better performance and querying.
    Each POV is stored as a separate row with post_id reference.
    """
    __tablename__ = "povs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID as string
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    pov = Column(String, nullable=False, index=True)  # POV name
    is_auto = Column(Boolean, default=False, nullable=False, index=True)  # Whether this POV was auto-generated
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    post = relationship("Post", back_populates="povs")
    
    # Unique constraint: one POV per post (no duplicates)
    __table_args__ = (
        UniqueConstraint("post_id", "pov", name="uq_povs_post_pov"),
        Index("idx_povs_pov", "pov"),  # Index for POV search
        Index("idx_povs_post_id_pov", "post_id", "pov"),  # Composite index for common queries
    )


class POVLike(Base):
    """
    POV Like model - stores user likes on POVs
    
    Allows users to like specific POVs to indicate interest.
    """
    __tablename__ = "pov_likes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID as string
    pov = Column(String, nullable=False, index=True)  # POV name
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Unique constraint: one like per user per POV
    __table_args__ = (
        UniqueConstraint("pov", "user_id", name="uq_pov_likes_pov_user"),
    )


class User(Base):
    """
    User model - stores user authentication and profile data
    
    Production-ready user management with proper password hashing.
    """
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # UUID as string
    username = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)  # bcrypt hashed password
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    """
    Session model - stores user sessions (tokens)
    
    Production-ready session management with expiration.
    """
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # Token
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")


# Database initialization is now handled by Alembic migrations
# Use 'alembic upgrade head' to apply migrations
# def init_db():
#     """Initialize database tables"""
#     Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
