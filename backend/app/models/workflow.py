"""
Workflow model for user-defined workflows.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.types import UUID, JSONB


class Workflow(Base):
    __tablename__ = "fibo_workflows"
    
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("fibo_users.id"), nullable=False, index=True)
    name = Column(String)
    version = Column(Integer, default=1, nullable=False)
    workflow_definition = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="workflows")
    workflow_runs = relationship("WorkflowRun", back_populates="workflow", cascade="all, delete-orphan")