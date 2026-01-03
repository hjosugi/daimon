"""
Database connection and models using SQLAlchemy
"""
import os
import logging
from urllib.parse import urlparse
from sqlalchemy import create_engine, Column, String, Text, ARRAY, DateTime, ForeignKey, Integer, Boolean, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from typing import List
import uuid

logger = logging.getLogger("daimon")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://daimon:daimon@localhost:5432/daimon"
)

# Flag to prevent duplicate error messages
_validation_error_shown = False

# Validate DATABASE_URL format
def validate_database_url(url: str) -> bool:
    """Validate that DATABASE_URL contains password and no placeholders.
    Returns True if valid, False otherwise. Does not log errors."""
    try:
        # Check for placeholders
        placeholders = ['YOUR-PROJECT', 'YOUR-PASSWORD', '[YOUR-PROJECT]', '[YOUR-PASSWORD]', '[PASSWORD]']
        if any(placeholder in url for placeholder in placeholders):
            return False
        
        parsed = urlparse(url)
        
        # Check if password is present (netloc format: user:password@host:port)
        if parsed.netloc:
            parts = parsed.netloc.split('@')
            if len(parts) == 2:
                auth = parts[0]
                if ':' in auth:
                    user, password = auth.split(':', 1)
                    if password and password.strip():
                        # Additional check: password should not be empty or just whitespace
                        return True
        
        return False
    except ValueError as e:
        # Handle IPv6 addresses and other parsing issues
        if 'Invalid IPv6 URL' in str(e) or 'IPv6' in str(e):
            # Try to extract hostname manually for better error message
            if '@' in url and '://' in url:
                try:
                    scheme_part = url.split('://', 1)[1]
                    auth_part = scheme_part.split('@')[0]
                    host_part = scheme_part.split('@')[1].split('/')[0]
                    logger.error(
                        f"DATABASE_URL validation failed: URL parsing error (possibly IPv6 address). "
                        f"Please ensure the URL format is correct: postgresql://user:password@host:port/database"
                    )
                except:
                    logger.error(
                        f"DATABASE_URL validation failed: Invalid URL format. "
                        f"Expected format: postgresql://user:password@host:port/database"
                    )
            else:
                logger.error(
                    f"DATABASE_URL validation failed: Invalid URL format. "
                    f"Expected format: postgresql://user:password@host:port/database"
                )
        else:
            logger.error(f"DATABASE_URL validation error: {e}")
        return False
    except Exception as e:
        logger.error(f"DATABASE_URL validation error: {e}")
        return False

# Validate DATABASE_URL only once to avoid duplicate error messages
if not validate_database_url(DATABASE_URL):
    if not _validation_error_shown:
        _validation_error_shown = True
        # Check if it's a placeholder or default value
        if 'YOUR-PROJECT' in DATABASE_URL or '[YOUR-PROJECT]' in DATABASE_URL or 'YOUR-PASSWORD' in DATABASE_URL or '[YOUR-PASSWORD]' in DATABASE_URL:
            logger.error(
                "\n" + "="*70 + "\n"
                "DATABASE_URL is not properly configured!\n"
                "\n"
                "Please edit backend/.env file and set DATABASE_URL with your actual Supabase credentials:\n"
                "\n"
                "1. Go to Supabase Dashboard > Settings > Database\n"
                "2. Copy the connection string (URI format)\n"
                "3. Edit backend/.env and replace the DATABASE_URL line with:\n"
                "   DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@YOUR_PROJECT.supabase.co:5432/postgres\n"
                "\n"
                "Example:\n"
                "   DATABASE_URL=postgresql://postgres:mypassword123@db.abc123xyz.supabase.co:5432/postgres\n"
                "\n"
                "Note: If your password contains special characters, URL-encode them:\n"
                "   @ → %40, # → %23, % → %25\n"
                "="*70 + "\n"
            )
        else:
            logger.warning(
                "DATABASE_URL appears to be missing password or has invalid format. "
                "Connection attempts may fail. "
                "Please verify your .env file or Secret Manager configuration."
            )

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Post(Base):
    """
    Post model - stores post metadata and content (System of Record)
    """
    __tablename__ = "posts"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String, nullable=True, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
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
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    post = relationship("Post", back_populates="likes")
    user = relationship("User", back_populates="likes")
    
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_likes_post_user"),
    )


class Comment(Base):
    """
    Comment model - stores comments on posts (System of Record)
    
    Requires strong consistency and relationships with posts.
    """
    __tablename__ = "comments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")


class POV(Base):
    """
    POV model - stores POVs (Points of View) for posts
    """
    __tablename__ = "povs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    pov = Column(String, nullable=False, index=True)
    is_auto = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    post = relationship("Post", back_populates="povs")
    
    __table_args__ = (
        UniqueConstraint("post_id", "pov", name="uq_povs_post_pov"),
        Index("idx_povs_pov", "pov"),
        Index("idx_povs_post_id_pov", "post_id", "pov"),
    )


class POVLike(Base):
    """
    POV Like model - stores user likes on POVs
    
    Allows users to like specific POVs to indicate interest.
    """
    __tablename__ = "pov_likes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    pov = Column(String, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        UniqueConstraint("pov", "user_id", name="uq_pov_likes_pov_user"),
    )


class User(Base):
    """
    User model - stores user authentication and profile data
    """
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    """
    Session model - stores user sessions (tokens)
    """
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    
    user = relationship("User", back_populates="sessions")


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
