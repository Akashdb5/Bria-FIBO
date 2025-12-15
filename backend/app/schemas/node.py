"""
Pydantic schemas for node type definitions and validation.
"""
from typing import Dict, Any, List, Optional, Union, Literal
from pydantic import BaseModel, Field, model_validator
from uuid import UUID


class NodeSchema(BaseModel):
    """Base schema for node input/output definitions."""
    id: UUID
    node_type: str
    description: Optional[str] = None
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class NodeCreate(BaseModel):
    """Schema for creating new node type definitions."""
    node_type: str
    description: Optional[str] = None
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]


# Image Generation V2 Node Schemas
class ImageGenerateV2Input(BaseModel):
    """Input schema for /image/generate endpoint (Gemini 2.5 Flash VLM bridge)."""
    # Mutually exclusive input combinations
    prompt: Optional[str] = Field(None, description="Text prompt for image generation")
    images: Optional[List[str]] = Field(None, description="List of image URLs for image-to-image generation")
    structured_prompt: Optional[Dict[str, Any]] = Field(None, description="Pre-generated structured prompt object")
    
    # Common parameters
    aspect_ratio: Optional[Literal["1:1", "16:9", "9:16", "4:3", "3:4"]] = Field("1:1", description="Aspect ratio for generated image")
    steps_num: Optional[int] = Field(50, ge=1, le=100, description="Number of generation steps")
    seed: Optional[int] = Field(None, description="Random seed for reproducible generation")
    
    @model_validator(mode='after')
    def validate_input_combinations(self):
        """Validate mutually exclusive input combinations per API docs."""
        inputs = [
            ("prompt", self.prompt),
            ("images", self.images),
            ("structured_prompt", self.structured_prompt)
        ]
        
        provided_inputs = [(name, value) for name, value in inputs if value is not None]
        
        # Check for valid combinations
        if len(provided_inputs) == 0:
            raise ValueError("One of the following must be provided: 'prompt', 'images', or 'structured_prompt'")
        
        # Allow structured_prompt + prompt for refinement
        if len(provided_inputs) == 2:
            input_names = [name for name, _ in provided_inputs]
            if not (set(input_names) == {"structured_prompt", "prompt"}):
                raise ValueError("Only 'structured_prompt' + 'prompt' combination is allowed for refinement")
        elif len(provided_inputs) > 2:
            raise ValueError("Too many inputs provided. See API documentation for valid combinations.")
        
        # Allow images + prompt combination
        if len(provided_inputs) == 2:
            input_names = [name for name, _ in provided_inputs]
            if not (set(input_names) in [{"structured_prompt", "prompt"}, {"images", "prompt"}]):
                raise ValueError("Invalid input combination. Allowed: 'images' + 'prompt' or 'structured_prompt' + 'prompt'")
        
        return self


class ImageGenerateV2Output(BaseModel):
    """Output schema for /image/generate endpoint."""
    request_id: str = Field(description="Bria API request ID")
    image_url: str = Field(description="URL of the generated image")
    seed: int = Field(description="Seed used for generation")
    structured_prompt: Dict[str, Any] = Field(description="Generated or used structured prompt")


# Image Generation Lite V2 Node Schemas (Coming Soon)
class ImageGenerateLiteV2Input(BaseModel):
    """Input schema for /image/generate/lite endpoint (FIBO-VLM bridge)."""
    # Same input combinations as regular generate
    prompt: Optional[str] = Field(None, description="Text prompt for image generation")
    images: Optional[List[str]] = Field(None, description="List of image URLs for image-to-image generation")
    structured_prompt: Optional[Dict[str, Any]] = Field(None, description="Pre-generated structured prompt object")
    
    # Common parameters
    aspect_ratio: Optional[Literal["1:1", "16:9", "9:16", "4:3", "3:4"]] = Field("1:1", description="Aspect ratio for generated image")
    steps_num: Optional[int] = Field(50, ge=1, le=100, description="Number of generation steps")
    seed: Optional[int] = Field(None, description="Random seed for reproducible generation")
    
    @model_validator(mode='after')
    def validate_input_combinations(self):
        """Validate mutually exclusive input combinations per API docs."""
        inputs = [
            ("prompt", self.prompt),
            ("images", self.images),
            ("structured_prompt", self.structured_prompt)
        ]
        
        provided_inputs = [(name, value) for name, value in inputs if value is not None]
        
        if len(provided_inputs) == 0:
            raise ValueError("One of the following must be provided: 'prompt', 'images', or 'structured_prompt'")
        
        # Allow structured_prompt + prompt for refinement and images + prompt
        if len(provided_inputs) == 2:
            input_names = [name for name, _ in provided_inputs]
            if not (set(input_names) in [{"structured_prompt", "prompt"}, {"images", "prompt"}]):
                raise ValueError("Invalid input combination. Allowed: 'images' + 'prompt' or 'structured_prompt' + 'prompt'")
        elif len(provided_inputs) > 2:
            raise ValueError("Too many inputs provided. See API documentation for valid combinations.")
        
        return self


