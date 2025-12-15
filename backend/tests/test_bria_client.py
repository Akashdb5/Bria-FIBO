"""
Tests for Bria API client.
"""
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.bria_client import (
    BriaAPIClient,
    BriaAPIError,
    BriaAPITimeoutError,
    BriaAPIRateLimitError,
    GenerateImageV2Request,
    StructuredPromptV2Request,
    RefineImageV2Request,
    GenerateImageV2Response,
    StructuredPromptV2Response,
    RefineImageV2Response,
    AsyncOperationStatus,
    create_bria_client
)


class TestBriaAPIClient:
    """Test cases for BriaAPIClient."""
    
    @pytest.fixture
    def client(self):
        """Create test client instance."""
        return BriaAPIClient(
            api_key="test-api-key",
            base_url="https://api.test.com/v2",
            timeout=10.0,
            max_retries=2,
            polling_interval=0.1,
            max_polling_timeout=5.0
        )
    
    @pytest.mark.asyncio
    async def test_client_context_manager(self, client):
        """Test client can be used as async context manager."""
        async with client as c:
            assert c is client
    
    @pytest.mark.asyncio
    async def test_generate_image_v2_success(self, client):
        """Test successful GenerateImageV2 API call."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "request_id": "test-123",
            "status": "completed",
            "image_url": "https://example.com/image.jpg",
            "seed": 12345,
            "structured_prompt": {"style": "cinematic"}
        }
        
        with patch.object(client, '_make_request_with_retry', return_value=mock_response):
            request = GenerateImageV2Request(prompt="test prompt")
            response = await client.generate_image_v2(request)
            
            assert response.request_id == "test-123"
            assert response.status == AsyncOperationStatus.COMPLETED
            assert response.image_url == "https://example.com/image.jpg"
            assert response.seed == 12345
    
    @pytest.mark.asyncio
    async def test_generate_image_v2_validation_error(self, client):
        """Test GenerateImageV2 with invalid input validation."""
        # Test no inputs provided
        request = GenerateImageV2Request()
        with pytest.raises(ValueError, match="Exactly one of"):
            await client.generate_image_v2(request)
        
        # Test multiple inputs provided
        request = GenerateImageV2Request(
            prompt="test",
            images=["http://example.com/image.jpg"]
        )
        with pytest.raises(ValueError, match="Exactly one of"):
            await client.generate_image_v2(request)
    
    @pytest.mark.asyncio
    async def test_structured_prompt_v2_success(self, client):
        """Test successful StructuredPromptV2 API call."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "request_id": "test-456",
            "status": "completed",
            "structured_prompt": {"style": "photorealistic", "subject": "lion"}
        }
        
        with patch.object(client, '_make_request_with_retry', return_value=mock_response):
            request = StructuredPromptV2Request(prompt="lion in forest")
            response = await client.structured_prompt_v2(request)
            
            assert response.request_id == "test-456"
            assert response.status == AsyncOperationStatus.COMPLETED
            assert response.structured_prompt == {"style": "photorealistic", "subject": "lion"}
    
    @pytest.mark.asyncio
    async def test_structured_prompt_v2_validation_error(self, client):
        """Test StructuredPromptV2 with invalid input validation."""
        # Test no inputs provided
        request = StructuredPromptV2Request()
        with pytest.raises(ValueError, match="Either 'prompt' or 'image_url' must be provided"):
            await client.structured_prompt_v2(request)
        
        # Test both inputs provided
        request = StructuredPromptV2Request(
            prompt="test",
            image_url="http://example.com/image.jpg"
        )
        with pytest.raises(ValueError, match="Only one of 'prompt' or 'image_url' should be provided"):
            await client.structured_prompt_v2(request)
    
    @pytest.mark.asyncio
    async def test_refine_image_v2_success(self, client):
        """Test successful RefineImageV2 API call."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "request_id": "test-789",
            "status": "completed",
            "refined_image_url": "https://example.com/refined.jpg",
            "structured_prompt": {"refinement": "enhanced"},
            "seed": 67890
        }
        
        with patch.object(client, '_make_request_with_retry', return_value=mock_response):
            request = RefineImageV2Request(image_url="https://example.com/original.jpg")
            response = await client.refine_image_v2(request)
            
            assert response.request_id == "test-789"
            assert response.status == AsyncOperationStatus.COMPLETED
            assert response.refined_image_url == "https://example.com/refined.jpg"
            assert response.seed == 67890
    
    @pytest.mark.asyncio
    async def test_async_polling(self, client):
        """Test async status polling functionality."""
        # Mock initial response with status URL
        initial_response = MagicMock()
        initial_response.status_code = 200
        initial_response.json.return_value = {
            "request_id": "test-async",
            "status": "pending",
            "status_url": "https://api.test.com/status/test-async"
        }
        
        # Mock polling responses
        polling_responses = [
            {"request_id": "test-async", "status": "running"},
            {"request_id": "test-async", "status": "completed", "image_url": "https://example.com/final.jpg"}
        ]
        
        with patch.object(client, '_make_request_with_retry', side_effect=[initial_response] + [
            MagicMock(status_code=200, json=lambda: resp) for resp in polling_responses
        ]):
            request = GenerateImageV2Request(prompt="test async")
            response = await client.generate_image_v2(request, wait_for_completion=True)
            
            assert response.request_id == "test-async"
            assert response.status == AsyncOperationStatus.COMPLETED
            assert response.image_url == "https://example.com/final.jpg"
    
    @pytest.mark.asyncio
    async def test_retry_logic_rate_limit(self, client):
        """Test retry logic for rate limit errors."""
        # First call returns 429, second call succeeds
        responses = [
            MagicMock(status_code=429, content=b'{"error": "rate limited"}'),
            MagicMock(status_code=200, json=lambda: {"request_id": "success", "status": "completed"})
        ]
        responses[0].json.return_value = {"error": "rate limited"}
        responses[1].raise_for_status = MagicMock()
        
        with patch.object(client.client, 'request', side_effect=responses):
            with patch('asyncio.sleep'):  # Speed up test
                response = await client._make_request_with_retry("GET", "https://test.com")
                assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_retry_logic_max_retries_exceeded(self, client):
        """Test retry logic when max retries exceeded."""
        # All calls return 429
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.content = b'{"error": "rate limited"}'
        mock_response.json.return_value = {"error": "rate limited"}
        
        with patch.object(client.client, 'request', return_value=mock_response):
            with patch('asyncio.sleep'):  # Speed up test
                with pytest.raises(BriaAPIRateLimitError):
                    await client._make_request_with_retry("GET", "https://test.com")
    
    @pytest.mark.asyncio
    async def test_timeout_error(self, client):
        """Test timeout error handling."""
        with patch.object(client.client, 'request', side_effect=httpx.TimeoutException("Timeout")):
            with patch('asyncio.sleep'):  # Speed up test
                with pytest.raises(BriaAPITimeoutError):
                    await client._make_request_with_retry("GET", "https://test.com")
    
    @pytest.mark.asyncio
    async def test_client_error_no_retry(self, client):
        """Test that 4xx errors are not retried."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.content = b'{"error": "bad request"}'
        mock_response.json.return_value = {"error": "bad request"}
        
        with patch.object(client.client, 'request', return_value=mock_response):
            with pytest.raises(BriaAPIError) as exc_info:
                await client._make_request_with_retry("GET", "https://test.com")
            
            assert exc_info.value.status_code == 400
    
    @pytest.mark.asyncio
    async def test_polling_timeout(self, client):
        """Test polling timeout handling."""
        status_url = "https://api.test.com/status/test"
        
        # Mock response that never completes
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "running"}
        
        with patch.object(client, '_make_request_with_retry', return_value=mock_response):
            with patch('asyncio.sleep'):  # Speed up test
                with pytest.raises(BriaAPITimeoutError, match="Polling timeout"):
                    await client._poll_status(status_url)
    
    @pytest.mark.asyncio
    async def test_polling_operation_failed(self, client):
        """Test polling when operation fails."""
        status_url = "https://api.test.com/status/test"
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "failed",
            "error": "Processing failed"
        }
        
        with patch.object(client, '_make_request_with_retry', return_value=mock_response):
            with pytest.raises(BriaAPIError, match="Operation failed: Processing failed"):
                await client._poll_status(status_url)


