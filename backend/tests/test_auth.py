"""
Test authentication endpoints.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set testing environment variable
os.environ["TESTING"] = "1"

from app.main import app
from app.db.database import get_db
from app.models.user import User

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Set up test database before each test."""
    # Only create User table for auth tests
    User.__table__.create(bind=engine, checkfirst=True)
    yield
    User.__table__.drop(bind=engine, checkfirst=True)


def test_register_user():
    """Test user registration endpoint."""
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Test User"
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "created_at" in data


def test_register_duplicate_email():
    """Test registration with duplicate email fails."""
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    
    # Register first user
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 201
    
    # Try to register with same email
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["message"]


def test_register_invalid_password():
    """Test registration with invalid password fails."""
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "weak"  # Too short, no uppercase, no digit
    }
    
    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 422  # Validation error


def test_login_success():
    """Test successful user login."""
    # First register a user
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    client.post("/api/v1/auth/register", json=user_data)
    
    # Now login
    login_data = {
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials():
    """Test login with invalid credentials fails."""
    login_data = {
        "email": "nonexistent@example.com",
        "password": "WrongPassword123"
    }
    
    response = client.post("/api/v1/auth/login", json=login_data)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["message"]


def test_protected_endpoint_without_token():
    """Test accessing protected endpoint without token fails."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_protected_endpoint_with_token():
    """Test accessing protected endpoint with valid token succeeds."""
    # Register and login to get token
    user_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    client.post("/api/v1/auth/register", json=user_data)
    
    login_data = {
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    login_response = client.post("/api/v1/auth/login", json=login_data)
    token = login_response.json()["access_token"]
    
    # Access protected endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test User"
    assert data["email"] == "test@example.com"