class ImageGenerateLiteV2Output(BaseModel):
    """Output schema for /image/generate/lite endpoint."""
    request_id: str = Field(description="Bria API request ID")
    image_url: str = Field(description="URL of the generated image")
    seed: int = Field(description="Seed used for generation")
    structured_prompt: Dict[str, Any] = Field(description="Generated or used structured prompt")


# Structured Prompt Generation V2 Node Schemas
class StructuredPromptGenerateV2Input(BaseModel):
    """Input schema for /structured_prompt/generate endpoint (Gemini 2.5 Flash VLM bridge)."""
    # Input combinations per API docs
    prompt: Optional[str] = Field(None, description="Text prompt to convert to structured prompt")
    images: Optional[List[str]] = Field(None, description="List of image URLs to analyze")
    structured_prompt: Optional[Dict[str, Any]] = Field(None, description="Existing structured prompt to refine")
    
    @model_validator(mode='after')
    def validate_input_combinations(self):
        """Validate input combinations per API docs."""
        inputs = [
            ("prompt", self.prompt),
            ("images", self.images),
            ("structured_prompt", self.structured_prompt)
        ]
        
        provided_inputs = [(name, value) for name, value in inputs if value is not None]
        
        if len(provided_inputs) == 0:
            raise ValueError("One of the following must be provided: 'prompt', 'images', or 'structured_prompt'")
        
        # Valid combinations: prompt only, images only, images + prompt, structured_prompt + prompt
        if len(provided_inputs) == 2:
            input_names = [name for name, _ in provided_inputs]
            if not (set(input_names) in [{"images", "prompt"}, {"structured_prompt", "prompt"}]):
                raise ValueError("Invalid input combination. Allowed: 'images' + 'prompt' or 'structured_prompt' + 'prompt'")
        elif len(provided_inputs) > 2:
            raise ValueError("Too many inputs provided. See API documentation for valid combinations.")
        
        return self


class StructuredPromptGenerateV2Output(BaseModel):
    """Output schema for /structured_prompt/generate endpoint."""
    request_id: str = Field(description="Bria API request ID")
    structured_prompt: Dict[str, Any] = Field(description="Generated structured prompt object")


# Structured Prompt Generation Lite V2 Node Schemas (Coming Soon)
class StructuredPromptGenerateLiteV2Input(BaseModel):
    """Input schema for /structured_prompt/generate/lite endpoint (FIBO-VLM bridge)."""
    # Same input combinations as regular structured prompt generate
    prompt: Optional[str] = Field(None, description="Text prompt to convert to structured prompt")
    images: Optional[List[str]] = Field(None, description="List of image URLs to analyze")
    structured_prompt: Optional[Dict[str, Any]] = Field(None, description="Existing structured prompt to refine")
    
    @model_validator(mode='after')
    def validate_input_combinations(self):
        """Validate input combinations per API docs."""
        inputs = [
            ("prompt", self.prompt),
            ("images", self.images),
            ("structured_prompt", self.structured_prompt)
        ]
        
        provided_inputs = [(name, value) for name, value in inputs if value is not None]
        
        if len(provided_inputs) == 0:
            raise ValueError("One of the following must be provided: 'prompt', 'images', or 'structured_prompt'")
        
        if len(provided_inputs) == 2:
            input_names = [name for name, _ in provided_inputs]
            if not (set(input_names) in [{"images", "prompt"}, {"structured_prompt", "prompt"}]):
                raise ValueError("Invalid input combination. Allowed: 'images' + 'prompt' or 'structured_prompt' + 'prompt'")
        elif len(provided_inputs) > 2:
            raise ValueError("Too many inputs provided. See API documentation for valid combinations.")
        
        return self


class StructuredPromptGenerateLiteV2Output(BaseModel):
    """Output schema for /structured_prompt/generate/lite endpoint."""
    request_id: str = Field(description="Bria API request ID")
    structured_prompt: Dict[str, Any] = Field(description="Generated structured prompt object")


# Image Refinement V2 Node Schemas (Workflow-based refinement)
class ImageRefineV2Input(BaseModel):
    """Input schema for image refinement using v2 API workflow pattern."""
    image_url: str = Field(description="URL of the image to refine")
    refinement_prompt: str = Field(description="Text prompt describing the desired refinement changes")
    
    # Optional parameters for the generation step
    aspect_ratio: Optional[Literal["1:1", "16:9", "9:16", "4:3", "3:4"]] = Field("1:1", description="Aspect ratio for refined image")
    steps_num: Optional[int] = Field(50, ge=1, le=100, description="Number of generation steps")
    seed: Optional[int] = Field(None, description="Random seed for reproducible refinement")


class ImageRefineV2Output(BaseModel):
    """Output schema for image refinement workflow."""
    request_id: str = Field(description="Final generation request ID")
    original_image_url: str = Field(description="URL of the original image")
    refined_image_url: str = Field(description="URL of the refined image")
    original_structured_prompt: Dict[str, Any] = Field(description="Structured prompt extracted from original image")
    refined_structured_prompt: Dict[str, Any] = Field(description="Modified structured prompt used for refinement")
    seed: int = Field(description="Seed used for refinement")


