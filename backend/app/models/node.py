"""
Node model for system node type definitions.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text

from app.db.database import Base
from app.db.types import UUID, JSONB


class Node(Base):
    __tablename__ = "fibo_nodes"
    
    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    node_type = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text)
    input_schema = Column(JSONB, nullable=False)
    output_schema = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)