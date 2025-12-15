"""
Custom exceptions and error handling for the Bria Workflow Platform.
"""
from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class WorkflowPlatformError(Exception):
    """Base exception for all workflow platform errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(WorkflowPlatformError):
    """Raised when validation fails."""
    pass


class AuthenticationError(WorkflowPlatformError):
    """Raised when authentication fails."""
    pass


class AuthorizationError(WorkflowPlatformError):
    """Raised when authorization fails."""
    pass


class NotFoundError(WorkflowPlatformError):
    """Raised when a resource is not found."""
    pass


class ConflictError(WorkflowPlatformError):
    """Raised when there's a conflict with existing data."""
    pass


class ExternalAPIError(WorkflowPlatformError):
    """Raised when external API calls fail."""
    
    def __init__(self, message: str, api_name: str, status_code: Optional[int] = None, 
                 response_data: Optional[Dict[str, Any]] = None):
        self.api_name = api_name
        self.status_code = status_code
        self.response_data = response_data or {}
        details = {
            "api_name": api_name,
            "status_code": status_code,
            "response_data": response_data
        }
        super().__init__(message, details)


class ExecutionError(WorkflowPlatformError):
    """Raised when workflow execution fails."""
    
    def __init__(self, message: str, workflow_run_id: Optional[str] = None, 
                 node_id: Optional[str] = None):
        self.workflow_run_id = workflow_run_id
        self.node_id = node_id
        details = {
            "workflow_run_id": workflow_run_id,
            "node_id": node_id
        }
        super().__init__(message, details)


class NodeExecutionError(ExecutionError):
    """Raised when a specific node execution fails."""
    
    def __init__(self, node_id: str, message: str, original_error: Optional[Exception] = None):
        self.original_error = original_error
        super().__init__(message, node_id=node_id)


class FileValidationError(ValidationError):
    """Raised when file validation fails."""
    
    def __init__(self, message: str, filename: Optional[str] = None, 
                 file_size: Optional[int] = None, file_type: Optional[str] = None):
        self.filename = filename
        self.file_size = file_size
        self.file_type = file_type
        details = {
            "filename": filename,
            "file_size": file_size,
            "file_type": file_type
        }
        super().__init__(message, details)


class DatabaseError(WorkflowPlatformError):
    """Raised when database operations fail."""
    pass


# HTTP Exception mappings
def map_exception_to_http(exc: WorkflowPlatformError) -> HTTPException:
    """Map custom exceptions to HTTP exceptions."""
    
    if isinstance(exc, ValidationError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": exc.message,
                "type": "validation_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, AuthenticationError):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": exc.message,
                "type": "authentication_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, AuthorizationError):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": exc.message,
                "type": "authorization_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, NotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": exc.message,
                "type": "not_found_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, ConflictError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": exc.message,
                "type": "conflict_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, FileValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": exc.message,
                "type": "file_validation_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, ExternalAPIError):
        # Map external API errors to 502 Bad Gateway or 503 Service Unavailable
        status_code = status.HTTP_502_BAD_GATEWAY
        if exc.status_code and exc.status_code >= 500:
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        
        return HTTPException(
            status_code=status_code,
            detail={
                "message": exc.message,
                "type": "external_api_error",
                "details": exc.details
            }
        )
    
    elif isinstance(exc, ExecutionError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": exc.message,
                "type": "execution_error",
                "details": exc.details
            }
        )
    
    else:
        # Generic WorkflowPlatformError
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": exc.message,
                "type": "internal_error",
                "details": exc.details
            }
        )