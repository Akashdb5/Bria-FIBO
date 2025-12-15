"""
Management command to seed system node type definitions.
"""
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
# Current file is at: backend/app/management/commands/seed_nodes.py
# parent = commands, parent.parent = management, parent.parent.parent = app, parent.parent.parent.parent = backend
current_file = Path(__file__)
backend_dir = current_file.parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = backend_dir / ".env"
load_dotenv(env_path)

from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models import Node
from app.services.node_service import NodeService
from app.schemas.node import SYSTEM_NODE_TYPES


def seed_node_types():
    """Seed the database with system node type definitions."""
    print("Starting node type seeding...")
    print("Seeding Bria API v2 node types based on latest documentation...")
    
    # Create database session
    db: Session = SessionLocal()
    
    try:
        # Create node service
        node_service = NodeService(db)
        
        # Seed system node types
        created_nodes = node_service.seed_system_node_types()
        
        print(f"Successfully seeded {len(created_nodes)} node types:")
        for node in created_nodes:
            node_def = SYSTEM_NODE_TYPES.get(node.node_type, {})
            status = node_def.get("status", "Available")
            vlm_bridge = node_def.get("vlm_bridge", "N/A")
            api_endpoint = node_def.get("api_endpoint", "N/A")
            
            print(f"  - {node.node_type}")
            print(f"    Description: {node.description}")
            print(f"    API Endpoint: {api_endpoint}")
            print(f"    VLM Bridge: {vlm_bridge}")
            print(f"    Status: {status}")
            print()
        
        print("Node type seeding completed successfully!")
        
    except Exception as e:
        print(f"Error during node type seeding: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


def update_node_schemas():
    """Update existing node type schemas with latest definitions."""
    print("Starting node schema update...")
    
    # Create database session
    db: Session = SessionLocal()
    
    try:
        # Create node service
        node_service = NodeService(db)
        
        updated_count = 0
        
        for node_type, definition in SYSTEM_NODE_TYPES.items():
            existing_node = node_service.get_node_type(node_type)
            
            if existing_node:
                # Update existing node
                existing_node.description = definition["description"]
                existing_node.input_schema = definition["input_schema"]
                existing_node.output_schema = definition["output_schema"]
                updated_count += 1
                print(f"  Updated: {node_type}")
            else:
                print(f"  Node type not found: {node_type} (use seed command to create)")
        
        db.commit()
        print(f"Successfully updated {updated_count} node type schemas!")
        
    except Exception as e:
        print(f"Error during node schema update: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


def list_node_types():
    """List all existing node types in the database."""
    print("Listing all node types...")
    
    # Create database session
    db: Session = SessionLocal()
    
    try:
        # Create node service
        node_service = NodeService(db)
        
        # Get all node types
        nodes = node_service.get_all_node_types()
        
        if not nodes:
            print("No node types found in database.")
            return
        
        print(f"Found {len(nodes)} node types:")
        for node in nodes:
            print(f"  - {node.node_type}")
            print(f"    Description: {node.description}")
            print(f"    Created: {node.created_at}")
            print()
        
    except Exception as e:
        print(f"Error listing node types: {e}")
        raise
    
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Node type management commands")
    parser.add_argument(
        "command",
        choices=["seed", "update", "list"],
        help="Command to execute"
    )
    
    args = parser.parse_args()
    
    if args.command == "seed":
        seed_node_types()
    elif args.command == "update":
        update_node_schemas()
    elif args.command == "list":
        list_node_types()