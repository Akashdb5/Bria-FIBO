"""
Service for node type management and validation.
"""
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.node import Node
from app.schemas.node import (
    NodeSchema, NodeCreate, NodeValidationRequest, NodeValidationResponse,
    ImageGenerateV2Input, ImageGenerateLiteV2Input,
    StructuredPromptGenerateV2Input, StructuredPromptGenerateLiteV2Input,
    ImageRefineV2Input, ImageRefineLiteV2Input,
    SYSTEM_NODE_TYPES
)


class NodeService:
    """Service for managing node types and validation."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_node_type(self, node_type: str) -> Optional[Node]:
        """Get a node type definition by type name."""
        return self.db.query(Node).filter(Node.node_type == node_type).first()
    
    def get_all_node_types(self) -> List[Node]:
        """Get all available node type definitions."""
        return self.db.query(Node).all()
    
    def create_node_type(self, node_data: NodeCreate) -> Node:
        """Create a new node type definition."""
        node = Node(
            node_type=node_data.node_type,
            description=node_data.description,
            input_schema=node_data.input_schema,
            output_schema=node_data.output_schema
        )
        self.db.add(node)
        self.db.commit()
        self.db.refresh(node)
        return node
    
    def validate_node_configuration(self, node_type: str, configuration: Dict[str, Any]) -> NodeValidationResponse:
        """Validate a node configuration against its schema."""
        errors = []
        warnings = []
        
        # Check if node type exists
        node = self.get_node_type(node_type)
        if not node:
            errors.append(f"Unknown node type: {node_type}")
            return NodeValidationResponse(valid=False, errors=errors)
        
        # Validate configuration against the appropriate Pydantic model
        try:
            if node_type == "ImageGenerateV2":
                ImageGenerateV2Input(**configuration)
            elif node_type == "ImageGenerateLiteV2":
                ImageGenerateLiteV2Input(**configuration)
            elif node_type == "StructuredPromptGenerateV2":
                StructuredPromptGenerateV2Input(**configuration)
            elif node_type == "StructuredPromptGenerateLiteV2":
                StructuredPromptGenerateLiteV2Input(**configuration)
            elif node_type == "ImageRefineV2":
                ImageRefineV2Input(**configuration)
            elif node_type == "ImageRefineLiteV2":
                ImageRefineLiteV2Input(**configuration)
            else:
                # For custom node types, validate against stored schema
                # This would require more complex validation logic
                warnings.append(f"Custom node type validation not fully implemented: {node_type}")
        
        except ValidationError as e:
            for error in e.errors():
                field_path = " -> ".join(str(loc) for loc in error["loc"])
                errors.append(f"{field_path}: {error['msg']}")
        
        return NodeValidationResponse(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def seed_system_node_types(self) -> List[Node]:
        """Seed the database with system node type definitions."""
        created_nodes = []
        
        for node_type, definition in SYSTEM_NODE_TYPES.items():
            # Check if node type already exists
            existing_node = self.get_node_type(node_type)
            if existing_node:
                # Update existing node with latest schema
                existing_node.description = definition["description"]
                existing_node.input_schema = definition["input_schema"]
                existing_node.output_schema = definition["output_schema"]
                self.db.commit()
                created_nodes.append(existing_node)
            else:
                # Create new node type
                node_data = NodeCreate(
                    node_type=node_type,
                    description=definition["description"],
                    input_schema=definition["input_schema"],
                    output_schema=definition["output_schema"]
                )
                node = self.create_node_type(node_data)
                created_nodes.append(node)
        
        return created_nodes
    
    def validate_workflow_nodes(self, workflow_definition: Dict[str, Any]) -> NodeValidationResponse:
        """Validate all nodes in a workflow definition."""
        errors = []
        warnings = []
        
        nodes = workflow_definition.get("nodes", [])
        
        for node in nodes:
            node_type = node.get("type")
            node_data = node.get("data", {})
            node_id = node.get("id", "unknown")
            
            if not node_type:
                errors.append(f"Node {node_id}: Missing node type")
                continue
            
            # Validate individual node configuration
            validation_result = self.validate_node_configuration(node_type, node_data)
            
            if not validation_result.valid:
                for error in validation_result.errors:
                    errors.append(f"Node {node_id} ({node_type}): {error}")
            
            warnings.extend([f"Node {node_id} ({node_type}): {warning}" 
                           for warning in validation_result.warnings])
        
        return NodeValidationResponse(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )