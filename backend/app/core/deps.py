"""
Dependency injection utilities for FastAPI.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import verify_token
from app.db.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/token",
    auto_error=False
)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.
    
    This dependency extracts and validates the JWT token, then returns the
    corresponding user object. Raises HTTP 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
    
    try:
        # Verify and decode token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None or email is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    user_repo = UserRepository(db)
    user = user_repo.get_user_by_id(user_id)
    
    if user is None:
        raise credentials_exception
        
    return user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current authenticated user from JWT token, but don't raise error if not authenticated.
    
    This dependency is useful for endpoints that can work with or without authentication.
    Returns None if no valid token is provided.
    """
    if not token:
        return None
    
    try:
        # Verify and decode token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            return None
            
        # Get user from database
        user_repo = UserRepository(db)
        user = user_repo.get_user_by_id(user_id)
        return user
        
    except JWTError:
        return None


def require_auth(user: User = Depends(get_current_user)) -> User:
    """
    Dependency that requires authentication.
    
    This is a convenience dependency that can be used to protect endpoints
    that require authentication. It's essentially an alias for get_current_user
    but with a more descriptive name.
    """
    return user