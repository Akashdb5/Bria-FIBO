"""
API endpoints for node type management and validation.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.node import (
    NodeSchema, NodeCreate, NodeValidationRequest, NodeValidationResponse
)
from app.services.node_service import NodeService

router = APIRouter()


@router.get("/", response_model=List[NodeSchema])
def get_node_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available node type definitions."""
    node_service = NodeService(db)
    nodes = node_service.get_all_node_types()
    return nodes


@router.get("/{node_type}", response_model=NodeSchema)
def get_node_type(
    node_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific node type definition."""
    node_service = NodeService(db)
    node = node_service.get_node_type(node_type)
    if not node:
        raise HTTPException(status_code=404, detail="Node type not found")
    return node


@router.post("/validate", response_model=NodeValidationResponse)
def validate_node_configuration(
    validation_request: NodeValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a node configuration against its schema."""
    node_service = NodeService(db)
    return node_service.validate_node_configuration(
        validation_request.node_type,
        validation_request.configuration
    )


@router.post("/seed", response_model=List[NodeSchema])
def seed_system_node_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Seed the database with system node type definitions."""
    node_service = NodeService(db)
    nodes = node_service.seed_system_node_types()
    return nodes