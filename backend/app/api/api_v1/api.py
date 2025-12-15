"""
API router configuration.
"""
from fastapi import APIRouter
from app.api.api_v1.endpoints import auth, nodes, workflows, workflow_runs, approvals, files

api_router = APIRouter()

# Include authentication router
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])

# Include nodes router
api_router.include_router(nodes.router, prefix="/nodes", tags=["nodes"])

# Include workflows router
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])

# Include workflow runs router
api_router.include_router(workflow_runs.router, prefix="/workflow-runs", tags=["workflow-runs"])

# Include approvals router
api_router.include_router(approvals.router, prefix="/approvals", tags=["approvals"])

# Include files router
api_router.include_router(files.router, prefix="/files", tags=["files"])