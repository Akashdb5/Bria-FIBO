"""
Tests for workflow validation functionality.
"""
import pytest
from app.services.workflow_service import WorkflowService
from app.schemas.workflow import WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowNodeData


class TestWorkflowValidation:
    """Test workflow validation logic."""
    
    def setup_method(self):
        """Set up test fixtures."""
        # Mock database session for testing
        self.workflow_service = WorkflowService(db=None)
    
    def test_valid_simple_workflow(self):
        """Test validation of a simple valid workflow."""
        # Create a simple workflow: StructuredPromptV2 -> GenerateImageV2
        workflow_def = WorkflowDefinition(
            nodes=[
                WorkflowNode(
                    id="node1",
                    type="StructuredPromptV2",
                    position={"x": 100, "y": 100},
                    data=WorkflowNodeData(config={"prompt": "test prompt"})
                ),
                WorkflowNode(
                    id="node2",
                    type="GenerateImageV2",
                    position={"x": 300, "y": 100},
                    data=WorkflowNodeData(config={"aspect_ratio": "1:1"})
                )
            ],
            edges=[
                WorkflowEdge(
                    id="edge1",
                    source="node1",
                    target="node2",
                    sourceHandle="structured_prompt",
                    targetHandle="structured_prompt"
                )
            ]
        )
        
        result = self.workflow_service.validate_workflow(workflow_def)
        
        assert result.valid is True
        assert len(result.errors) == 0
        assert result.has_cycles is False
    
    def test_workflow_with_cycle(self):
        """Test validation of workflow with cycles."""
        # Create a workflow with a cycle: node1 -> node2 -> node1
        workflow_def = WorkflowDefinition(
            nodes=[
                WorkflowNode(
                    id="node1",
                    type="GenerateImageV2",
                    position={"x": 100, "y": 100},
                    data=WorkflowNodeData(config={"prompt": "test"})
                ),
                WorkflowNode(
                    id="node2",
                    type="RefineImageV2",
                    position={"x": 300, "y": 100},
                    data=WorkflowNodeData(config={})
                )
            ],
            edges=[
                WorkflowEdge(id="edge1", source="node1", target="node2"),
                WorkflowEdge(id="edge2", source="node2", target="node1")
            ]
        )
        
        result = self.workflow_service.validate_workflow(workflow_def)
        
        assert result.valid is False
        assert result.has_cycles is True
        assert "cycles" in " ".join(result.errors).lower()
    
    def test_invalid_node_type(self):
        """Test validation with invalid node type."""
        workflow_def = WorkflowDefinition(
            nodes=[
                WorkflowNode(
                    id="node1",
                    type="InvalidNodeType",
                    position={"x": 100, "y": 100},
                    data=WorkflowNodeData(config={})
                )
            ],
            edges=[]
        )
        
        result = self.workflow_service.validate_workflow(workflow_def)
        
        assert result.valid is False
        assert any("InvalidNodeType" in error for error in result.errors)
    
    def test_invalid_connection(self):
        """Test validation with invalid node connection."""
        # Try to connect incompatible nodes
        workflow_def = WorkflowDefinition(
            nodes=[
                WorkflowNode(
                    id="node1",
                    type="StructuredPromptV2",
                    position={"x": 100, "y": 100},
                    data=WorkflowNodeData(config={})
                ),
                WorkflowNode(
                    id="node2",
                    type="RefineImageV2",
                    position={"x": 300, "y": 100},
                    data=WorkflowNodeData(config={})
                )
            ],
            edges=[
                WorkflowEdge(
                    id="edge1",
                    source="node1",
                    target="node2",
                    sourceHandle="structured_prompt",
                    targetHandle="image"  # RefineImageV2 expects image, not structured_prompt
                )
            ]
        )
        
        result = self.workflow_service.validate_workflow(workflow_def)
        
        # This should generate warnings about potentially problematic connections
        assert len(result.warnings) > 0
    
    def test_disconnected_nodes(self):
        """Test detection of disconnected nodes."""
        workflow_def = WorkflowDefinition(
            nodes=[
                WorkflowNode(
                    id="node1",
                    type="GenerateImageV2",
                    position={"x": 100, "y": 100},
                    data=WorkflowNodeData(config={})
                ),
                WorkflowNode(
                    id="node2",
                    type="StructuredPromptV2",
                    position={"x": 300, "y": 100},
                    data=WorkflowNodeData(config={})
                ),
                WorkflowNode(
                    id="node3",
                    type="RefineImageV2",
                    position={"x": 500, "y": 100},
                    data=WorkflowNodeData(config={})
                )
            ],
            edges=[
                WorkflowEdge(id="edge1", source="node1", target="node2")
                # node3 is disconnected
            ]
        )
        
        result = self.workflow_service.validate_workflow(workflow_def)
        
        assert "node3" in result.disconnected_nodes
        assert any("node3" in warning for warning in result.warnings)
    
    def test_connection_validation(self):
        """Test individual connection validation."""
        # Test valid connection
        result = self.workflow_service.validate_connection(
            "GenerateImageV2", "RefineImageV2", "image", "image"
        )
        assert result.valid is True
        
        # Test invalid source node type
        result = self.workflow_service.validate_connection(
            "InvalidType", "GenerateImageV2"
        )
        assert result.valid is False
        assert any("InvalidType" in error for error in result.errors)
        
        # Test invalid handle
        result = self.workflow_service.validate_connection(
            "GenerateImageV2", "RefineImageV2", "invalid_handle", "image"
        )
        assert result.valid is False
        assert any("invalid_handle" in error for error in result.errors)