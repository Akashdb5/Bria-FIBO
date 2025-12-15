"""
Integration tests for workflow endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.workflow import WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowNodeData


class TestWorkflowEndpoints:
    """Test workflow API endpoints."""
    
    def setup_method(self):
        """Set up test client."""
        self.client = TestClient(app)
    
    def test_workflow_endpoints_exist(self):
        """Test that workflow endpoints are properly registered."""
        # Test that the endpoints exist by making requests to them
        # They should return 401 (Unauthorized) since we don't have auth tokens
        
        # Test main workflows endpoint
        response = self.client.get("/api/v1/workflows/")
        assert response.status_code == 401  # Unauthorized (no JWT token)
        
        # Test validation endpoints exist
        response = self.client.post("/api/v1/workflows/validate-connection", json={})
        assert response.status_code in [401, 422]  # Unauthorized or validation error
        
        response = self.client.post("/api/v1/workflows/validate", json={})
        assert response.status_code in [401, 422]  # Unauthorized or validation error
    
    def test_validate_connection_endpoint(self):
        """Test the connection validation endpoint."""
        connection_data = {
            "source_node_type": "GenerateImageV2",
            "target_node_type": "RefineImageV2",
            "source_handle": "image",
            "target_handle": "image"
        }
        
        response = self.client.post(
            "/api/v1/workflows/validate-connection",
            json=connection_data
        )
        
        # This should fail with 401 since we don't have authentication
        # but it shows the endpoint exists and is processing the request
        assert response.status_code == 401  # Unauthorized (no JWT token)
    
    def test_validate_workflow_endpoint(self):
        """Test the workflow validation endpoint."""
        workflow_data = {
            "workflow_definition": {
                "nodes": [
                    {
                        "id": "node1",
                        "type": "GenerateImageV2",
                        "position": {"x": 100, "y": 100},
                        "data": {"config": {"prompt": "test"}}
                    }
                ],
                "edges": []
            }
        }
        
        response = self.client.post(
            "/api/v1/workflows/validate",
            json=workflow_data
        )
        
        # This should fail with 401 since we don't have authentication
        # but it shows the endpoint exists and is processing the request
        assert response.status_code == 401  # Unauthorized (no JWT token)