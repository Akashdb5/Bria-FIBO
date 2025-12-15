"""
File upload and validation service for the Bria Workflow Platform.
"""
import os
import mimetypes
from typing import List, Optional, Tuple, BinaryIO, Dict, Any
from pathlib import Path
import hashlib
from PIL import Image
import io

from fastapi import UploadFile
from app.core.exceptions import FileValidationError
from app.core.logging_config import get_logger
from app.core.config import settings

logger = get_logger(__name__)


class FileValidationService:
    """Service for validating uploaded files according to Bria API requirements."""
    
    # Bria API supported image formats
    SUPPORTED_IMAGE_FORMATS = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'image/bmp': ['.bmp'],
        'image/tiff': ['.tiff', '.tif']
    }
    
    # File size limits (in bytes)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MIN_FILE_SIZE = 1024  # 1KB
    
    # Image dimension limits
    MIN_IMAGE_WIDTH = 64
    MIN_IMAGE_HEIGHT = 64
    MAX_IMAGE_WIDTH = 4096
    MAX_IMAGE_HEIGHT = 4096
    
    # Maximum number of files per upload
    MAX_FILES_PER_UPLOAD = 10
    
    def __init__(self):
        """Initialize the file validation service."""
        self.upload_dir = Path("uploads")
        self.upload_dir.mkdir(exist_ok=True)
    
    async def validate_upload_file(self, file: UploadFile) -> Dict[str, Any]:
        """
        Validate a single uploaded file.
        
        Args:
            file: The uploaded file to validate
            
        Returns:
            Dict containing validation results and file metadata
            
        Raises:
            FileValidationError: If validation fails
        """
        logger.info(f"Validating uploaded file: {file.filename}")
        
        # Check if file is provided
        if not file or not file.filename:
            raise FileValidationError("No file provided")
        
        # Read file content
        try:
            content = await file.read()
            await file.seek(0)  # Reset file pointer
        except Exception as e:
            raise FileValidationError(f"Failed to read file: {str(e)}", filename=file.filename)
        
        # Validate file size
        file_size = len(content)
        if file_size < self.MIN_FILE_SIZE:
            raise FileValidationError(
                f"File too small. Minimum size: {self.MIN_FILE_SIZE} bytes",
                filename=file.filename,
                file_size=file_size
            )
        
        if file_size > self.MAX_FILE_SIZE:
            raise FileValidationError(
                f"File too large. Maximum size: {self.MAX_FILE_SIZE} bytes",
                filename=file.filename,
                file_size=file_size
            )
        
        # Validate file type
        detected_mime_type = self._detect_mime_type(content, file.filename)
        if detected_mime_type not in self.SUPPORTED_IMAGE_FORMATS:
            supported_formats = ', '.join(self.SUPPORTED_IMAGE_FORMATS.keys())
            raise FileValidationError(
                f"Unsupported file format. Supported formats: {supported_formats}",
                filename=file.filename,
                file_type=detected_mime_type
            )
        
        # Validate image properties
        image_metadata = self._validate_image_properties(content, file.filename)
        
        # Generate file hash for deduplication
        file_hash = hashlib.sha256(content).hexdigest()
        
        validation_result = {
            "filename": file.filename,
            "file_size": file_size,
            "mime_type": detected_mime_type,
            "file_hash": file_hash,
            "image_metadata": image_metadata,
            "is_valid": True
        }
        
        logger.info(f"File validation successful: {file.filename}")
        return validation_result
    
    async def validate_multiple_files(self, files: List[UploadFile]) -> List[Dict[str, Any]]:
        """
        Validate multiple uploaded files.
        
        Args:
            files: List of uploaded files to validate
            
        Returns:
            List of validation results for each file
            
        Raises:
            FileValidationError: If validation fails
        """
        if len(files) > self.MAX_FILES_PER_UPLOAD:
            raise FileValidationError(
                f"Too many files. Maximum allowed: {self.MAX_FILES_PER_UPLOAD}"
            )
        
        results = []
        for file in files:
            try:
                result = await self.validate_upload_file(file)
                results.append(result)
            except FileValidationError as e:
                # Re-raise with additional context
                raise FileValidationError(
                    f"Validation failed for file '{file.filename}': {e.message}",
                    filename=file.filename,
                    file_size=e.file_size,
                    file_type=e.file_type
                )
        
        return results
    
    def _detect_mime_type(self, content: bytes, filename: str) -> str:
        """
        Detect MIME type from file content and filename.
        
        Args:
            content: File content as bytes
            filename: Original filename
            
        Returns:
            Detected MIME type
        """
        # First, try to detect from content (magic bytes)
        if content.startswith(b'\xff\xd8\xff'):
            return 'image/jpeg'
        elif content.startswith(b'\x89PNG\r\n\x1a\n'):
            return 'image/png'
        elif content.startswith(b'RIFF') and b'WEBP' in content[:12]:
            return 'image/webp'
        elif content.startswith(b'BM'):
            return 'image/bmp'
        elif content.startswith(b'II*\x00') or content.startswith(b'MM\x00*'):
            return 'image/tiff'
        
        # Fallback to filename-based detection
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or 'application/octet-stream'
    
    def _validate_image_properties(self, content: bytes, filename: str) -> Dict[str, Any]:
        """
        Validate image properties using PIL.
        
        Args:
            content: Image content as bytes
            filename: Original filename
            
        Returns:
            Dictionary containing image metadata
            
        Raises:
            FileValidationError: If image validation fails
        """
        try:
            with Image.open(io.BytesIO(content)) as img:
                width, height = img.size
                format_name = img.format
                mode = img.mode
                
                # Validate dimensions
                if width < self.MIN_IMAGE_WIDTH or height < self.MIN_IMAGE_HEIGHT:
                    raise FileValidationError(
                        f"Image too small. Minimum dimensions: {self.MIN_IMAGE_WIDTH}x{self.MIN_IMAGE_HEIGHT}",
                        filename=filename
                    )
                
                if width > self.MAX_IMAGE_WIDTH or height > self.MAX_IMAGE_HEIGHT:
                    raise FileValidationError(
                        f"Image too large. Maximum dimensions: {self.MAX_IMAGE_WIDTH}x{self.MAX_IMAGE_HEIGHT}",
                        filename=filename
                    )
                
                # Check if image is corrupted
                try:
                    img.verify()
                except Exception:
                    raise FileValidationError(
                        "Image file appears to be corrupted",
                        filename=filename
                    )
                
                return {
                    "width": width,
                    "height": height,
                    "format": format_name,
                    "mode": mode,
                    "aspect_ratio": round(width / height, 2)
                }
                
        except FileValidationError:
            raise
        except Exception as e:
            raise FileValidationError(
                f"Failed to process image: {str(e)}",
                filename=filename
            )
    
    async def save_validated_file(self, file: UploadFile, validation_result: Dict[str, Any]) -> str:
        """
        Save a validated file to the upload directory.
        
        Args:
            file: The validated upload file
            validation_result: Result from validate_upload_file
            
        Returns:
            Path to the saved file
            
        Raises:
            FileValidationError: If saving fails
        """
        try:
            # Generate unique filename using hash
            file_hash = validation_result["file_hash"]
            original_name = Path(file.filename)
            extension = original_name.suffix.lower()
            
            # Create filename: hash + original extension
            saved_filename = f"{file_hash}{extension}"
            file_path = self.upload_dir / saved_filename
            
            # Check if file already exists (deduplication)
            if file_path.exists():
                logger.info(f"File already exists, skipping save: {saved_filename}")
                return str(file_path)
            
            # Save file
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            
            logger.info(f"File saved successfully: {saved_filename}")
            return str(file_path)
            
        except Exception as e:
            raise FileValidationError(
                f"Failed to save file: {str(e)}",
                filename=file.filename
            )
    
    def get_file_url(self, file_path: str) -> str:
        """
        Generate a URL for accessing the uploaded file.
        
        Args:
            file_path: Path to the saved file
            
        Returns:
            URL for accessing the file
        """
        filename = Path(file_path).name
        return f"/api/v1/files/{filename}"
    
    def cleanup_old_files(self, max_age_days: int = 30) -> int:
        """
        Clean up old uploaded files.
        
        Args:
            max_age_days: Maximum age of files to keep
            
        Returns:
            Number of files deleted
        """
        import time
        
        deleted_count = 0
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 60 * 60
        
        try:
            for file_path in self.upload_dir.iterdir():
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        file_path.unlink()
                        deleted_count += 1
                        logger.info(f"Deleted old file: {file_path.name}")
        except Exception as e:
            logger.error(f"Error during file cleanup: {e}")
        
        logger.info(f"Cleanup completed. Deleted {deleted_count} files.")
        return deleted_count


# Global instance
file_service = FileValidationService()