class TestBriaClientFactory:
    """Test cases for Bria client factory function."""
    
    def test_create_bria_client_success(self):
        """Test successful client creation from settings."""
        with patch('app.core.config.settings') as mock_settings:
            mock_settings.BRIA_API_KEY = "test-key"
            mock_settings.BRIA_API_BASE_URL = "https://api.test.com"
            mock_settings.BRIA_API_TIMEOUT = 30.0
            mock_settings.BRIA_API_MAX_RETRIES = 3
            mock_settings.BRIA_API_RETRY_DELAY = 1.0
            mock_settings.BRIA_API_MAX_RETRY_DELAY = 60.0
            mock_settings.BRIA_API_POLLING_INTERVAL = 2.0
            mock_settings.BRIA_API_MAX_POLLING_TIMEOUT = 300.0
            
            client = create_bria_client()
            
            assert client.api_key == "test-key"
            assert client.base_url == "https://api.test.com"
            assert client.timeout == 30.0
            assert client.max_retries == 3
    
    def test_create_bria_client_missing_api_key(self):
        """Test client creation fails when API key is missing."""
        with patch('app.core.config.settings') as mock_settings:
            mock_settings.BRIA_API_KEY = None
            
            with pytest.raises(ValueError, match="BRIA_API_KEY setting is required"):
                create_bria_client()