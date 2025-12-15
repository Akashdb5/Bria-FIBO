# Bria Workflow Platform

A comprehensive visual workflow platform for creating and executing AI-powered image generation workflows using Bria AI's v2 APIs. The platform provides a node-based interface built with ReactFlow, enabling users to design complex image generation pipelines with real-time execution monitoring and approval workflows.

## 🚀 Features

- **Visual Workflow Builder**: Drag-and-drop interface using ReactFlow for creating complex image generation workflows
- **Node-Based Architecture**: Support for GenerateImageV2, StructuredPromptV2, and RefineImageV2 node types
- **User Approval Workflows**: Interactive approval system for structured prompt generation with editing capabilities
- **Real-Time Execution**: Asynchronous workflow execution with live status updates and progress tracking
- **Comprehensive History**: Complete execution snapshots with downloadable generated images
- **JWT Authentication**: Secure user authentication and authorization system
- **Responsive UI**: Modern React interface built with Tailwind CSS and shadcn/ui components

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │   Bria AI APIs  │
│   (ReactFlow)    │◄──►│   (PostgreSQL)   │◄──►│   (v2 Endpoints)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Technology Stack

**Backend:**
- FastAPI with async/await support
- PostgreSQL with SQLAlchemy ORM
- JWT authentication with bcrypt password hashing
- Alembic for database migrations
- HTTPX for Bria API integration
- Comprehensive error handling and logging

**Frontend:**
- React 18 with TypeScript
- ReactFlow for visual workflow editing
- Tailwind CSS with shadcn/ui components
- React Query for server state management
- React Hook Form with Zod validation
- Axios for API communication

**Infrastructure:**
- Docker Compose for development environment
- PostgreSQL 15 database
- Redis for caching and session management

## 📁 Project Structure

```
bria-workflow-platform/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── api/               # API routes and endpoints
│   │   ├── core/              # Core functionality (auth, config, deps)
│   │   ├── models/            # SQLAlchemy database models
│   │   ├── schemas/           # Pydantic models for validation
│   │   ├── services/          # Business logic layer
│   │   ├── clients/           # External API clients (Bria)
│   │   └── management/        # CLI commands and utilities
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Backend test suite
│   ├── requirements.txt       # Python dependencies
│   └── alembic.ini           # Alembic configuration
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Route components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── contexts/         # React context providers
│   │   ├── lib/              # Utility functions and API client
│   │   └── utils/            # Helper utilities
│   ├── public/               # Static assets
│   ├── package.json          # Node.js dependencies
│   └── vite.config.ts        # Vite configuration
├── logs/                     # Application logs
├── docker-compose.yml        # Development environment
└── README.md                 # This file
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd bria-workflow-platform
   ```

2. **Start the development environment:**
   ```bash
   docker-compose up -d
   ```

3. **Set up the backend:**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Copy environment file and configure
   cp .env.example .env
   # Edit .env with your Bria API credentials
   
   # Run database migrations
   alembic upgrade head
   
   # Seed initial node types
   python -m app.management.commands.seed_nodes
   ```

4. **Set up the frontend:**
   ```bash
   cd frontend
   
   # Install dependencies
   npm install
   
   # Copy environment file
   cp .env.example .env
   # Configure frontend environment variables
   ```

5. **Start the development servers:**
   ```bash
   # Terminal 1: Backend
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

### Environment Configuration

**Backend (.env):**
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bria_workflow

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Bria API
BRIA_API_KEY=your-bria-api-key
BRIA_BASE_URL=https://api.bria.ai/v2

# Logging
LOG_LEVEL=INFO
```

**Frontend (.env):**
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME=Bria Workflow Platform
```

## 🚀 Running the Application

### Development Mode

1. **Backend API**: `http://localhost:8000`
   - Interactive API docs: `http://localhost:8000/docs`
   - ReDoc documentation: `http://localhost:8000/redoc`

2. **Frontend Application**: `http://localhost:3000`

3. **Database**: `localhost:5432`
   - Username: `postgres`
   - Password: `postgres`
   - Database: `bria_workflow`

### Production Deployment

The application is containerized and ready for production deployment. Ensure you:

1. Set secure environment variables
2. Configure proper database connections
3. Set up SSL/TLS certificates
4. Configure reverse proxy (nginx/Apache)
5. Set up monitoring and logging

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_workflow_endpoints.py

# Run property-based tests
pytest tests/ -k "property"
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run property-based tests
npm test -- --testNamePattern="Property"
```

### End-to-End Testing

```bash
# Run integration tests
python backend/tests/test_integration_e2e.py
npm test frontend/src/test/integration-e2e.test.tsx
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### Workflow Endpoints

- `GET /api/v1/workflows` - List user workflows
- `POST /api/v1/workflows` - Create new workflow
- `GET /api/v1/workflows/{id}` - Get workflow details
- `PUT /api/v1/workflows/{id}` - Update workflow
- `DELETE /api/v1/workflows/{id}` - Delete workflow

### Execution Endpoints

- `POST /api/v1/workflows/{id}/runs` - Execute workflow
- `GET /api/v1/workflow-runs` - List workflow runs
- `GET /api/v1/workflow-runs/{id}` - Get run details
- `POST /api/v1/workflow-runs/{id}/approve` - Approve structured prompt

### Node Management

- `GET /api/v1/nodes` - List available node types
- `POST /api/v1/nodes` - Create custom node type (admin)

## 🎯 Workflow Node Types

### GenerateImageV2
Generates images using Bria's image generation API.

**Inputs:**
- `prompt` (string): Text description for image generation
- `images` (array): Reference images for style/content
- `structured_prompt` (object): Structured prompt from StructuredPromptV2 node

**Outputs:**
- `image` (string): Generated image URL
- `seed` (number): Random seed used for generation
- `structured_prompt` (object): Generated structured prompt

### StructuredPromptV2
Creates structured prompts with user approval workflow.

**Inputs:**
- `prompt` (string): Base text prompt
- `image` (string): Reference image for prompt generation

**Outputs:**
- `structured_prompt` (object): User-approved structured prompt

**Special Behavior:** Pauses execution for user review and approval.

### RefineImageV2
Refines existing images while preserving structure.

**Inputs:**
- `image` (string): Image to refine
- `prompt` (string): Refinement instructions
- `structured_prompt` (object): Optional structured prompt

**Outputs:**
- `image` (string): Refined image URL
- `structured_prompt` (object): Generated structured prompt



## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running: `docker-compose ps`
   - Check connection string in `.env`
   - Verify database exists: `docker-compose exec postgres psql -U postgres -l`

2. **Bria API Integration Issues**
   - Verify API key in backend `.env`
   - Check API endpoint availability
   - Review logs in `logs/app.log`

3. **Frontend Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility
   - Verify environment variables

4. **Authentication Problems**
   - Check JWT secret key configuration
   - Verify token expiration settings
   - Clear browser localStorage/cookies

### Logging

Application logs are available in:
- `logs/app.log` - General application logs
- `logs/errors.log` - Error-specific logs
- Browser console - Frontend debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test && pytest`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- **Backend**: Black, isort, flake8, mypy
- **Frontend**: ESLint, Prettier, TypeScript strict mode
- **Testing**: Comprehensive unit and property-based tests required

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the [API Documentation](http://localhost:8000/docs)
2. Review the [troubleshooting section](#-troubleshooting)
3. Check existing [GitHub Issues](../../issues)
4. Create a new issue with detailed information
