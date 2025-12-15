"""
Service layer for workflow execution orchestration.
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, Tuple
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.orm.attributes import flag_modified

from app.models import WorkflowRun, Workflow, Node
from app.clients.bria_client import (
    BriaAPIClient, create_bria_client,
    ImageGenerateV2Request, ImageGenerateLiteV2Request,
    StructuredPromptGenerateV2Request, StructuredPromptGenerateLiteV2Request,
    ImageGenerateV2Response, ImageGenerateLiteV2Response,
    StructuredPromptGenerateV2Response, StructuredPromptGenerateLiteV2Response,
    BriaAPIError, AsyncOperationStatus
)
from app.schemas.workflow import WorkflowDefinition, WorkflowNode, WorkflowEdge
from app.core.exceptions import ExecutionError, NodeExecutionError, ValidationError
from app.core.logging_config import get_logger


logger = get_logger(__name__)


# Using ExecutionError and NodeExecutionError from core.exceptions


class WorkflowExecutionService:
    """Service for orchestrating workflow execution."""
    
    def __init__(self, db: Session, bria_client: Optional[BriaAPIClient] = None):
        self.db = db
        self.bria_client = bria_client or create_bria_client()
    
    async def create_workflow_run(
        self, 
        workflow_id: UUID, 
        user_id: UUID, 
        input_parameters: Optional[Dict[str, Any]] = None
    ) -> WorkflowRun:
        """
        Create a new workflow run and initialize execution snapshot.
        
        Args:
            workflow_id: ID of the workflow to execute
            user_id: ID of the user executing the workflow
            input_parameters: Optional input parameters for the workflow
            
        Returns:
            Created WorkflowRun instance
            
        Raises:
            ValueError: If workflow not found or invalid
        """
        # Get workflow
        workflow = self.db.query(Workflow).filter(
            and_(Workflow.id == workflow_id, Workflow.user_id == user_id)
        ).first()
        
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found for user {user_id}")
        
        # Initialize execution snapshot
        execution_snapshot = {
            "workflow_definition": workflow.workflow_definition,
            "input_parameters": input_parameters or {},
            "nodes": {},
            "execution_order": [],
            "start_time": datetime.utcnow().isoformat(),
            "end_time": None,
            "error": None
        }
        
        # Create workflow run
        workflow_run = WorkflowRun(
            workflow_id=workflow_id,
            status="PENDING",
            execution_snapshot=execution_snapshot
        )
        
        self.db.add(workflow_run)
        self.db.commit()
        self.db.refresh(workflow_run)
        
        logger.info(f"Created workflow run {workflow_run.id} for workflow {workflow_id}")
        return workflow_run
    
    async def execute_workflow_run(self, workflow_run_id: UUID) -> WorkflowRun:
        """
        Execute a workflow run step by step.
        
        Args:
            workflow_run_id: ID of the workflow run to execute
            
        Returns:
            Updated WorkflowRun instance
            
        Raises:
            ExecutionError: If execution fails
        """
        # Get workflow run
        workflow_run = self.db.query(WorkflowRun).filter(
            WorkflowRun.id == workflow_run_id
        ).first()
        
        if not workflow_run:
            raise ExecutionError(f"Workflow run {workflow_run_id} not found")
        
        if workflow_run.status not in ["PENDING", "WAITING_APPROVAL"]:
            raise ExecutionError(f"Workflow run {workflow_run_id} is not in executable state: {workflow_run.status}")
        
        try:
            # Update status to running
            workflow_run.status = "RUNNING"
            workflow_run.execution_snapshot["start_time"] = datetime.utcnow().isoformat()
            self.db.commit()
            
            # Parse workflow definition
            workflow_def = WorkflowDefinition(**workflow_run.execution_snapshot["workflow_definition"])
            
            # Determine execution order
            execution_order = self._determine_execution_order(workflow_def)
            workflow_run.execution_snapshot["execution_order"] = execution_order
            
            # Execute nodes in order
            for node_id in execution_order:
                node = next((n for n in workflow_def.nodes if n.id == node_id), None)
                if not node:
                    raise ExecutionError(f"Node {node_id} not found in workflow definition")
                
                # Check if node requires approval and is waiting
                if self._node_requires_approval(node) and self._is_node_waiting_approval(workflow_run, node_id):
                    workflow_run.status = "WAITING_APPROVAL"
                    self.db.commit()
                    logger.info(f"Workflow run {workflow_run_id} waiting for approval on node {node_id}")
                    return workflow_run
                
                # Execute node
                await self._execute_node(workflow_run, node, workflow_def)
                
                # Update execution snapshot
                flag_modified(workflow_run, "execution_snapshot")
                self.db.commit()
            
            # Mark as completed
            workflow_run.status = "COMPLETED"
            workflow_run.execution_snapshot["end_time"] = datetime.utcnow().isoformat()
            workflow_run.completed_at = datetime.utcnow()
            self.db.commit()
            
            logger.info(f"Completed workflow run {workflow_run_id}")
            return workflow_run
            
        except Exception as e:
            # Mark as failed and store error
            workflow_run.status = "FAILED"
            workflow_run.execution_snapshot["error"] = str(e)
            workflow_run.execution_snapshot["end_time"] = datetime.utcnow().isoformat()
            workflow_run.completed_at = datetime.utcnow()
            self.db.commit()
            
            logger.error(f"Failed workflow run {workflow_run_id}: {e}")
            raise ExecutionError(f"Workflow execution failed: {e}") from e
    
    def _determine_execution_order(self, workflow_def: WorkflowDefinition) -> List[str]:
        """
        Determine the order in which nodes should be executed using topological sort.
        
        Args:
            workflow_def: Workflow definition
            
        Returns:
            List of node IDs in execution order
            
        Raises:
            ExecutionError: If workflow has cycles or other issues
        """
        # Build adjacency list and in-degree count
        graph = {}
        in_degree = {}
        
        # Initialize all nodes
        for node in workflow_def.nodes:
            graph[node.id] = []
            in_degree[node.id] = 0
        
        # Build graph from edges
        for edge in workflow_def.edges:
            if edge.source not in graph or edge.target not in graph:
                raise ExecutionError(f"Edge references non-existent node: {edge.source} -> {edge.target}")
            
            graph[edge.source].append(edge.target)
            in_degree[edge.target] += 1
        
        # Topological sort using Kahn's algorithm
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        execution_order = []
        
        while queue:
            current = queue.pop(0)
            execution_order.append(current)
            
            # Remove edges from current node
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # Check for cycles
        if len(execution_order) != len(workflow_def.nodes):
            raise ExecutionError("Workflow contains cycles and cannot be executed")
        
        return execution_order
    
    def _node_requires_approval(self, node: WorkflowNode) -> bool:
        """Check if a node requires user approval before proceeding."""
        return node.type in ["StructuredPromptGenerateV2", "StructuredPromptGenerateLiteV2"]
    
    def _is_node_waiting_approval(self, workflow_run: WorkflowRun, node_id: str) -> bool:
        """Check if a node is waiting for approval."""
        node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node_id, {})
        return node_data.get("status") == "WAITING_APPROVAL"
    
    async def _execute_node(
        self, 
        workflow_run: WorkflowRun, 
        node: WorkflowNode, 
        workflow_def: WorkflowDefinition
    ) -> None:
        """
        Execute a single node in the workflow.
        
        Args:
            workflow_run: Current workflow run
            node: Node to execute
            workflow_def: Complete workflow definition
            
        Raises:
            NodeExecutionError: If node execution fails
        """
        logger.info(f"Executing node {node.id} of type {node.type}")
        
        try:
            # Initialize node execution data
            node_data = {
                "node_type": node.type,
                "status": "RUNNING",
                "start_time": datetime.utcnow().isoformat(),
                "end_time": None,
                "request": None,
                "response": None,
                "error": None
            }
            
            # Store initial node data
            workflow_run.execution_snapshot.setdefault("nodes", {})[node.id] = node_data
            
            # Prepare node inputs from previous nodes and configuration
            node_inputs = self._prepare_node_inputs(workflow_run, node, workflow_def)
            
            # Execute based on node type
            if node.type == "ImageGenerateV2":
                response = await self._execute_image_generate_v2(workflow_run, node, node_inputs)
            elif node.type == "ImageGenerateLiteV2":
                response = await self._execute_image_generate_lite_v2(workflow_run, node, node_inputs)
            elif node.type == "StructuredPromptGenerateV2":
                response = await self._execute_structured_prompt_generate_v2(workflow_run, node, node_inputs)
            elif node.type == "StructuredPromptGenerateLiteV2":
                response = await self._execute_structured_prompt_generate_lite_v2(workflow_run, node, node_inputs)
            elif node.type == "ImageRefineV2":
                response = await self._execute_image_refine_v2(workflow_run, node, node_inputs)
            elif node.type == "ImageRefineLiteV2":
                response = await self._execute_image_refine_lite_v2(workflow_run, node, node_inputs)
            else:
                raise NodeExecutionError(node.id, f"Unknown node type: {node.type}")
            
            # Store successful execution results
            node_data["status"] = "COMPLETED"
            node_data["end_time"] = datetime.utcnow().isoformat()
            node_data["response"] = response.model_dump() if hasattr(response, 'model_dump') else response
            
            logger.info(f"Completed node {node.id}")
            
        except Exception as e:
            # Store error information
            node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node.id, {})
            node_data["status"] = "FAILED"
            node_data["end_time"] = datetime.utcnow().isoformat()
            node_data["error"] = str(e)
            
            logger.error(f"Failed to execute node {node.id}: {e}")
            raise NodeExecutionError(node.id, str(e), e)
    
    def _prepare_node_inputs(
        self, 
        workflow_run: WorkflowRun, 
        node: WorkflowNode, 
        workflow_def: WorkflowDefinition
    ) -> Dict[str, Any]:
        """
        Prepare inputs for a node from previous node outputs and configuration.
        
        Args:
            workflow_run: Current workflow run
            node: Node to prepare inputs for
            workflow_def: Complete workflow definition
            
        Returns:
            Dictionary of prepared inputs for the node
        """
        inputs = {}
        
        # Start with node configuration
        if hasattr(node.data, 'config') and node.data.config:
            inputs.update(node.data.config)
        
        # Add inputs from connected nodes
        for edge in workflow_def.edges:
            if edge.target == node.id:
                source_node_data = workflow_run.execution_snapshot.get("nodes", {}).get(edge.source, {})
                source_response = source_node_data.get("response", {})
                
                if not source_response:
                    continue
                
                # Map outputs based on edge handles
                if edge.sourceHandle and edge.targetHandle:
                    if edge.sourceHandle in source_response:
                        inputs[edge.targetHandle] = source_response[edge.sourceHandle]
                else:
                    # Default mapping based on node types
                    source_node = next((n for n in workflow_def.nodes if n.id == edge.source), None)
                    if source_node:
                        self._map_default_outputs(source_node.type, source_response, node.type, inputs)
        
        # Add global input parameters
        global_inputs = workflow_run.execution_snapshot.get("input_parameters", {})
        inputs.update(global_inputs)
        
        return inputs
    
    def _map_default_outputs(
        self, 
        source_type: str, 
        source_response: Dict[str, Any], 
        target_type: str, 
        inputs: Dict[str, Any]
    ) -> None:
        """Map outputs from source node to inputs for target node using default rules."""
        
        # Image generation outputs (both regular and lite)
        if source_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
            if "image_url" in source_response:
                # Map image output to various target types
                if target_type in ["StructuredPromptGenerateV2", "StructuredPromptGenerateLiteV2"]:
                    inputs.setdefault("images", []).append(source_response["image_url"])
                elif target_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
                    inputs.setdefault("images", []).append(source_response["image_url"])
            
            if "structured_prompt" in source_response:
                if target_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
                    inputs["structured_prompt"] = source_response["structured_prompt"]
        
        # Structured prompt generation outputs (both regular and lite)
        elif source_type in ["StructuredPromptGenerateV2", "StructuredPromptGenerateLiteV2"]:
            if "structured_prompt" in source_response:
                if target_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
                    inputs["structured_prompt"] = source_response["structured_prompt"]
        
        # Image refinement outputs (both regular and lite)
        elif source_type in ["ImageRefineV2", "ImageRefineLiteV2"]:
            if "refined_image_url" in source_response:
                # Map refined image output to various target types
                if target_type in ["StructuredPromptGenerateV2", "StructuredPromptGenerateLiteV2"]:
                    inputs.setdefault("images", []).append(source_response["refined_image_url"])
                elif target_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
                    inputs.setdefault("images", []).append(source_response["refined_image_url"])
                elif target_type in ["ImageRefineV2", "ImageRefineLiteV2"]:
                    inputs["image_url"] = source_response["refined_image_url"]
            
            if "refined_structured_prompt" in source_response:
                if target_type in ["ImageGenerateV2", "ImageGenerateLiteV2"]:
                    inputs["structured_prompt"] = source_response["refined_structured_prompt"]
    
    async def _execute_image_generate_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> ImageGenerateV2Response:
        """Execute ImageGenerateV2 node using /image/generate endpoint with Gemini 2.5 Flash VLM bridge."""
        
        # Prepare request data based on valid input combinations
        request_data = {}
        
        # Handle input combinations per API documentation
        if "structured_prompt" in inputs and "prompt" in inputs:
            # Refinement: structured_prompt + prompt
            request_data["structured_prompt"] = inputs["structured_prompt"]
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs and "prompt" in inputs:
            # Image + text guidance: images + prompt
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
            request_data["prompt"] = inputs["prompt"]
        elif "prompt" in inputs:
            # Text-to-image: prompt only
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs:
            # Image-to-image: images only
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
        elif "structured_prompt" in inputs:
            # Structured prompt recreation: structured_prompt only
            request_data["structured_prompt"] = inputs["structured_prompt"]
        else:
            raise NodeExecutionError(
                node.id, 
                "No valid input combination provided. Required: 'prompt', 'images', 'structured_prompt', 'images+prompt', or 'structured_prompt+prompt'"
            )
        
        # Add optional parameters
        for param in ["aspect_ratio", "steps_num", "seed"]:
            if param in inputs:
                request_data[param] = inputs[param]
        
        request = ImageGenerateV2Request(**request_data)
        
        # Store request in node data
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = request.model_dump()
        
        # Make API call
        async with self.bria_client as client:
            response = await client.image_generate_v2(request, wait_for_completion=True)
        
        return response
    
    async def _execute_image_generate_lite_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> ImageGenerateLiteV2Response:
        """Execute ImageGenerateLiteV2 node using /image/generate/lite endpoint with FIBO-VLM bridge."""
        
        # Prepare request data (same logic as regular generate but using lite endpoint)
        request_data = {}
        
        # Handle input combinations per API documentation
        if "structured_prompt" in inputs and "prompt" in inputs:
            request_data["structured_prompt"] = inputs["structured_prompt"]
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs and "prompt" in inputs:
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
            request_data["prompt"] = inputs["prompt"]
        elif "prompt" in inputs:
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs:
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
        elif "structured_prompt" in inputs:
            request_data["structured_prompt"] = inputs["structured_prompt"]
        else:
            raise NodeExecutionError(
                node.id, 
                "No valid input combination provided. Required: 'prompt', 'images', 'structured_prompt', 'images+prompt', or 'structured_prompt+prompt'"
            )
        
        # Add optional parameters
        for param in ["aspect_ratio", "steps_num", "seed"]:
            if param in inputs:
                request_data[param] = inputs[param]
        
        request = ImageGenerateLiteV2Request(**request_data)
        
        # Store request in node data
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = request.model_dump()
        
        # Make API call
        async with self.bria_client as client:
            response = await client.image_generate_lite_v2(request, wait_for_completion=True)
        
        return response
    
    async def _execute_structured_prompt_generate_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> StructuredPromptGenerateV2Response:
        """Execute StructuredPromptGenerateV2 node using /structured_prompt/generate endpoint with Gemini 2.5 Flash VLM bridge."""
        
        # Check if this node is resuming from approval
        node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node.id, {})
        if node_data.get("status") == "WAITING_APPROVAL" and node_data.get("approved_prompt"):
            # Use the approved structured prompt
            response_data = {
                "request_id": node_data.get("request_id", "approved"),
                "status": AsyncOperationStatus.COMPLETED,
                "structured_prompt": node_data["approved_prompt"]
            }
            return StructuredPromptGenerateV2Response(**response_data)
        
        # Prepare request based on valid input combinations
        request_data = {}
        
        # Handle input combinations per API documentation
        if "structured_prompt" in inputs and "prompt" in inputs:
            # Refinement: structured_prompt + prompt
            request_data["structured_prompt"] = inputs["structured_prompt"]
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs and "prompt" in inputs:
            # Image + text analysis: images + prompt
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
            request_data["prompt"] = inputs["prompt"]
        elif "prompt" in inputs:
            # Text-to-structured-prompt: prompt only
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs:
            # Image-to-structured-prompt: images only
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
        else:
            raise NodeExecutionError(
                node.id, 
                "No valid input combination provided. Required: 'prompt', 'images', 'images+prompt', or 'structured_prompt+prompt'"
            )
        
        request = StructuredPromptGenerateV2Request(**request_data)
        
        # Store request in node data
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = request.model_dump()
        
        # Make API call
        async with self.bria_client as client:
            response = await client.structured_prompt_generate_v2(request, wait_for_completion=True)
        
        # Store the generated structured prompt for approval
        workflow_run.execution_snapshot["nodes"][node.id]["generated_prompt"] = response.structured_prompt
        workflow_run.execution_snapshot["nodes"][node.id]["request_id"] = response.request_id
        workflow_run.execution_snapshot["nodes"][node.id]["status"] = "WAITING_APPROVAL"
        
        # The workflow will pause here - execution will resume when user approves
        return response
    
    async def _execute_structured_prompt_generate_lite_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> StructuredPromptGenerateLiteV2Response:
        """Execute StructuredPromptGenerateLiteV2 node using /structured_prompt/generate/lite endpoint with FIBO-VLM bridge."""
        
        # Check if this node is resuming from approval
        node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node.id, {})
        if node_data.get("status") == "WAITING_APPROVAL" and node_data.get("approved_prompt"):
            # Use the approved structured prompt
            response_data = {
                "request_id": node_data.get("request_id", "approved"),
                "status": AsyncOperationStatus.COMPLETED,
                "structured_prompt": node_data["approved_prompt"]
            }
            return StructuredPromptGenerateLiteV2Response(**response_data)
        
        # Prepare request (same logic as regular structured prompt generate but using lite endpoint)
        request_data = {}
        
        # Handle input combinations per API documentation
        if "structured_prompt" in inputs and "prompt" in inputs:
            request_data["structured_prompt"] = inputs["structured_prompt"]
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs and "prompt" in inputs:
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
            request_data["prompt"] = inputs["prompt"]
        elif "prompt" in inputs:
            request_data["prompt"] = inputs["prompt"]
        elif "images" in inputs:
            request_data["images"] = inputs["images"] if isinstance(inputs["images"], list) else [inputs["images"]]
        else:
            raise NodeExecutionError(
                node.id, 
                "No valid input combination provided. Required: 'prompt', 'images', 'images+prompt', or 'structured_prompt+prompt'"
            )
        
        request = StructuredPromptGenerateLiteV2Request(**request_data)
        
        # Store request in node data
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = request.model_dump()
        
        # Make API call
        async with self.bria_client as client:
            response = await client.structured_prompt_generate_lite_v2(request, wait_for_completion=True)
        
        # Store the generated structured prompt for approval
        workflow_run.execution_snapshot["nodes"][node.id]["generated_prompt"] = response.structured_prompt
        workflow_run.execution_snapshot["nodes"][node.id]["request_id"] = response.request_id
        workflow_run.execution_snapshot["nodes"][node.id]["status"] = "WAITING_APPROVAL"
        
        # The workflow will pause here - execution will resume when user approves
        return response
    

    
    async def get_workflow_run(self, workflow_run_id: UUID, user_id: UUID) -> Optional[WorkflowRun]:
        """Get a workflow run by ID for a specific user."""
        return self.db.query(WorkflowRun).join(Workflow).filter(
            and_(
                WorkflowRun.id == workflow_run_id,
                Workflow.user_id == user_id
            )
        ).first()
    
    async def get_user_workflow_runs(
        self, 
        user_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> Tuple[List[WorkflowRun], int]:
        """Get all workflow runs for a user with pagination."""
        query = self.db.query(WorkflowRun).join(Workflow).filter(Workflow.user_id == user_id)
        total = query.count()
        runs = query.order_by(WorkflowRun.created_at.desc()).offset(skip).limit(limit).all()
        return runs, total
    
    async def update_workflow_run_status(
        self, 
        workflow_run_id: UUID, 
        status: str, 
        user_id: UUID
    ) -> Optional[WorkflowRun]:
        """Update the status of a workflow run."""
        workflow_run = await self.get_workflow_run(workflow_run_id, user_id)
        if not workflow_run:
            return None
        
        workflow_run.status = status
        if status in ["COMPLETED", "FAILED"]:
            workflow_run.completed_at = datetime.utcnow()
            workflow_run.execution_snapshot["end_time"] = datetime.utcnow().isoformat()
        
        self.db.commit()
        self.db.refresh(workflow_run)
        return workflow_run
    
    async def get_pending_approvals(
        self, 
        workflow_run_id: UUID, 
        user_id: UUID
    ) -> List[Dict[str, Any]]:
        """Get all nodes waiting for approval in a workflow run."""
        workflow_run = await self.get_workflow_run(workflow_run_id, user_id)
        if not workflow_run:
            return []
        
        pending_approvals = []
        nodes = workflow_run.execution_snapshot.get("nodes", {})
        
        for node_id, node_data in nodes.items():
            if node_data.get("status") == "WAITING_APPROVAL":
                pending_approvals.append({
                    "node_id": node_id,
                    "node_type": node_data.get("node_type"),
                    "generated_prompt": node_data.get("generated_prompt"),
                    "request_id": node_data.get("request_id")
                })
        
        return pending_approvals
    
    async def approve_structured_prompt(
        self,
        workflow_run_id: UUID,
        node_id: str,
        approved_prompt: Dict[str, Any],
        user_id: UUID
    ) -> bool:
        """
        Approve a structured prompt and continue workflow execution.
        
        Args:
            workflow_run_id: ID of the workflow run
            node_id: ID of the node waiting for approval
            approved_prompt: The approved structured prompt data
            user_id: ID of the user approving
            
        Returns:
            True if approval was successful, False otherwise
        """
        workflow_run = await self.get_workflow_run(workflow_run_id, user_id)
        if not workflow_run:
            return False
        
        # Check if the node is waiting for approval
        node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node_id, {})
        if node_data.get("status") != "WAITING_APPROVAL":
            return False
        
        # Store the approved prompt
        workflow_run.execution_snapshot["nodes"][node_id]["approved_prompt"] = approved_prompt
        workflow_run.execution_snapshot["nodes"][node_id]["approval_time"] = datetime.utcnow().isoformat()
        
        # Update workflow run status to continue execution
        workflow_run.status = "PENDING"  # Will be picked up by execution engine
        
        self.db.commit()
        return True
    
    async def reject_structured_prompt(
        self,
        workflow_run_id: UUID,
        node_id: str,
        rejection_reason: Optional[str],
        user_id: UUID
    ) -> bool:
        """
        Reject a structured prompt and halt workflow execution.
        
        Args:
            workflow_run_id: ID of the workflow run
            node_id: ID of the node waiting for approval
            rejection_reason: Optional reason for rejection
            user_id: ID of the user rejecting
            
        Returns:
            True if rejection was successful, False otherwise
        """
        workflow_run = await self.get_workflow_run(workflow_run_id, user_id)
        if not workflow_run:
            return False
        
        # Check if the node is waiting for approval
        node_data = workflow_run.execution_snapshot.get("nodes", {}).get(node_id, {})
        if node_data.get("status") != "WAITING_APPROVAL":
            return False
        
        # Store rejection information
        workflow_run.execution_snapshot["nodes"][node_id]["status"] = "REJECTED"
        workflow_run.execution_snapshot["nodes"][node_id]["rejection_reason"] = rejection_reason
        workflow_run.execution_snapshot["nodes"][node_id]["rejection_time"] = datetime.utcnow().isoformat()
        
        # Mark workflow as failed
        workflow_run.status = "FAILED"
        workflow_run.execution_snapshot["error"] = f"Structured prompt rejected for node {node_id}: {rejection_reason}"
        workflow_run.execution_snapshot["end_time"] = datetime.utcnow().isoformat()
        workflow_run.completed_at = datetime.utcnow()
        
        self.db.commit()
        return True
    
    async def _execute_image_refine_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute ImageRefineV2 node using v2 API workflow pattern.
        
        This implements the refinement workflow from the v2 API documentation:
        1. Extract structured prompt from the original image
        2. Generate refined image using structured prompt + refinement prompt
        """
        
        if "image_url" not in inputs:
            raise NodeExecutionError(node.id, "image_url is required for ImageRefineV2")
        
        if "refinement_prompt" not in inputs:
            raise NodeExecutionError(node.id, "refinement_prompt is required for ImageRefineV2")
        
        image_url = inputs["image_url"]
        refinement_prompt = inputs["refinement_prompt"]
        
        # Step 1: Extract structured prompt from the original image
        logger.info(f"ImageRefineV2 Step 1: Extracting structured prompt from image for node {node.id}")
        
        structured_prompt_request = StructuredPromptGenerateV2Request(images=[image_url])
        
        async with self.bria_client as client:
            structured_prompt_response = await client.structured_prompt_generate_v2(
                structured_prompt_request, 
                wait_for_completion=True
            )
        
        if not structured_prompt_response.structured_prompt:
            raise NodeExecutionError(
                node.id, 
                "Failed to extract structured prompt from image in ImageRefineV2 step 1"
            )
        
        # Store step 1 results
        workflow_run.execution_snapshot["nodes"][node.id]["step1_request"] = structured_prompt_request.model_dump()
        workflow_run.execution_snapshot["nodes"][node.id]["step1_response"] = structured_prompt_response.model_dump()
        
        # Step 2: Generate refined image using structured prompt + refinement prompt
        logger.info(f"ImageRefineV2 Step 2: Generating refined image for node {node.id}")
        
        # Prepare ImageGenerateV2 request with structured prompt + refinement prompt
        generate_request_data = {
            "structured_prompt": structured_prompt_response.structured_prompt,
            "prompt": refinement_prompt  # This will refine the structured prompt
        }
        
        # Add optional parameters from node configuration
        for param in ["aspect_ratio", "steps_num", "seed"]:
            if param in inputs:
                generate_request_data[param] = inputs[param]
        
        generate_request = ImageGenerateV2Request(**generate_request_data)
        
        async with self.bria_client as client:
            generate_response = await client.image_generate_v2(
                generate_request, 
                wait_for_completion=True
            )
        
        # Store step 2 results
        workflow_run.execution_snapshot["nodes"][node.id]["step2_request"] = generate_request.model_dump()
        workflow_run.execution_snapshot["nodes"][node.id]["step2_response"] = generate_response.model_dump()
        
        # Create ImageRefineV2 response with combined results
        refine_response = {
            "request_id": generate_response.request_id,
            "original_image_url": image_url,
            "refined_image_url": generate_response.image_url,
            "original_structured_prompt": structured_prompt_response.structured_prompt,
            "refined_structured_prompt": generate_response.structured_prompt,
            "seed": generate_response.seed
        }
        
        # Store the complete request for the two-step process
        complete_request = {
            "image_url": image_url,
            "refinement_prompt": refinement_prompt,
            "aspect_ratio": inputs.get("aspect_ratio", "1:1"),
            "steps_num": inputs.get("steps_num", 50),
            "seed": inputs.get("seed")
        }
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = complete_request
        
        logger.info(f"ImageRefineV2 completed two-step refinement process for node {node.id}")
        return refine_response
    
    async def _execute_image_refine_lite_v2(
        self, 
        workflow_run: WorkflowRun,
        node: WorkflowNode, 
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute ImageRefineLiteV2 node using v2 lite API workflow pattern.
        
        Same as ImageRefineV2 but uses the lite endpoints with FIBO-VLM bridge.
        """
        
        if "image_url" not in inputs:
            raise NodeExecutionError(node.id, "image_url is required for ImageRefineLiteV2")
        
        if "refinement_prompt" not in inputs:
            raise NodeExecutionError(node.id, "refinement_prompt is required for ImageRefineLiteV2")
        
        image_url = inputs["image_url"]
        refinement_prompt = inputs["refinement_prompt"]
        
        # Step 1: Extract structured prompt from the original image using lite endpoint
        logger.info(f"ImageRefineLiteV2 Step 1: Extracting structured prompt from image for node {node.id}")
        
        structured_prompt_request = StructuredPromptGenerateLiteV2Request(images=[image_url])
        
        async with self.bria_client as client:
            structured_prompt_response = await client.structured_prompt_generate_lite_v2(
                structured_prompt_request, 
                wait_for_completion=True
            )
        
        if not structured_prompt_response.structured_prompt:
            raise NodeExecutionError(
                node.id, 
                "Failed to extract structured prompt from image in ImageRefineLiteV2 step 1"
            )
        
        # Store step 1 results
        workflow_run.execution_snapshot["nodes"][node.id]["step1_request"] = structured_prompt_request.model_dump()
        workflow_run.execution_snapshot["nodes"][node.id]["step1_response"] = structured_prompt_response.model_dump()
        
        # Step 2: Generate refined image using lite endpoint
        logger.info(f"ImageRefineLiteV2 Step 2: Generating refined image for node {node.id}")
        
        # Prepare ImageGenerateLiteV2 request with structured prompt + refinement prompt
        generate_request_data = {
            "structured_prompt": structured_prompt_response.structured_prompt,
            "prompt": refinement_prompt  # This will refine the structured prompt
        }
        
        # Add optional parameters from node configuration
        for param in ["aspect_ratio", "steps_num", "seed"]:
            if param in inputs:
                generate_request_data[param] = inputs[param]
        
        generate_request = ImageGenerateLiteV2Request(**generate_request_data)
        
        async with self.bria_client as client:
            generate_response = await client.image_generate_lite_v2(
                generate_request, 
                wait_for_completion=True
            )
        
        # Store step 2 results
        workflow_run.execution_snapshot["nodes"][node.id]["step2_request"] = generate_request.model_dump()
        workflow_run.execution_snapshot["nodes"][node.id]["step2_response"] = generate_response.model_dump()
        
        # Create ImageRefineLiteV2 response with combined results
        refine_response = {
            "request_id": generate_response.request_id,
            "original_image_url": image_url,
            "refined_image_url": generate_response.image_url,
            "original_structured_prompt": structured_prompt_response.structured_prompt,
            "refined_structured_prompt": generate_response.structured_prompt,
            "seed": generate_response.seed
        }
        
        # Store the complete request for the two-step process
        complete_request = {
            "image_url": image_url,
            "refinement_prompt": refinement_prompt,
            "aspect_ratio": inputs.get("aspect_ratio", "1:1"),
            "steps_num": inputs.get("steps_num", 50),
            "seed": inputs.get("seed")
        }
        workflow_run.execution_snapshot["nodes"][node.id]["request"] = complete_request
        
        logger.info(f"ImageRefineLiteV2 completed two-step refinement process for node {node.id}")
        return refine_response