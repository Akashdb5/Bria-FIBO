"""
Pydantic schemas for file upload operations.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    """Schema for image metadata."""
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    format: str = Field(..., description="Image format (JPEG, PNG, etc.)")
    mode: str = Field(..., description="Image mode (RGB, RGBA, etc.)")
    aspect_ratio: float = Field(..., description="Image aspect ratio (width/height)")


class FileValidationResult(BaseModel):
    """Schema for file validation results."""
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="Detected MIME type")
    file_hash: str = Field(..., description="SHA256 hash of file content")
    image_metadata: ImageMetadata = Field(..., description="Image-specific metadata")
    is_valid: bool = Field(..., description="Whether the file passed validation")


class FileUploadResponse(BaseModel):
    """Schema for file upload response."""
    message: str = Field(..., description="Upload status message")
    file_url: str = Field(..., description="URL to access the uploaded file")
    file_path: str = Field(..., description="Server path to the uploaded file")
    metadata: FileValidationResult = Field(..., description="File validation metadata")


class MultipleFileUploadResponse(BaseModel):
    """Schema for multiple file upload response."""
    message: str = Field(..., description="Upload status message")
    files: List[Dict[str, Any]] = Field(..., description="Upload results for each file")


class FileValidationResponse(BaseModel):
    """Schema for file validation response."""
    message: str = Field(..., description="Validation status message")
    is_valid: bool = Field(..., description="Whether the file is valid")
    metadata: Optional[FileValidationResult] = Field(None, description="File metadata if valid")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Error details if invalid")


class FileCleanupResponse(BaseModel):
    """Schema for file cleanup response."""
    message: str = Field(..., description="Cleanup status message")
    deleted_files: int = Field(..., description="Number of files deleted")
    max_age_days: int = Field(..., description="Maximum age threshold used")


class FileErrorResponse(BaseModel):
    """Schema for file operation error responses."""
    message: str = Field(..., description="Error message")
    type: str = Field(..., description="Error type")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional error details")