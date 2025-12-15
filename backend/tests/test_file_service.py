"""
Tests for file upload and validation service.
"""
import pytest
import io
from PIL import Image
from fastapi import UploadFile

from app.services.file_service import FileValidationService
from app.core.exceptions import FileValidationError


class TestFileValidationService:
    """Test cases for FileValidationService."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.service = FileValidationService()
    
    def create_test_image(self, width=100, height=100, format='PNG'):
        """Create a test image in memory."""
        # Create a more complex image to ensure it's large enough
        img = Image.new('RGB', (width, height), color='red')
        # Add lots of complexity to make the file larger
        for x in range(0, width, 2):
            for y in range(0, height, 2):
                # Create a pattern to increase file size
                color = ((x * y) % 255, (x + y) % 255, (x - y) % 255)
                img.putpixel((x, y), color)
        
        img_bytes = io.BytesIO()
        # For PNG, don't compress to make it larger
        img.save(img_bytes, format=format, compress_level=0 if format == 'PNG' else None, 
                quality=100 if format == 'JPEG' else None)
        img_bytes.seek(0)
        return img_bytes.getvalue()
    
    def create_upload_file(self, content, filename, content_type):
        """Create a mock UploadFile object."""
        file_obj = io.BytesIO(content)
        upload_file = UploadFile(
            filename=filename,
            file=file_obj,
            headers={"content-type": content_type}
        )
        return upload_file
    
    @pytest.mark.asyncio
    async def test_validate_valid_png_image(self):
        """Test validation of a valid PNG image."""
        # Create a valid PNG image
        image_content = self.create_test_image(200, 200, 'PNG')
        upload_file = self.create_upload_file(image_content, "test.png", "image/png")
        
        # Validate the file
        result = await self.service.validate_upload_file(upload_file)
        
        # Assertions
        assert result["is_valid"] is True
        assert result["filename"] == "test.png"
        assert result["mime_type"] == "image/png"
        assert result["image_metadata"]["width"] == 200
        assert result["image_metadata"]["height"] == 200
        assert result["image_metadata"]["format"] == "PNG"
    
    @pytest.mark.asyncio
    async def test_validate_valid_jpeg_image(self):
        """Test validation of a valid JPEG image."""
        # Create a valid JPEG image
        image_content = self.create_test_image(300, 200, 'JPEG')
        upload_file = self.create_upload_file(image_content, "test.jpg", "image/jpeg")
        
        # Validate the file
        result = await self.service.validate_upload_file(upload_file)
        
        # Assertions
        assert result["is_valid"] is True
        assert result["filename"] == "test.jpg"
        assert result["mime_type"] == "image/jpeg"
        assert result["image_metadata"]["width"] == 300
        assert result["image_metadata"]["height"] == 200
        assert result["image_metadata"]["format"] == "JPEG"
    
    @pytest.mark.asyncio
    async def test_validate_file_too_small(self):
        """Test validation failure for file that's too small."""
        # Create a very small file
        small_content = b"tiny"
        upload_file = self.create_upload_file(small_content, "tiny.txt", "text/plain")
        
        # Validation should fail
        with pytest.raises(FileValidationError) as exc_info:
            await self.service.validate_upload_file(upload_file)
        
        assert "File too small" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_unsupported_file_type(self):
        """Test validation failure for unsupported file type."""
        # Create a text file
        text_content = b"This is a text file" * 100  # Make it large enough
        upload_file = self.create_upload_file(text_content, "test.txt", "text/plain")
        
        # Validation should fail
        with pytest.raises(FileValidationError) as exc_info:
            await self.service.validate_upload_file(upload_file)
        
        assert "Unsupported file format" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_image_too_small_dimensions(self):
        """Test validation failure for image with dimensions too small."""
        # Create a small image but with complex pattern to make file size large enough
        small_img = Image.new('RGB', (50, 50), color='red')  # Below minimum 64x64
        # Add lots of complexity to make the file larger than 1024 bytes
        for x in range(50):
            for y in range(50):
                # Create a complex pattern to increase file size
                color = ((x * y * 123) % 255, (x + y * 456) % 255, (x - y * 789) % 255)
                small_img.putpixel((x, y), color)
        
        img_bytes = io.BytesIO()
        small_img.save(img_bytes, format='PNG', compress_level=0)  # No compression
        image_content = img_bytes.getvalue()
        
        upload_file = self.create_upload_file(image_content, "small.png", "image/png")
        
        # Validation should fail due to small dimensions
        with pytest.raises(FileValidationError) as exc_info:
            await self.service.validate_upload_file(upload_file)
        
        assert "Image too small" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_no_file_provided(self):
        """Test validation failure when no file is provided."""
        # Create upload file with no filename
        upload_file = UploadFile(filename=None, file=io.BytesIO())
        
        # Validation should fail
        with pytest.raises(FileValidationError) as exc_info:
            await self.service.validate_upload_file(upload_file)
        
        assert "No file provided" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_validate_multiple_files_success(self):
        """Test successful validation of multiple files."""
        # Create two valid images
        image1_content = self.create_test_image(200, 200, 'PNG')
        image2_content = self.create_test_image(300, 300, 'JPEG')
        
        upload_file1 = self.create_upload_file(image1_content, "test1.png", "image/png")
        upload_file2 = self.create_upload_file(image2_content, "test2.jpg", "image/jpeg")
        
        # Validate multiple files
        results = await self.service.validate_multiple_files([upload_file1, upload_file2])
        
        # Assertions
        assert len(results) == 2
        assert all(result["is_valid"] for result in results)
        assert results[0]["filename"] == "test1.png"
        assert results[1]["filename"] == "test2.jpg"
    
    @pytest.mark.asyncio
    async def test_validate_multiple_files_too_many(self):
        """Test validation failure when too many files are provided."""
        # Create more files than allowed
        files = []
        for i in range(self.service.MAX_FILES_PER_UPLOAD + 1):
            image_content = self.create_test_image(100, 100, 'PNG')
            upload_file = self.create_upload_file(image_content, f"test{i}.png", "image/png")
            files.append(upload_file)
        
        # Validation should fail
        with pytest.raises(FileValidationError) as exc_info:
            await self.service.validate_multiple_files(files)
        
        assert "Too many files" in str(exc_info.value)
    
    def test_detect_mime_type_png(self):
        """Test MIME type detection for PNG files."""
        image_content = self.create_test_image(100, 100, 'PNG')
        mime_type = self.service._detect_mime_type(image_content, "test.png")
        assert mime_type == "image/png"
    
    def test_detect_mime_type_jpeg(self):
        """Test MIME type detection for JPEG files."""
        image_content = self.create_test_image(100, 100, 'JPEG')
        mime_type = self.service._detect_mime_type(image_content, "test.jpg")
        assert mime_type == "image/jpeg"
    
    def test_validate_image_properties_success(self):
        """Test successful image property validation."""
        image_content = self.create_test_image(200, 150, 'PNG')
        metadata = self.service._validate_image_properties(image_content, "test.png")
        
        assert metadata["width"] == 200
        assert metadata["height"] == 150
        assert metadata["format"] == "PNG"
        assert metadata["aspect_ratio"] == 1.33  # 200/150 rounded to 2 decimal places
    
    def test_validate_image_properties_corrupted(self):
        """Test image property validation with corrupted data."""
        corrupted_content = b"This is not an image" * 100
        
        with pytest.raises(FileValidationError) as exc_info:
            self.service._validate_image_properties(corrupted_content, "corrupted.png")
        
        assert "Failed to process image" in str(exc_info.value)
    
    def test_get_file_url(self):
        """Test file URL generation."""
        file_path = "uploads/test_hash.png"
        url = self.service.get_file_url(file_path)
        assert url == "/api/v1/files/test_hash.png"