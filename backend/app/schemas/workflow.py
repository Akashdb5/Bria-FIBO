"""
Pydantic schemas for workflow management.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, model_validator
from uuid import UUID
from datetime import datetime


class WorkflowNodeData(BaseModel):
    """Schema for node data within a workflow definition."""
    # Node configuration parameters based on node type
    config: Dict[str, Any] = Field(description="Node configuration parameters")


class WorkflowNode(BaseModel):
    """Schema for a node within a workflow definition."""
    id: str = Field(description="Unique node ID within the workflow")
    type: str = Field(description="Node type (must match system node types)")
    position: Dict[str, float] = Field(description="Node position on canvas (x, y coordinates)")
    data: WorkflowNodeData = Field(description="Node configuration data")


class WorkflowEdge(BaseModel):
    """Schema for an edge (connection) between nodes in a workflow."""
    id: str = Field(description="Unique edge ID within the workflow")
    source: str = Field(description="Source node ID")
    target: str = Field(description="Target node ID")
    sourceHandle: Optional[str] = Field(None, description="Source node output handle")
    targetHandle: Optional[str] = Field(None, description="Target node input handle")


class WorkflowDefinition(BaseModel):
    """Schema for complete workflow definition."""
    nodes: List[WorkflowNode] = Field(description="List of nodes in the workflow")
    edges: List[WorkflowEdge] = Field(description="List of edges connecting nodes")
    
    @model_validator(mode='after')
    def validate_workflow_structure(self):
        """Validate workflow structure and node references."""
        # Get all node IDs
        node_ids = {node.id for node in self.nodes}
        
        # Validate edge references
        for edge in self.edges:
            if edge.source not in node_ids:
                raise ValueError(f"Edge {edge.id} references non-existent source node: {edge.source}")
            if edge.target not in node_ids:
                raise ValueError(f"Edge {edge.id} references non-existent target node: {edge.target}")
        
        return self


class WorkflowCreate(BaseModel):
    """Schema for creating a new workflow."""
    name: Optional[str] = Field(None, description="Workflow name")
    workflow_definition: WorkflowDefinition = Field(description="Complete workflow definition")


class WorkflowUpdate(BaseModel):
    """Schema for updating an existing workflow."""
    name: Optional[str] = Field(None, description="Updated workflow name")
    workflow_definition: Optional[WorkflowDefinition] = Field(None, description="Updated workflow definition")


class WorkflowResponse(BaseModel):
    """Schema for workflow response."""
    id: UUID = Field(description="Workflow unique identifier")
    user_id: UUID = Field(description="Owner user ID")
    name: Optional[str] = Field(description="Workflow name")
    version: int = Field(description="Workflow version")
    workflow_definition: WorkflowDefinition = Field(description="Complete workflow definition")
    created_at: datetime = Field(description="Creation timestamp")

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response."""
    workflows: List[WorkflowResponse] = Field(description="List of workflows")
    total: int = Field(description="Total number of workflows")


class ConnectionValidationRequest(BaseModel):
    """Schema for validating node connections."""
    source_node_type: str = Field(description="Type of the source node")
    target_node_type: str = Field(description="Type of the target node")
    source_handle: Optional[str] = Field(None, description="Source output handle")
    target_handle: Optional[str] = Field(None, description="Target input handle")


class ConnectionValidationResponse(BaseModel):
    """Schema for connection validation response."""
    valid: bool = Field(description="Whether the connection is valid")
    errors: List[str] = Field(default_factory=list, description="List of validation errors")
    warnings: List[str] = Field(default_factory=list, description="List of validation warnings")


class WorkflowValidationRequest(BaseModel):
    """Schema for validating complete workflow."""
    workflow_definition: WorkflowDefinition = Field(description="Workflow definition to validate")


class WorkflowValidationResponse(BaseModel):
    """Schema for workflow validation response."""
    valid: bool = Field(description="Whether the workflow is valid")
    errors: List[str] = Field(default_factory=list, description="List of validation errors")
    warnings: List[str] = Field(default_factory=list, description="List of validation warnings")
    has_cycles: bool = Field(description="Whether the workflow contains cycles")
    disconnected_nodes: List[str] = Field(default_factory=list, description="List of disconnected node IDs")


# Workflow Run Schemas

class WorkflowRunCreate(BaseModel):
    """Schema for creating a new workflow run."""
    workflow_id: UUID = Field(description="ID of the workflow to execute")
    input_parameters: Optional[Dict[str, Any]] = Field(None, description="Input parameters for the workflow")


class WorkflowRunStatusUpdate(BaseModel):
    """Schema for updating workflow run status."""
    status: str = Field(description="New status for the workflow run")


class WorkflowRunResponse(BaseModel):
    """Schema for workflow run response."""
    id: UUID = Field(description="Workflow run unique identifier")
    workflow_id: UUID = Field(description="Associated workflow ID")
    status: str = Field(description="Current execution status")
    execution_snapshot: Dict[str, Any] = Field(description="Complete execution data and results")
    created_at: datetime = Field(description="Creation timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")

    class Config:
        from_attributes = True


class WorkflowRunListResponse(BaseModel):
    """Schema for workflow run list response."""
    items: List[WorkflowRunResponse] = Field(description="List of workflow runs")
    total: int = Field(description="Total number of workflow runs")
    skip: int = Field(description="Number of items skipped")
    limit: int = Field(description="Maximum number of items returned")


# Approval Workflow Schemas

class PendingApprovalResponse(BaseModel):
    """Schema for pending approval response."""
    node_id: str = Field(description="ID of the node waiting for approval")
    node_type: str = Field(description="Type of the node")
    generated_prompt: Dict[str, Any] = Field(description="Generated structured prompt awaiting approval")
    request_id: str = Field(description="Request ID from the Bria API")


class StructuredPromptApprovalRequest(BaseModel):
    """Schema for approving a structured prompt."""
    approved_prompt: Dict[str, Any] = Field(description="The approved structured prompt data")


class StructuredPromptRejectionRequest(BaseModel):
    """Schema for rejecting a structured prompt."""
    rejection_reason: Optional[str] = Field(None, description="Optional reason for rejection")


class ApprovalActionResponse(BaseModel):
    """Schema for approval action response."""
    success: bool = Field(description="Whether the action was successful")
    message: str = Field(description="Response message")