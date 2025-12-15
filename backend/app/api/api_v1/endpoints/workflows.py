"""
Workflow management endpoints.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models import User
from app.services.workflow_service import WorkflowService
from app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse, WorkflowListResponse,
    ConnectionValidationRequest, ConnectionValidationResponse,
    WorkflowValidationRequest, WorkflowValidationResponse
)

router = APIRouter()


@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    workflow_data: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow."""
    try:
        workflow_service = WorkflowService(db)
        workflow = workflow_service.create_workflow(current_user.id, workflow_data)
        return WorkflowResponse.model_validate(workflow)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=WorkflowListResponse)
def get_workflows(
    skip: int = Query(0, ge=0, description="Number of workflows to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of workflows to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all workflows for the current user."""
    workflow_service = WorkflowService(db)
    workflows, total = workflow_service.get_user_workflows(current_user.id, skip, limit)
    
    workflow_responses = [WorkflowResponse.model_validate(workflow) for workflow in workflows]
    
    return WorkflowListResponse(workflows=workflow_responses, total=total)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific workflow by ID."""
    workflow_service = WorkflowService(db)
    workflow = workflow_service.get_workflow(workflow_id, current_user.id)
    
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )
    
    return WorkflowResponse.model_validate(workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: UUID,
    workflow_data: WorkflowUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing workflow."""
    try:
        workflow_service = WorkflowService(db)
        workflow = workflow_service.update_workflow(workflow_id, current_user.id, workflow_data)
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workflow not found"
            )
        
        return WorkflowResponse.model_validate(workflow)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a workflow."""
    workflow_service = WorkflowService(db)
    success = workflow_service.delete_workflow(workflow_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found"
        )


@router.post("/validate-connection", response_model=ConnectionValidationResponse)
def validate_connection(
    connection_data: ConnectionValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate if two nodes can be connected."""
    workflow_service = WorkflowService(db)
    return workflow_service.validate_connection(
        connection_data.source_node_type,
        connection_data.target_node_type,
        connection_data.source_handle,
        connection_data.target_handle
    )


@router.post("/validate", response_model=WorkflowValidationResponse)
def validate_workflow(
    validation_data: WorkflowValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a complete workflow definition."""
    workflow_service = WorkflowService(db)
    return workflow_service.validate_workflow(validation_data.workflow_definition)