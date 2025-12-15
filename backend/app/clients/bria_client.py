"""
Bria API client for v2 endpoints with async support and retry logic.
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
from enum import Enum
import httpx
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.core.logging_config import get_logger

import json

logger = get_logger(__name__)


class BriaAPIError(ExternalAPIError):
    """Base exception for Bria API errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message, "Bria API", status_code, response_data)


class BriaAPITimeoutError(BriaAPIError):
    """Exception for API timeout errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message, status_code, response_data)


class BriaAPIRateLimitError(BriaAPIError):
    """Exception for API rate limit errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message, status_code, response_data)


class AsyncOperationStatus(str, Enum):
    """Status values for async operations."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Request/Response Models for Bria API v2 endpoints

class ImageGenerateV2Request(BaseModel):
    """Request model for /image/generate API."""
    prompt: Optional[str] = None
    images: Optional[List[str]] = None
    structured_prompt: Optional[Dict[str, Any]] = None
    aspect_ratio: str = "1:1"
    steps_num: int = 50
    seed: Optional[int] = None


class ImageGenerateLiteV2Request(BaseModel):
    """Request model for /image/generate/lite API."""
    prompt: Optional[str] = None
    images: Optional[List[str]] = None
    structured_prompt: Optional[Dict[str, Any]] = None
    aspect_ratio: str = "1:1"
    steps_num: int = 50
    seed: Optional[int] = None


class StructuredPromptGenerateV2Request(BaseModel):
    """Request model for /structured_prompt/generate API."""
    prompt: Optional[str] = None
    images: Optional[List[str]] = None
    structured_prompt: Optional[Dict[str, Any]] = None


class StructuredPromptGenerateLiteV2Request(BaseModel):
    """Request model for /structured_prompt/generate/lite API."""
    prompt: Optional[str] = None
    images: Optional[List[str]] = None
    structured_prompt: Optional[Dict[str, Any]] = None


class BriaAPIResponse(BaseModel):
    """Base response model for Bria API."""
    request_id: str
    status: AsyncOperationStatus = AsyncOperationStatus.PENDING
    status_url: Optional[str] = None

    @field_validator('status', mode='before')
    @classmethod
    def validate_status(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.lower()
        return v


class ImageGenerateV2Response(BriaAPIResponse):
    """Response model for /image/generate API."""
    image_url: Optional[str] = None
    seed: Optional[int] = None
    structured_prompt: Optional[Dict[str, Any]] = None

    @field_validator('structured_prompt', mode='before')
    @classmethod
    def validate_structured_prompt(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v


class ImageGenerateLiteV2Response(BriaAPIResponse):
    """Response model for /image/generate/lite API."""
    image_url: Optional[str] = None
    seed: Optional[int] = None
    structured_prompt: Optional[Dict[str, Any]] = None

    @field_validator('structured_prompt', mode='before')
    @classmethod
    def validate_structured_prompt(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v


class StructuredPromptGenerateV2Response(BriaAPIResponse):
    """Response model for /structured_prompt/generate API."""
    structured_prompt: Optional[Dict[str, Any]] = None

    @field_validator('structured_prompt', mode='before')
    @classmethod
    def validate_structured_prompt(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v


class StructuredPromptGenerateLiteV2Response(BriaAPIResponse):
    """Response model for /structured_prompt/generate/lite API."""
    structured_prompt: Optional[Dict[str, Any]] = None

    @field_validator('structured_prompt', mode='before')
    @classmethod
    def validate_structured_prompt(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return v
        return v


class BriaAPIClient:
    """
    Async HTTP client for Bria AI v2 APIs with retry logic and status polling.
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.bria.ai/v2",
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        max_retry_delay: float = 60.0,
        polling_interval: float = 2.0,
        max_polling_timeout: float = 300.0,
        mock_mode: bool = False
    ):
        """
        Initialize Bria API client.
        
        Args:
            api_key: Bria API key for authentication
            base_url: Base URL for Bria API endpoints
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            retry_delay: Initial delay between retries in seconds
            max_retry_delay: Maximum delay between retries in seconds
            polling_interval: Interval between status polls in seconds
            max_polling_timeout: Maximum time to poll for completion in seconds
            mock_mode: Enable mock mode for development/testing
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.max_retry_delay = max_retry_delay
        self.polling_interval = polling_interval
        self.max_polling_timeout = max_polling_timeout
        self.mock_mode = mock_mode
        
        # Create HTTP client with default headers
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            headers={
                "api_token": api_key,
                "Content-Type": "application/json",
                "User-Agent": "BriaWorkflowPlatform/1.0"
            }
        )
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.client.aclose()
    
    def _log_request_details(self, method: str, url: str, kwargs: Dict[str, Any]) -> None:
        """Log outgoing request URL and payload for debugging."""
        try:
            payload = None
            for key in ("json", "data", "content"):
                if key in kwargs:
                    payload = kwargs[key]
                    break
            
            if payload is None:
                logger.info("Bria API request %s %s (no payload)", method, url)
                return
            
            if isinstance(payload, (bytes, bytearray)):
                payload_str = payload.decode("utf-8", errors="replace")
            elif isinstance(payload, str):
                payload_str = payload
            else:
                payload_str = json.dumps(payload, ensure_ascii=False, indent=2)
            
            logger.info("Bria API request %s %s payload:\n%s", method, url, payload_str)
        except Exception as exc:
            logger.warning("Failed to log Bria API request for %s %s: %s", method, url, exc)
    
    async def _make_request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> httpx.Response:
        """
        Make HTTP request with exponential backoff retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            **kwargs: Additional arguments for httpx request
            
        Returns:
            HTTP response object
            
        Raises:
            BriaAPIError: For API errors
            BriaAPITimeoutError: For timeout errors
            BriaAPIRateLimitError: For rate limit errors
        """
        last_exception = None
        delay = self.retry_delay
        
        for attempt in range(self.max_retries + 1):
            try:
                self._log_request_details(method, url, kwargs)
                response = await self.client.request(method, url, **kwargs)
                
                # Handle rate limiting
                if response.status_code == 429:
                    if attempt == self.max_retries:
                        raise BriaAPIRateLimitError(
                            "Rate limit exceeded",
                            status_code=429,
                            response_data=response.json() if response.content else None
                        )
                    
                    # Wait longer for rate limits
                    await asyncio.sleep(min(delay * 2, self.max_retry_delay))
                    delay = min(delay * 2, self.max_retry_delay)
                    continue
                
                # Handle server errors (5xx) - retry these
                if 500 <= response.status_code < 600:
                    if attempt == self.max_retries:
                        raise BriaAPIError(
                            f"Server error: {response.status_code}",
                            status_code=response.status_code,
                            response_data=response.json() if response.content else None
                        )
                    
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, self.max_retry_delay)
                    continue
                
                # Handle client errors (4xx) - don't retry these
                if 400 <= response.status_code < 500:
                    error_data = response.json() if response.content else None
                    raise BriaAPIError(
                        f"Client error: {response.status_code}",
                        status_code=response.status_code,
                        response_data=error_data
                    )
                
                # Success case
                response.raise_for_status()
                return response
                
            except httpx.TimeoutException as e:
                last_exception = e
                if attempt == self.max_retries:
                    raise BriaAPITimeoutError(f"Request timeout after {self.max_retries} retries")
                
                await asyncio.sleep(delay)
                delay = min(delay * 2, self.max_retry_delay)
                
            except httpx.RequestError as e:
                last_exception = e
                if attempt == self.max_retries:
                    raise BriaAPIError(f"Request error: {str(e)}")
                
                await asyncio.sleep(delay)
                delay = min(delay * 2, self.max_retry_delay)
        
        # This should never be reached, but just in case
        raise BriaAPIError(f"Max retries exceeded: {str(last_exception)}")
    
    async def _poll_status(self, status_url: str) -> Dict[str, Any]:
        """
        Poll status URL until operation completes or times out.
        
        Args:
            status_url: URL to poll for operation status
            
        Returns:
            Final response data when operation completes
            
        Raises:
            BriaAPITimeoutError: If polling times out
            BriaAPIError: For API errors during polling
        """
        start_time = asyncio.get_event_loop().time()
        
        while True:
            current_time = asyncio.get_event_loop().time()
            if current_time - start_time > self.max_polling_timeout:
                raise BriaAPITimeoutError(
                    f"Polling timeout after {self.max_polling_timeout} seconds"
                )
            
            try:
                response = await self._make_request_with_retry("GET", status_url)
                data = response.json()
                
                status = data.get("status", "").lower()
                
                if status == "in_progress":
                    status = AsyncOperationStatus.RUNNING
                elif status == "error":
                    status = AsyncOperationStatus.FAILED
                elif status == "unknown":
                    status = AsyncOperationStatus.FAILED
                
                if status == AsyncOperationStatus.COMPLETED or status == "completed":
                    logger.info(f"Operation completed: {status_url}")
                    # Flatten result if present
                    if "result" in data and isinstance(data["result"], dict):
                        data.update(data["result"])
                    return data
                elif status == AsyncOperationStatus.FAILED or status == "failed":
                    error_msg = data.get("error", "Operation failed")
                    raise BriaAPIError(f"Operation failed: {error_msg}", response_data=data)
                elif status in [AsyncOperationStatus.PENDING, AsyncOperationStatus.RUNNING, "pending", "running"]:
                    logger.debug(f"Operation {status}: {status_url}")
                    await asyncio.sleep(self.polling_interval)
                    continue
                else:
                    logger.warning(f"Unknown status '{status}' for {status_url}")
                    await asyncio.sleep(self.polling_interval)
                    continue
                    
            except BriaAPIError:
                raise
            except Exception as e:
                logger.error(f"Error polling status {status_url}: {e}")
                await asyncio.sleep(self.polling_interval)
                continue
    
    async def image_generate_v2(
        self,
        request: ImageGenerateV2Request,
        wait_for_completion: bool = True
    ) -> ImageGenerateV2Response:
        """
        Generate image using /image/generate API (Gemini 2.5 Flash VLM bridge).
        
        Args:
            request: ImageGenerateV2 request parameters
            wait_for_completion: Whether to wait for async operation to complete
            
        Returns:
            ImageGenerateV2Response with operation results
            
        Raises:
            BriaAPIError: For API errors
            ValueError: For invalid request parameters
        """
        if self.mock_mode:
            logger.info("Mock mode: Generating mock image response")
            await asyncio.sleep(0.5)  # Simulate API delay
            return ImageGenerateV2Response(
                status=AsyncOperationStatus.COMPLETED,
                result_url="https://mock-cdn.example.com/generated-image-123.jpg",
                status_url=None,
                operation_id="mock-operation-123",
                message="Mock image generation completed successfully"
            )
        
        url = f"{self.base_url}/image/generate"
        payload = request.model_dump(exclude_none=True)
        
        logger.info(f"Generating image with /image/generate: {url}")
        
        response = await self._make_request_with_retry("POST", url, json=payload)
        data = response.json()
        
        # Create initial response
        api_response = ImageGenerateV2Response(**data)
        
        # If async and we should wait for completion, poll status
        if wait_for_completion and api_response.status_url:
            logger.info(f"Polling for completion: {api_response.status_url}")
            final_data = await self._poll_status(api_response.status_url)
            api_response = ImageGenerateV2Response(**final_data)
        
        return api_response
    
    async def image_generate_lite_v2(
        self,
        request: ImageGenerateLiteV2Request,
        wait_for_completion: bool = True
    ) -> ImageGenerateLiteV2Response:
        """
        Generate image using /image/generate/lite API (FIBO-VLM bridge).
        
        Args:
            request: ImageGenerateLiteV2 request parameters
            wait_for_completion: Whether to wait for async operation to complete
            
        Returns:
            ImageGenerateLiteV2Response with operation results
            
        Raises:
            BriaAPIError: For API errors
            ValueError: For invalid request parameters
        """
        url = f"{self.base_url}/image/generate/lite"
        payload = request.model_dump(exclude_none=True)
        
        logger.info(f"Generating image with /image/generate/lite: {url}")
        
        response = await self._make_request_with_retry("POST", url, json=payload)
        data = response.json()
        
        # Create initial response
        api_response = ImageGenerateLiteV2Response(**data)
        
        # If async and we should wait for completion, poll status
        if wait_for_completion and api_response.status_url:
            logger.info(f"Polling for completion: {api_response.status_url}")
            final_data = await self._poll_status(api_response.status_url)
            api_response = ImageGenerateLiteV2Response(**final_data)
        
        return api_response
    
    async def structured_prompt_generate_v2(
        self,
        request: StructuredPromptGenerateV2Request,
        wait_for_completion: bool = True
    ) -> StructuredPromptGenerateV2Response:
        """
        Generate structured prompt using /structured_prompt/generate API (Gemini 2.5 Flash VLM bridge).
        
        Args:
            request: StructuredPromptGenerateV2 request parameters
            wait_for_completion: Whether to wait for async operation to complete
            
        Returns:
            StructuredPromptGenerateV2Response with operation results
            
        Raises:
            BriaAPIError: For API errors
            ValueError: For invalid request parameters
        """
        if self.mock_mode:
            logger.info("Mock mode: Generating mock structured prompt response")
            await asyncio.sleep(0.3)  # Simulate API delay
            return StructuredPromptGenerateV2Response(
                status=AsyncOperationStatus.COMPLETED,
                result="A detailed, professional iPhone advertisement featuring the latest model with sleek design, premium materials, and cutting-edge technology. The image showcases the device in an elegant setting with perfect lighting and composition.",
                status_url=None,
                operation_id="mock-prompt-operation-456",
                message="Mock structured prompt generation completed successfully"
            )
        
        url = f"{self.base_url}/structured_prompt/generate"
        payload = request.model_dump(exclude_none=True)
        
        logger.info(f"Generating structured prompt with /structured_prompt/generate: {url}")
        
        response = await self._make_request_with_retry("POST", url, json=payload)
        data = response.json()
        
        # Create initial response
        api_response = StructuredPromptGenerateV2Response(**data)
        
        # If async and we should wait for completion, poll status
        if wait_for_completion and api_response.status_url:
            logger.info(f"Polling for completion: {api_response.status_url}")
            final_data = await self._poll_status(api_response.status_url)
            api_response = StructuredPromptGenerateV2Response(**final_data)
        
        return api_response
    
    async def structured_prompt_generate_lite_v2(
        self,
        request: StructuredPromptGenerateLiteV2Request,
        wait_for_completion: bool = True
    ) -> StructuredPromptGenerateLiteV2Response:
        """
        Generate structured prompt using /structured_prompt/generate/lite API (FIBO-VLM bridge).
        
        Args:
            request: StructuredPromptGenerateLiteV2 request parameters
            wait_for_completion: Whether to wait for async operation to complete
            
        Returns:
            StructuredPromptGenerateLiteV2Response with operation results
            
        Raises:
            BriaAPIError: For API errors
            ValueError: For invalid request parameters
        """
        url = f"{self.base_url}/structured_prompt/generate/lite"
        payload = request.model_dump(exclude_none=True)
        
        logger.info(f"Generating structured prompt with /structured_prompt/generate/lite: {url}")
        
        response = await self._make_request_with_retry("POST", url, json=payload)
        data = response.json()
        
        # Create initial response
        api_response = StructuredPromptGenerateLiteV2Response(**data)
        
        # If async and we should wait for completion, poll status
        if wait_for_completion and api_response.status_url:
            logger.info(f"Polling for completion: {api_response.status_url}")
            final_data = await self._poll_status(api_response.status_url)
            api_response = StructuredPromptGenerateLiteV2Response(**final_data)
        
        return api_response
    
    async def get_status(self, status_url: str) -> Dict[str, Any]:
        """
        Get status of an async operation.
        
        Args:
            status_url: URL to check operation status
            
        Returns:
            Status response data
            
        Raises:
            BriaAPIError: For API errors
        """
        response = await self._make_request_with_retry("GET", status_url)
        return response.json()
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Factory function to create client from settings
def create_bria_client() -> BriaAPIClient:
    """
    Create BriaAPIClient instance from application settings.
    
    Returns:
        Configured BriaAPIClient instance
        
    Raises:
        ValueError: If required settings are missing
    """
    from app.core.config import settings
    
    if not settings.BRIA_API_KEY:
        raise ValueError("BRIA_API_KEY setting is required")
    
    return BriaAPIClient(
        api_key=settings.BRIA_API_KEY,
        base_url=settings.BRIA_API_BASE_URL,
        timeout=settings.BRIA_API_TIMEOUT,
        max_retries=settings.BRIA_API_MAX_RETRIES,
        retry_delay=settings.BRIA_API_RETRY_DELAY,
        max_retry_delay=settings.BRIA_API_MAX_RETRY_DELAY,
        polling_interval=settings.BRIA_API_POLLING_INTERVAL,
        max_polling_timeout=settings.BRIA_API_MAX_POLLING_TIMEOUT
    )
