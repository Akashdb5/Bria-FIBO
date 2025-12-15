"""
WorkflowRun model for workflow execution instances.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.types import UUID, JSONB


class WorkflowRun(Base):
    __tablename__ = "fibo_workflow_runs"
    
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(), ForeignKey("fibo_workflows.id"), nullable=False, index=True)
    status = Column(String, nullable=False, index=True)
    execution_snapshot = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    
    # Add check constraint for valid status values
    __table_args__ = (
        CheckConstraint(
            status.in_(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'WAITING_APPROVAL']),
            name='valid_status'
        ),
    )
    
    # Relationships
    workflow = relationship("Workflow", back_populates="workflow_runs")