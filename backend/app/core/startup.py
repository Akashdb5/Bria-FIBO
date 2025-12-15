"""
Application startup tasks.
"""
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.services.node_service import NodeService


def seed_system_nodes():
    """Seed system node types on application startup."""
    db: Session = SessionLocal()
    
    try:
        node_service = NodeService(db)
        created_nodes = node_service.seed_system_node_types()
        
        print(f"Seeded {len(created_nodes)} system node types")
        for node in created_nodes:
            print(f"  - {node.node_type}")
    
    except Exception as e:
        print(f"Error seeding system nodes: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


def run_startup_tasks():
    """Run all startup tasks."""
    print("Running startup tasks...")
    seed_system_nodes()
    print("Startup tasks completed!")