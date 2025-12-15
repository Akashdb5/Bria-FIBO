"""
API endpoints for workflow run management.
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import User, WorkflowRun
from app.services.execution_service import WorkflowExecutionService
from app.schemas.workflow import (
    WorkflowRunCreate, WorkflowRunResponse, WorkflowRunListResponse,
    WorkflowRunStatusUpdate
)


router = APIRouter()


@router.post("/", response_model=WorkflowRunResponse)
async def create_workflow_run(
    workflow_run_data: WorkflowRunCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new workflow run and start execution.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        # Create workflow run
        workflow_run = await execution_service.create_workflow_run(
            workflow_id=workflow_run_data.workflow_id,
            user_id=current_user.id,
            input_parameters=workflow_run_data.input_parameters
        )
        
        # Start execution in background
        background_tasks.add_task(
            execute_workflow_background,
            workflow_run.id,
            db
        )
        
        return WorkflowRunResponse.from_orm(workflow_run)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workflow run: {str(e)}"
        )


@router.get("/", response_model=WorkflowRunListResponse)
async def get_workflow_runs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all workflow runs for the current user.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        runs, total = await execution_service.get_user_workflow_runs(
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
        
        return WorkflowRunListResponse(
            items=[WorkflowRunResponse.from_orm(run) for run in runs],
            total=total,
            skip=skip,
            limit=limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve workflow runs: {str(e)}"
        )


@router.get("/{workflow_run_id}", response_model=WorkflowRunResponse)
async def get_workflow_run(
    workflow_run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific workflow run by ID.
    """
    execution_service = WorkflowExecutionService(db)
    
    workflow_run = await execution_service.get_workflow_run(
        workflow_run_id=workflow_run_id,
        user_id=current_user.id
    )
    
    if not workflow_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )
    
    return WorkflowRunResponse.from_orm(workflow_run)


@router.put("/{workflow_run_id}/status", response_model=WorkflowRunResponse)
async def update_workflow_run_status(
    workflow_run_id: UUID,
    status_update: WorkflowRunStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the status of a workflow run.
    """
    execution_service = WorkflowExecutionService(db)
    
    workflow_run = await execution_service.update_workflow_run_status(
        workflow_run_id=workflow_run_id,
        status=status_update.status,
        user_id=current_user.id
    )
    
    if not workflow_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )
    
    return WorkflowRunResponse.from_orm(workflow_run)


@router.post("/{workflow_run_id}/continue")
async def continue_workflow_run(
    workflow_run_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Continue execution of a paused workflow run.
    """
    execution_service = WorkflowExecutionService(db)
    
    workflow_run = await execution_service.get_workflow_run(
        workflow_run_id=workflow_run_id,
        user_id=current_user.id
    )
    
    if not workflow_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )
    
    if workflow_run.status != "WAITING_APPROVAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workflow run is not waiting for approval (current status: {workflow_run.status})"
        )
    
    # Continue execution in background
    background_tasks.add_task(
        execute_workflow_background,
        workflow_run.id,
        db
    )
    
    return {"message": "Workflow execution resumed"}


async def execute_workflow_background(workflow_run_id: UUID, db: Session):
    """
    Background task to execute workflow run.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        await execution_service.execute_workflow_run(workflow_run_id)
    except Exception as e:
        # Error handling is done within the execution service
        # This just ensures the background task doesn't crash
        pass