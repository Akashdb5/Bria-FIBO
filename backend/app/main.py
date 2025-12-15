"""
FastAPI main application module.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.api_v1.api import api_router
from app.core.startup import run_startup_tasks
from app.core.logging_config import setup_logging, get_logger
from app.core.error_handlers import register_exception_handlers

# Initialize logging
setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Bria Workflow Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Register exception handlers
register_exception_handlers(app)


@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    logger.info("Starting up Bria Workflow Platform API")
    run_startup_tasks()
    logger.info("Startup completed successfully")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Bria Workflow Platform API"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}