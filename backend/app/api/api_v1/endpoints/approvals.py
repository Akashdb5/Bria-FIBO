"""
API endpoints for structured prompt approval workflow.
"""
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import User
from app.services.execution_service import WorkflowExecutionService
from app.schemas.workflow import (
    StructuredPromptApprovalRequest, StructuredPromptRejectionRequest,
    PendingApprovalResponse, ApprovalActionResponse
)


router = APIRouter()


@router.get("/workflow-runs/{workflow_run_id}/pending-approvals", response_model=List[PendingApprovalResponse])
async def get_pending_approvals(
    workflow_run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all pending approval requests for a workflow run.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        pending_approvals = await execution_service.get_pending_approvals(
            workflow_run_id=workflow_run_id,
            user_id=current_user.id
        )
        
        return [PendingApprovalResponse(**approval) for approval in pending_approvals]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pending approvals: {str(e)}"
        )


@router.post("/workflow-runs/{workflow_run_id}/nodes/{node_id}/approve", response_model=ApprovalActionResponse)
async def approve_structured_prompt(
    workflow_run_id: UUID,
    node_id: str,
    approval_request: StructuredPromptApprovalRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve a structured prompt and continue workflow execution.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        success = await execution_service.approve_structured_prompt(
            workflow_run_id=workflow_run_id,
            node_id=node_id,
            approved_prompt=approval_request.approved_prompt,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to approve structured prompt. Node may not be waiting for approval."
            )
        
        # Continue workflow execution in background
        from app.api.api_v1.endpoints.workflow_runs import execute_workflow_background
        background_tasks.add_task(
            execute_workflow_background,
            workflow_run_id,
            db
        )
        
        return ApprovalActionResponse(
            success=True,
            message="Structured prompt approved. Workflow execution will continue."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve structured prompt: {str(e)}"
        )


@router.post("/workflow-runs/{workflow_run_id}/nodes/{node_id}/reject", response_model=ApprovalActionResponse)
async def reject_structured_prompt(
    workflow_run_id: UUID,
    node_id: str,
    rejection_request: StructuredPromptRejectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a structured prompt and halt workflow execution.
    """
    execution_service = WorkflowExecutionService(db)
    
    try:
        success = await execution_service.reject_structured_prompt(
            workflow_run_id=workflow_run_id,
            node_id=node_id,
            rejection_reason=rejection_request.rejection_reason,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reject structured prompt. Node may not be waiting for approval."
            )
        
        return ApprovalActionResponse(
            success=True,
            message="Structured prompt rejected. Workflow execution has been halted."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject structured prompt: {str(e)}"
        )