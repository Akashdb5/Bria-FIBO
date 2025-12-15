"""
Tests for node seeding functionality.
"""
import pytest
from app.schemas.node import SYSTEM_NODE_TYPES, GenerateImageV2Input, StructuredPromptV2Input, RefineImageV2Input
from pydantic import ValidationError


class TestNodeSeeding:
    """Test node seeding functionality."""
    
    def test_system_node_types_definition(self):
        """Test that system node types are properly defined."""
        # Verify all expected node types are present
        expected_node_types = ["GenerateImageV2", "StructuredPromptV2", "RefineImageV2"]
        
        assert len(SYSTEM_NODE_TYPES) == len(expected_node_types)
        
        for node_type in expected_node_types:
            assert node_type in SYSTEM_NODE_TYPES
            
            # Verify each node type has required fields
            node_def = SYSTEM_NODE_TYPES[node_type]
            assert "description" in node_def
            assert "input_schema" in node_def
            assert "output_schema" in node_def
            
            # Verify description is not empty
            assert node_def["description"]
            assert len(node_def["description"]) > 0
            
            # Verify schemas are dictionaries
            assert isinstance(node_def["input_schema"], dict)
            assert isinstance(node_def["output_schema"], dict)
    
    def test_generate_image_v2_validation(self):
        """Test GenerateImageV2 input validation."""
        # Test valid configuration with prompt
        valid_config = {
            "prompt": "cinematic lion",
            "aspect_ratio": "1:1",
            "steps_num": 50
        }
        
        # Should not raise an exception
        result = GenerateImageV2Input(**valid_config)
        assert result.prompt == "cinematic lion"
        assert result.aspect_ratio == "1:1"
        assert result.steps_num == 50
        
        # Test valid configuration with images
        valid_config_images = {
            "images": ["https://example.com/image1.jpg"],
            "aspect_ratio": "16:9",
            "steps_num": 30
        }
        
        result = GenerateImageV2Input(**valid_config_images)
        assert result.images == ["https://example.com/image1.jpg"]
        assert result.aspect_ratio == "16:9"
        
        # Test invalid configuration (no input provided)
        with pytest.raises(ValidationError) as exc_info:
            GenerateImageV2Input(aspect_ratio="1:1", steps_num=50)
        
        assert "Exactly one of 'prompt', 'images', or 'structured_prompt' must be provided" in str(exc_info.value)
        
        # Test invalid configuration (multiple inputs provided)
        with pytest.raises(ValidationError) as exc_info:
            GenerateImageV2Input(
                prompt="test",
                images=["https://example.com/image.jpg"],
                aspect_ratio="1:1"
            )
        
        assert "Exactly one of 'prompt', 'images', or 'structured_prompt' must be provided" in str(exc_info.value)
    
    def test_structured_prompt_v2_validation(self):
        """Test StructuredPromptV2 input validation."""
        # Test valid configuration with prompt
        valid_config = {
            "prompt": "A beautiful landscape"
        }
        
        result = StructuredPromptV2Input(**valid_config)
        assert result.prompt == "A beautiful landscape"
        assert result.image_url is None
        
        # Test valid configuration with image_url
        valid_config_image = {
            "image_url": "https://example.com/image.jpg"
        }
        
        result = StructuredPromptV2Input(**valid_config_image)
        assert result.image_url == "https://example.com/image.jpg"
        assert result.prompt is None
        
        # Test invalid configuration (no input provided)
        with pytest.raises(ValidationError) as exc_info:
            StructuredPromptV2Input()
        
        assert "Either 'prompt' or 'image_url' must be provided" in str(exc_info.value)
        
        # Test invalid configuration (both inputs provided)
        with pytest.raises(ValidationError) as exc_info:
            StructuredPromptV2Input(
                prompt="test",
                image_url="https://example.com/image.jpg"
            )
        
        assert "Only one of 'prompt' or 'image_url' should be provided" in str(exc_info.value)
    
    def test_refine_image_v2_validation(self):
        """Test RefineImageV2 input validation."""
        # Test valid configuration
        valid_config = {
            "image_url": "https://example.com/image.jpg",
            "prompt": "Make it more colorful",
            "strength": 0.8,
            "steps_num": 40
        }
        
        result = RefineImageV2Input(**valid_config)
        assert result.image_url == "https://example.com/image.jpg"
        assert result.prompt == "Make it more colorful"
        assert result.strength == 0.8
        assert result.steps_num == 40
        
        # Test minimal valid configuration
        minimal_config = {
            "image_url": "https://example.com/image.jpg"
        }
        
        result = RefineImageV2Input(**minimal_config)
        assert result.image_url == "https://example.com/image.jpg"
        assert result.strength == 0.7  # default value
        assert result.steps_num == 50  # default value
        
        # Test invalid configuration (missing required field)
        with pytest.raises(ValidationError) as exc_info:
            RefineImageV2Input(prompt="test")
        
        assert "image_url" in str(exc_info.value)
    
    def test_node_schema_generation(self):
        """Test that node schemas can be generated properly."""
        # Test that schemas can be generated without errors
        for node_type, definition in SYSTEM_NODE_TYPES.items():
            input_schema = definition["input_schema"]
            output_schema = definition["output_schema"]
            
            # Verify schemas have required structure
            assert "properties" in input_schema
            assert "type" in input_schema
            assert input_schema["type"] == "object"
            
            assert "properties" in output_schema
            assert "type" in output_schema
            assert output_schema["type"] == "object"