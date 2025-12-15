"""
File upload endpoints for the Bria Workflow Platform.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.services.file_service import file_service
from app.core.exceptions import FileValidationError
from app.core.logging_config import get_logger
from app.schemas.file import (
    FileUploadResponse, MultipleFileUploadResponse, 
    FileValidationResponse, FileCleanupResponse
)

logger = get_logger(__name__)
router = APIRouter()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and validate a single file.
    
    Args:
        file: The file to upload
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        File upload result with metadata
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        logger.info(f"User {current_user.id} uploading file: {file.filename}")
        
        # Validate the file
        validation_result = await file_service.validate_upload_file(file)
        
        # Save the validated file
        file_path = await file_service.save_validated_file(file, validation_result)
        
        # Generate file URL
        file_url = file_service.get_file_url(file_path)
        
        result = {
            "message": "File uploaded successfully",
            "file_url": file_url,
            "file_path": file_path,
            "metadata": validation_result
        }
        
        logger.info(f"File upload successful for user {current_user.id}: {file.filename}")
        return result
        
    except FileValidationError as e:
        logger.warning(f"File validation failed for user {current_user.id}: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.message,
                "type": "file_validation_error",
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error during file upload for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "File upload failed",
                "type": "internal_error",
                "details": {}
            }
        )


@router.post("/upload-multiple", response_model=MultipleFileUploadResponse)
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and validate multiple files.
    
    Args:
        files: List of files to upload
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        Upload results for all files
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        logger.info(f"User {current_user.id} uploading {len(files)} files")
        
        # Validate all files
        validation_results = await file_service.validate_multiple_files(files)
        
        # Save all validated files
        upload_results = []
        for i, file in enumerate(files):
            validation_result = validation_results[i]
            file_path = await file_service.save_validated_file(file, validation_result)
            file_url = file_service.get_file_url(file_path)
            
            upload_results.append({
                "filename": file.filename,
                "file_url": file_url,
                "file_path": file_path,
                "metadata": validation_result
            })
        
        result = {
            "message": f"Successfully uploaded {len(files)} files",
            "files": upload_results
        }
        
        logger.info(f"Multiple file upload successful for user {current_user.id}: {len(files)} files")
        return result
        
    except FileValidationError as e:
        logger.warning(f"File validation failed for user {current_user.id}: {e.message}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.message,
                "type": "file_validation_error",
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error during multiple file upload for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Multiple file upload failed",
                "type": "internal_error",
                "details": {}
            }
        )


@router.get("/{filename}")
async def get_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve an uploaded file.
    
    Args:
        filename: Name of the file to retrieve
        current_user: Current authenticated user
        
    Returns:
        File response
        
    Raises:
        HTTPException: If file not found
    """
    try:
        file_path = Path("uploads") / filename
        
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "File not found",
                    "type": "not_found_error",
                    "details": {"filename": filename}
                }
            )
        
        # Security check: ensure file is within uploads directory
        if not str(file_path.resolve()).startswith(str(Path("uploads").resolve())):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Access denied",
                    "type": "authorization_error",
                    "details": {}
                }
            )
        
        logger.info(f"User {current_user.id} accessing file: {filename}")
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving file {filename} for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Failed to retrieve file",
                "type": "internal_error",
                "details": {}
            }
        )


@router.post("/validate", response_model=FileValidationResponse)
async def validate_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Validate a file without saving it.
    
    Args:
        file: The file to validate
        current_user: Current authenticated user
        
    Returns:
        Validation result
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        logger.info(f"User {current_user.id} validating file: {file.filename}")
        
        # Validate the file
        validation_result = await file_service.validate_upload_file(file)
        
        result = {
            "message": "File validation successful",
            "is_valid": True,
            "metadata": validation_result
        }
        
        logger.info(f"File validation successful for user {current_user.id}: {file.filename}")
        return result
        
    except FileValidationError as e:
        logger.warning(f"File validation failed for user {current_user.id}: {e.message}")
        # For validation endpoint, return validation failure as success with is_valid=False
        return {
            "message": e.message,
            "is_valid": False,
            "error_details": e.details
        }
    except Exception as e:
        logger.error(f"Unexpected error during file validation for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "File validation failed",
                "type": "internal_error",
                "details": {}
            }
        )


@router.delete("/cleanup", response_model=FileCleanupResponse)
async def cleanup_old_files(
    max_age_days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """
    Clean up old uploaded files (admin only).
    
    Args:
        max_age_days: Maximum age of files to keep (default: 30 days)
        current_user: Current authenticated user
        
    Returns:
        Cleanup result
        
    Raises:
        HTTPException: If user is not authorized
    """
    # Note: In a real application, you would check if the user is an admin
    # For now, we'll allow any authenticated user to perform cleanup
    
    try:
        logger.info(f"User {current_user.id} initiating file cleanup (max_age_days: {max_age_days})")
        
        deleted_count = file_service.cleanup_old_files(max_age_days)
        
        result = {
            "message": f"Cleanup completed successfully",
            "deleted_files": deleted_count,
            "max_age_days": max_age_days
        }
        
        logger.info(f"File cleanup completed for user {current_user.id}: {deleted_count} files deleted")
        return result
        
    except Exception as e:
        logger.error(f"Error during file cleanup for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "File cleanup failed",
                "type": "internal_error",
                "details": {}
            }
        )