"""
User repository for database operations.
"""
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.core.security import get_password_hash, verify_password


class UserRepository:
    """Repository for user database operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_user(self, name: str, email: str, password: str) -> Optional[User]:
        """Create a new user with hashed password."""
        try:
            hashed_password = get_password_hash(password)
            user = User(
                name=name,
                email=email,
                password_hash=hashed_password
            )
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            return user
        except IntegrityError:
            self.db.rollback()
            return None  # Email already exists
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        import uuid
        try:
            # Convert string UUID to UUID object for database query
            uuid_obj = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
            return self.db.query(User).filter(User.id == uuid_obj).first()
        except (ValueError, TypeError):
            return None
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password."""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user