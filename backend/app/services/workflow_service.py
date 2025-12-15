"""
Service layer for workflow management operations.
"""
from typing import List, Optional, Dict, Any, Set, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Workflow, Node
from app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowDefinition,
    ConnectionValidationResponse, WorkflowValidationResponse
)
from app.schemas.node import SYSTEM_NODE_TYPES


class WorkflowService:
    """Service for managing workflows and validation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_workflow(self, user_id: UUID, workflow_data: WorkflowCreate) -> Workflow:
        """Create a new workflow for a user."""
        # Validate workflow definition against node schemas
        validation_result = self.validate_workflow(workflow_data.workflow_definition)
        if not validation_result.valid:
            raise ValueError(f"Invalid workflow definition: {', '.join(validation_result.errors)}")
        
        # Create workflow instance
        workflow = Workflow(
            user_id=user_id,
            name=workflow_data.name,
            workflow_definition=workflow_data.workflow_definition.model_dump()
        )
        
        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)
        
        return workflow
    
    def get_workflow(self, workflow_id: UUID, user_id: UUID) -> Optional[Workflow]:
        """Get a specific workflow by ID for a user."""
        return self.db.query(Workflow).filter(
            and_(Workflow.id == workflow_id, Workflow.user_id == user_id)
        ).first()
    
    def get_user_workflows(self, user_id: UUID, skip: int = 0, limit: int = 100) -> Tuple[List[Workflow], int]:
        """Get all workflows for a user with pagination."""
        query = self.db.query(Workflow).filter(Workflow.user_id == user_id)
        total = query.count()
        workflows = query.offset(skip).limit(limit).all()
        return workflows, total
    
    def update_workflow(self, workflow_id: UUID, user_id: UUID, workflow_data: WorkflowUpdate) -> Optional[Workflow]:
        """Update an existing workflow."""
        workflow = self.get_workflow(workflow_id, user_id)
        if not workflow:
            return None
        
        # Validate updated workflow definition if provided
        if workflow_data.workflow_definition:
            validation_result = self.validate_workflow(workflow_data.workflow_definition)
            if not validation_result.valid:
                raise ValueError(f"Invalid workflow definition: {', '.join(validation_result.errors)}")
            workflow.workflow_definition = workflow_data.workflow_definition.model_dump()
        
        # Update name if provided
        if workflow_data.name is not None:
            workflow.name = workflow_data.name
        
        self.db.commit()
        self.db.refresh(workflow)
        
        return workflow
    
    def delete_workflow(self, workflow_id: UUID, user_id: UUID) -> bool:
        """Delete a workflow."""
        workflow = self.get_workflow(workflow_id, user_id)
        if not workflow:
            return False
        
        self.db.delete(workflow)
        self.db.commit()
        return True
    
    def validate_connection(self, source_node_type: str, target_node_type: str, 
                          source_handle: Optional[str] = None, 
                          target_handle: Optional[str] = None) -> ConnectionValidationResponse:
        """Validate if two nodes can be connected based on input/output type compatibility."""
        errors = []
        warnings = []
        
        # Check if node types exist in system
        if source_node_type not in SYSTEM_NODE_TYPES:
            errors.append(f"Unknown source node type: {source_node_type}")
        
        if target_node_type not in SYSTEM_NODE_TYPES:
            errors.append(f"Unknown target node type: {target_node_type}")
        
        if errors:
            return ConnectionValidationResponse(valid=False, errors=errors, warnings=warnings)
        
        # Define output types for each node type
        node_outputs = {
            "GenerateImageV2": ["image", "structured_prompt"],  # Outputs image and optionally structured prompt
            "StructuredPromptV2": ["structured_prompt"],  # Outputs structured prompt
            "RefineImageV2": ["image", "structured_prompt"]  # Outputs refined image and structured prompt
        }
        
        # Define input types for each node type
        node_inputs = {
            "GenerateImageV2": ["prompt", "images", "structured_prompt"],  # Can take text, images, or structured prompt
            "StructuredPromptV2": ["prompt", "image"],  # Can take text prompt or image
            "RefineImageV2": ["image", "prompt", "structured_prompt"]  # Takes image and optional prompt or structured prompt
        }
        
        # Get available outputs from source node
        source_outputs = node_outputs.get(source_node_type, [])
        target_inputs = node_inputs.get(target_node_type, [])
        
        # Check if there's any compatible connection
        compatible_types = []
        for output_type in source_outputs:
            for input_type in target_inputs:
                if self._are_types_compatible(output_type, input_type):
                    compatible_types.append((output_type, input_type))
        
        if not compatible_types:
            errors.append(f"No compatible connection between {source_node_type} outputs {source_outputs} and {target_node_type} inputs {target_inputs}")
            return ConnectionValidationResponse(valid=False, errors=errors, warnings=warnings)
        
        # Validate specific handles if provided
        if source_handle and source_handle not in source_outputs:
            errors.append(f"Source handle '{source_handle}' not available in {source_node_type} outputs: {source_outputs}")
        
        if target_handle and target_handle not in target_inputs:
            errors.append(f"Target handle '{target_handle}' not available in {target_node_type} inputs: {target_inputs}")
        
        # Add specific warnings for potentially problematic connections
        if source_node_type == "StructuredPromptV2" and target_node_type == "RefineImageV2":
            warnings.append("StructuredPromptV2 outputs structured prompts, but RefineImageV2 expects images as primary input")
        
        if source_node_type == "GenerateImageV2" and target_node_type == "StructuredPromptV2":
            if source_handle == "structured_prompt":
                warnings.append("Connecting structured_prompt output back to StructuredPromptV2 may create redundancy")
        
        return ConnectionValidationResponse(valid=len(errors) == 0, errors=errors, warnings=warnings)
    
    def _are_types_compatible(self, output_type: str, input_type: str) -> bool:
        """Check if an output type is compatible with an input type."""
        # Define type compatibility rules
        compatibility_map = {
            "image": ["image", "images"],  # Image output can connect to image or images input
            "structured_prompt": ["structured_prompt"],  # Structured prompt to structured prompt
            "prompt": ["prompt"]  # Text prompt to text prompt
        }
        
        return input_type in compatibility_map.get(output_type, [])
    
    def validate_workflow(self, workflow_definition: WorkflowDefinition) -> WorkflowValidationResponse:
        """Validate a complete workflow definition."""
        errors = []
        warnings = []
        
        # Check if workflow has at least one node
        if not workflow_definition.nodes:
            errors.append("Workflow must contain at least one node")
            return WorkflowValidationResponse(
                valid=False, errors=errors, warnings=warnings,
                has_cycles=False, disconnected_nodes=[]
            )
        
        # Check if all node types are valid
        for node in workflow_definition.nodes:
            if node.type not in SYSTEM_NODE_TYPES:
                errors.append(f"Unknown node type: {node.type} in node {node.id}")
            
            # Validate node configuration against schema
            node_validation = self._validate_node_configuration(node)
            errors.extend(node_validation.get("errors", []))
            warnings.extend(node_validation.get("warnings", []))
        
        # Validate all connections
        for edge in workflow_definition.edges:
            source_node = next((n for n in workflow_definition.nodes if n.id == edge.source), None)
            target_node = next((n for n in workflow_definition.nodes if n.id == edge.target), None)
            
            if not source_node:
                errors.append(f"Edge {edge.id} references non-existent source node: {edge.source}")
                continue
            
            if not target_node:
                errors.append(f"Edge {edge.id} references non-existent target node: {edge.target}")
                continue
            
            # Validate connection compatibility
            connection_result = self.validate_connection(
                source_node.type, target_node.type, 
                edge.sourceHandle, edge.targetHandle
            )
            errors.extend(connection_result.errors)
            warnings.extend(connection_result.warnings)
        
        # Check for cycles in the workflow graph
        has_cycles = self._has_cycles(workflow_definition)
        if has_cycles:
            errors.append("Workflow contains cycles, which are not allowed")
        
        # Find disconnected nodes (nodes with no connections)
        disconnected_nodes = self._find_disconnected_nodes(workflow_definition)
        if disconnected_nodes:
            warnings.extend([f"Node {node_id} is not connected to any other nodes" for node_id in disconnected_nodes])
        
        # Check for workflow connectivity (ensure there's a path from start to end)
        connectivity_issues = self._check_workflow_connectivity(workflow_definition)
        warnings.extend(connectivity_issues)
        
        return WorkflowValidationResponse(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            has_cycles=has_cycles,
            disconnected_nodes=disconnected_nodes
        )
    
    def _validate_node_configuration(self, node) -> Dict[str, List[str]]:
        """Validate node configuration against its schema."""
        errors = []
        warnings = []
        
        if node.type not in SYSTEM_NODE_TYPES:
            return {"errors": [f"Unknown node type: {node.type}"], "warnings": []}
        
        # For now, we'll do basic validation
        # In a more complete implementation, we would validate the node.data.config
        # against the input schema for the node type
        
        if not hasattr(node.data, 'config') or not node.data.config:
            warnings.append(f"Node {node.id} has no configuration data")
        
        return {"errors": errors, "warnings": warnings}
    
    def _check_workflow_connectivity(self, workflow_definition: WorkflowDefinition) -> List[str]:
        """Check for workflow connectivity issues."""
        warnings = []
        
        if not workflow_definition.edges:
            if len(workflow_definition.nodes) > 1:
                warnings.append("Workflow has multiple nodes but no connections between them")
            return warnings
        
        # Find nodes with no incoming edges (potential start nodes)
        nodes_with_incoming = {edge.target for edge in workflow_definition.edges}
        start_nodes = [node.id for node in workflow_definition.nodes if node.id not in nodes_with_incoming]
        
        # Find nodes with no outgoing edges (potential end nodes)
        nodes_with_outgoing = {edge.source for edge in workflow_definition.edges}
        end_nodes = [node.id for node in workflow_definition.nodes if node.id not in nodes_with_outgoing]
        
        if not start_nodes:
            warnings.append("Workflow has no clear starting point (all nodes have incoming connections)")
        
        if not end_nodes:
            warnings.append("Workflow has no clear ending point (all nodes have outgoing connections)")
        
        return warnings
    
    def _has_cycles(self, workflow_definition: WorkflowDefinition) -> bool:
        """Check if the workflow graph contains cycles using DFS."""
        # Build adjacency list
        graph = {}
        for node in workflow_definition.nodes:
            graph[node.id] = []
        
        for edge in workflow_definition.edges:
            if edge.source in graph:
                graph[edge.source].append(edge.target)
        
        # DFS to detect cycles
        visited = set()
        rec_stack = set()
        
        def dfs(node_id: str) -> bool:
            if node_id in rec_stack:
                return True  # Cycle detected
            if node_id in visited:
                return False
            
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in graph.get(node_id, []):
                if dfs(neighbor):
                    return True
            
            rec_stack.remove(node_id)
            return False
        
        for node_id in graph:
            if node_id not in visited:
                if dfs(node_id):
                    return True
        
        return False
    
    def _find_disconnected_nodes(self, workflow_definition: WorkflowDefinition) -> List[str]:
        """Find nodes that have no incoming or outgoing connections."""
        connected_nodes = set()
        
        for edge in workflow_definition.edges:
            connected_nodes.add(edge.source)
            connected_nodes.add(edge.target)
        
        all_nodes = {node.id for node in workflow_definition.nodes}
        disconnected = list(all_nodes - connected_nodes)
        
        return disconnected