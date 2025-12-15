"""
Application configuration settings.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bria Workflow Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "bria_workflow"
    POSTGRES_PORT: str = "5432"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Bria API
    BRIA_API_BASE_URL: str = "https://api.bria.ai/v2"
    BRIA_API_KEY: Optional[str] = None
    BRIA_API_TIMEOUT: float = 30.0
    BRIA_API_MAX_RETRIES: int = 3
    BRIA_API_RETRY_DELAY: float = 1.0
    BRIA_API_MAX_RETRY_DELAY: float = 60.0
    BRIA_API_POLLING_INTERVAL: float = 2.0
    BRIA_API_MAX_POLLING_TIMEOUT: float = 300.0
    BRIA_API_MOCK_MODE: bool = False  # Enable mock mode for development/testing
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        """Convert CORS origins string to list."""
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]
        return self.BACKEND_CORS_ORIGINS
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    model_config = ConfigDict(case_sensitive=True, env_file=".env")


settings = Settings()