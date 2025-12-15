"""
Tests for workflow run management endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app
from app.schemas.workflow import (
    WorkflowRunCreate, WorkflowRunResponse, WorkflowRunListResponse,
    WorkflowRunStatusUpdate, PendingApprovalResponse,
    StructuredPromptApprovalRequest, StructuredPromptRejectionRequest,
    ApprovalActionResponse
)


class TestWorkflowRunEndpoints:
    """Test workflow run management endpoints."""
    
    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)
    
    def test_workflow_run_endpoints_exist(self):
        """Test that workflow run endpoints are properly registered."""
        # Test that the endpoints exist by making requests to them
        # They should return 401 (Unauthorized) since we don't have auth tokens
        
        # Test main workflow runs endpoint
        response = self.client.get("/api/v1/workflow-runs/")
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test specific workflow run endpoint
        fake_id = str(uuid4())
        response = self.client.get(f"/api/v1/workflow-runs/{fake_id}")
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test workflow run status update endpoint
        response = self.client.put(
            f"/api/v1/workflow-runs/{fake_id}/status",
            json={"status": "COMPLETED"}
        )
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test workflow run continue endpoint
        response = self.client.post(f"/api/v1/workflow-runs/{fake_id}/continue")
        assert response.status_code == 401  # Unauthorized (no JWT token)
    
    def test_workflow_run_creation_endpoint(self):
        """Test workflow run creation endpoint structure."""
        workflow_run_data = {
            "workflow_id": str(uuid4()),
            "input_parameters": {"test": "value"}
        }
        
        response = self.client.post(
            "/api/v1/workflow-runs/",
            json=workflow_run_data
        )
        
        # Should fail with 401 since we don't have authentication
        # but it shows the endpoint exists and is processing the request
        assert response.status_code == 401  # Unauthorized (no JWT token)
    
    def test_approval_endpoints_exist(self):
        """Test that approval endpoints are properly registered."""
        fake_workflow_run_id = str(uuid4())
        fake_node_id = "node-1"
        
        # Test GET pending approvals
        response = self.client.get(
            f"/api/v1/approvals/workflow-runs/{fake_workflow_run_id}/pending-approvals"
        )
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test POST approve endpoint
        response = self.client.post(
            f"/api/v1/approvals/workflow-runs/{fake_workflow_run_id}/nodes/{fake_node_id}/approve",
            json={"approved_prompt": {"test": "data"}}
        )
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test POST reject endpoint
        response = self.client.post(
            f"/api/v1/approvals/workflow-runs/{fake_workflow_run_id}/nodes/{fake_node_id}/reject",
            json={"rejection_reason": "test reason"}
        )
        assert response.status_code == 401  # Unauthorized (no JWT token)
    
    def test_workflow_run_schema_validation(self):
        """Test that workflow run schemas are properly defined."""
        # Test WorkflowRunCreate schema
        create_data = {
            "workflow_id": str(uuid4()),
            "input_parameters": {"test": "value"}
        }
        workflow_run_create = WorkflowRunCreate(**create_data)
        assert workflow_run_create.workflow_id is not None
        assert workflow_run_create.input_parameters == {"test": "value"}
        
        # Test approval schemas
        approval_request = StructuredPromptApprovalRequest(
            approved_prompt={"test": "prompt"}
        )
        assert approval_request.approved_prompt == {"test": "prompt"}
        
        rejection_request = StructuredPromptRejectionRequest(
            rejection_reason="test reason"
        )
        assert rejection_request.rejection_reason == "test reason"
        
        # Test response schemas
        approval_response = ApprovalActionResponse(
            success=True,
            message="Test message"
        )
        assert approval_response.success is True
        assert approval_response.message == "Test message"
    