# Image Refinement Lite V2 Node Schemas (Coming Soon)
class ImageRefineLiteV2Input(BaseModel):
    """Input schema for image refinement using v2 lite API workflow pattern."""
    image_url: str = Field(description="URL of the image to refine")
    refinement_prompt: str = Field(description="Text prompt describing the desired refinement changes")
    
    # Optional parameters for the generation step
    aspect_ratio: Optional[Literal["1:1", "16:9", "9:16", "4:3", "3:4"]] = Field("1:1", description="Aspect ratio for refined image")
    steps_num: Optional[int] = Field(50, ge=1, le=100, description="Number of generation steps")
    seed: Optional[int] = Field(None, description="Random seed for reproducible refinement")


class ImageRefineLiteV2Output(BaseModel):
    """Output schema for image refinement lite workflow."""
    request_id: str = Field(description="Final generation request ID")
    original_image_url: str = Field(description="URL of the original image")
    refined_image_url: str = Field(description="URL of the refined image")
    original_structured_prompt: Dict[str, Any] = Field(description="Structured prompt extracted from original image")
    refined_structured_prompt: Dict[str, Any] = Field(description="Modified structured prompt used for refinement")
    seed: int = Field(description="Seed used for refinement")


# Node validation schemas
class NodeValidationRequest(BaseModel):
    """Request schema for validating node configuration."""
    node_type: str
    configuration: Dict[str, Any]


class NodeValidationResponse(BaseModel):
    """Response schema for node validation."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# System node type definitions based on Bria API v2 endpoints
SYSTEM_NODE_TYPES = {
    "ImageGenerateV2": {
        "description": "Generate images using Bria AI's /image/generate endpoint with Gemini 2.5 Flash VLM bridge. Supports text prompts, image references, and structured prompts.",
        "input_schema": ImageGenerateV2Input.model_json_schema(),
        "output_schema": ImageGenerateV2Output.model_json_schema(),
        "api_endpoint": "/image/generate",
        "vlm_bridge": "Gemini 2.5 Flash"
    },
    "ImageGenerateLiteV2": {
        "description": "Generate images using Bria AI's /image/generate/lite endpoint with FIBO-VLM bridge. Optimized for local deployment and on-prem usage.",
        "input_schema": ImageGenerateLiteV2Input.model_json_schema(),
        "output_schema": ImageGenerateLiteV2Output.model_json_schema(),
        "api_endpoint": "/image/generate/lite",
        "vlm_bridge": "FIBO-VLM (Open Source)",
        "status": "Coming Soon"
    },
    "StructuredPromptGenerateV2": {
        "description": "Generate structured prompts from text or images using Bria AI's /structured_prompt/generate endpoint with Gemini 2.5 Flash VLM bridge. Decouples intent translation from image generation.",
        "input_schema": StructuredPromptGenerateV2Input.model_json_schema(),
        "output_schema": StructuredPromptGenerateV2Output.model_json_schema(),
        "api_endpoint": "/structured_prompt/generate",
        "vlm_bridge": "Gemini 2.5 Flash"
    },
    "StructuredPromptGenerateLiteV2": {
        "description": "Generate structured prompts using Bria AI's /structured_prompt/generate/lite endpoint with FIBO-VLM bridge. Optimized for local deployment.",
        "input_schema": StructuredPromptGenerateLiteV2Input.model_json_schema(),
        "output_schema": StructuredPromptGenerateLiteV2Output.model_json_schema(),
        "api_endpoint": "/structured_prompt/generate/lite",
        "vlm_bridge": "FIBO-VLM (Open Source)",
        "status": "Coming Soon"
    },
    "ImageRefineV2": {
        "description": "Refine existing images using Bria AI's v2 workflow pattern. Combines structured prompt extraction with guided image generation using Gemini 2.5 Flash VLM bridge.",
        "input_schema": ImageRefineV2Input.model_json_schema(),
        "output_schema": ImageRefineV2Output.model_json_schema(),
        "api_endpoint": "/structured_prompt/generate + /image/generate",
        "vlm_bridge": "Gemini 2.5 Flash",
        "workflow_pattern": "Two-step: Extract structured prompt from image, then generate with refinement prompt"
    },
    "ImageRefineLiteV2": {
        "description": "Refine existing images using Bria AI's v2 lite workflow pattern. Combines structured prompt extraction with guided image generation using FIBO-VLM bridge.",
        "input_schema": ImageRefineLiteV2Input.model_json_schema(),
        "output_schema": ImageRefineLiteV2Output.model_json_schema(),
        "api_endpoint": "/structured_prompt/generate/lite + /image/generate/lite",
        "vlm_bridge": "FIBO-VLM (Open Source)",
        "workflow_pattern": "Two-step: Extract structured prompt from image, then generate with refinement prompt",
        "status": "Coming Soon"
    }
}