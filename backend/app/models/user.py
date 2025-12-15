"""
User model for authentication and user management.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.types import UUID


class User(Base):
    __tablename__ = "fibo_users"
    
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")