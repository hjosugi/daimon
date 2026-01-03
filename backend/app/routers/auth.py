from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
import uuid
import bcrypt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.api import (
    UserRegister,
    UserLogin,
    UserResponse,
    UserProfileUpdate,
)
from app.database import get_db, User as UserModel, Session as SessionModel
from app.utils.enums import HTTPStatus
from app.logger import logger

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

SESSION_EXPIRY_DAYS = 30

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """Get current user from token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.replace("Bearer ", "")
    
    session = db.query(SessionModel).filter(
        SessionModel.id == token,
        SessionModel.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return session.user_id

def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.replace("Bearer ", "")
    
    session = db.query(SessionModel).filter(
        SessionModel.id == token,
        SessionModel.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        return None
    
    return session.user_id

@router.post("/register", response_model=UserResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(UserModel).filter(
        or_(
            UserModel.username == user_data.username,
            UserModel.email == user_data.email.lower()
        )
    ).first()
    
    if existing_user:
        if existing_user.username == user_data.username:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Username already exists"
            )
        if existing_user.email == user_data.email.lower():
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Email already exists"
            )
    
    password_hash = hash_password(user_data.password)
    
    user = UserModel(
        id=str(uuid.uuid4()),
        username=user_data.username,
        email=user_data.email.lower(),
        password_hash=password_hash,
        avatar_url=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session = SessionModel(
        id=token,
        user_id=user.id,
        created_at=datetime.utcnow(),
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        token=token,
    )

@router.post("/login", response_model=UserResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    email_or_username_lower = credentials.email_or_username.lower()
    user = db.query(UserModel).filter(
        or_(
            UserModel.email == email_or_username_lower,
            UserModel.username == credentials.email_or_username
        )
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Generate session token
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session = SessionModel(
        id=token,
        user_id=user.id,
        created_at=datetime.utcnow(),
        expires_at=expires_at
    )
    
    db.add(session)
    db.commit()
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        token=token,
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user info"""
    user = db.query(UserModel).filter(UserModel.id == current_user_id).first()
    if not user:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
    )

@router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_data: UserProfileUpdate,
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user profile"""
    user = db.query(UserModel).filter(UserModel.id == current_user_id).first()
    if not user:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="User not found"
        )
    
    if profile_data.avatar_url:
        user.avatar_url = profile_data.avatar_url
    if profile_data.username:
        # Check if username is already taken
        existing_user = db.query(UserModel).filter(
            UserModel.username == profile_data.username,
            UserModel.id != current_user_id
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail="Username already exists"
            )
        user.username = profile_data.username
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
    )

@router.delete("/account")
def delete_account(
    current_user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete user account and all associated data"""
    user = db.query(UserModel).filter(UserModel.id == current_user_id).first()
    if not user:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="User not found"
        )
    
    try:
        from app.services.qdrant_service import qdrant_service, COLLECTION_NAME
        from app.database import Post as PostModel
        from qdrant_client.models import PointIdsList
        
        user_posts = db.query(PostModel.id).filter(PostModel.user_id == current_user_id).all()
        post_ids = [post[0] for post in user_posts]
        
        if post_ids:
            qdrant_service.client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=PointIdsList(points=post_ids)
            )
    except Exception as e:
        logger.warning(f"Error deleting posts from Qdrant: {e}")
    
    db.delete(user)
    db.commit()
    
    return {"message": "Account deleted successfully"}

@router.post("/logout")
def logout(
    current_user_id: str = Depends(get_current_user),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Logout user (delete current session)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=HTTPStatus.UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    token = authorization.replace("Bearer ", "")
    
    # Delete session
    session = db.query(SessionModel).filter(SessionModel.id == token).first()
    if session:
        db.delete(session)
        db.commit()
    
    return {"message": "Logged out successfully"}
