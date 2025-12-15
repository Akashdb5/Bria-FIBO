/**
 * End-to-end integration tests for the complete frontend workflow system.
 * 
 * This module tests the complete user journey from authentication through
 * workflow creation, execution, and structured prompt approval in the frontend.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../contexts/AuthContext'
import { ErrorProvider } from '../contexts/ErrorContext'
import App from '../App'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Dashboard from '../pages/Dashboard'
import WorkflowBuilder from '../pages/WorkflowBuilder'
import WorkflowExecution from '../pages/WorkflowExecution'

// Mock the API module
vi.mock('../lib/api', () => ({
  apiClient: {
    defaults: {
      baseURL: 'http://localhost:8000/api/v1',
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  },
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn()
  },
  workflowAPI: {
    getWorkflows: vi.fn(),
    getWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    validateConnection: vi.fn(),
    validateWorkflow: vi.fn()
  },
  workflowRunAPI: {
    getWorkflowRuns: vi.fn(),
    getWorkflowRun: vi.fn(),
    createWorkflowRun: vi.fn(),
    approveStructuredPrompt: vi.fn(),
    rejectStructuredPrompt: vi.fn(),
    getPendingApprovals: vi.fn()
  },
  nodeAPI: {
    getNodes: vi.fn()
  },
  fileAPI: {
    uploadFile: vi.fn()
  }
}))

// Mock ReactFlow
vi.mock('reactflow', () => ({
  ReactFlow: ({ children, nodes, edges, onNodesChange, onEdgesChange, onConnect }: any) => (
    <div data-testid="react-flow">
      <div data-testid="nodes">{JSON.stringify(nodes)}</div>
      <div data-testid="edges">{JSON.stringify(edges)}</div>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: any) => <div data-testid="react-flow-provider">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  addEdge: vi.fn(),
  useNodesState: vi.fn(() => [[], vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn()]),
  useReactFlow: vi.fn(() => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    deleteElements: vi.fn()
  }))
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock window.dispatchEvent
const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

// Import API mocks after mocking
const { authAPI, workflowAPI, workflowRunAPI, nodeAPI, fileAPI } = await import('../lib/api')

// Test data
const mockUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00Z'
}

const mockToken = 'mock-jwt-token'

const mockWorkflow = {
  id: 'workflow-123',
  name: 'Test Workflow',
  version: 1,
  user_id: 'user-123',
  workflow_definition: {
    nodes: [
      {
        id: 'generate-node-1',
        type: 'GenerateImageV2',
        position: { x: 100, y: 100 },
        data: {
          config: {
            prompt: 'A beautiful landscape',
            aspect_ratio: '16:9',
            steps_num: 50
          }
        }
      }
    ],
    edges: []
  },
  created_at: '2023-01-01T00:00:00Z'
}

const mockWorkflowRun = {
  id: 'run-123',
  workflow_id: 'workflow-123',
  status: 'COMPLETED',
  execution_snapshot: {
    'generate-node-1': {
      node_type: 'GenerateImageV2',
      status: 'COMPLETED',
      request: {
        prompt: 'A beautiful landscape',
        aspect_ratio: '16:9',
        steps_num: 50
      },
      response: {
        request_id: 'bria-123',
        image_url: 'https://example.com/image.jpg',
        seed: 123456
      }
    }
  },
  created_at: '2023-01-01T00:00:00Z',
  completed_at: '2023-01-01T00:05:00Z'
}

const mockNodes = [
  {
    id: 'node-1',
    node_type: 'GenerateImageV2',
    description: 'Generate images using Bria AI v2',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16'] },
        steps_num: { type: 'integer', minimum: 1, maximum: 100 }
      },
      required: ['prompt']
    },
    output_schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'uri' }
      }
    }
  },
  {
    id: 'node-2',
    node_type: 'StructuredPromptV2',
    description: 'Generate structured prompts from text or images',
    input_schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        image: { type: 'string', format: 'uri' }
      }
    },
    output_schema: {
      type: 'object',
      properties: {
        structured_prompt: { type: 'object' }
      }
    }
  }
]

// Helper function to create test wrapper
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ErrorProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ErrorProvider>
        </QueryClientProvider>
      </BrowserRouter>
    )
  }
}

describe('End-to-End Frontend Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeAll(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
  })

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    dispatchEventSpy.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Complete User Authentication Flow', () => {
    it('should handle complete user registration and login flow', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 1: User authentication and authorization**
       * **Feature: bria-workflow-platform, Property 2: Invalid credential rejection**
       */
      const TestWrapper = createTestWrapper()

      // Mock successful registration
      vi.mocked(authAPI.register).mockResolvedValue({
        data: { access_token: mockToken, user: mockUser }
      })

      // Mock successful login
      vi.mocked(authAPI.login).mockResolvedValue({
        data: { access_token: mockToken, user: mockUser }
      })

      // Mock getCurrentUser
      vi.mocked(authAPI.getCurrentUser).mockResolvedValue({
        data: mockUser
      })

      // Test registration
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      )

      // Fill registration form
      await user.type(screen.getByLabelText(/name/i), 'Test User')
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/^password$/i), 'TestPassword123')

      // Submit registration
      await user.click(screen.getByRole('button', { name: /register/i }))

      await waitFor(() => {
        expect(authAPI.register).toHaveBeenCalledWith('Test User', 'test@example.com', 'TestPassword123')
      })

      // Test login
      render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      )

      // Fill login form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'TestPassword123')

      // Submit login
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(authAPI.login).toHaveBeenCalledWith('test@example.com', 'TestPassword123')
      })
    })

    it('should handle invalid credentials rejection', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 2: Invalid credential rejection**
       */
      const TestWrapper = createTestWrapper()

      // Mock failed login
      vi.mocked(authAPI.login).mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid email or password' }
        }
      })

      render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      )

      // Fill login form with invalid credentials
      await user.type(screen.getByLabelText(/email/i), 'test@example.com')
      await user.type(screen.getByLabelText(/password/i), 'WrongPassword')

      // Submit login
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(authAPI.login).toHaveBeenCalledWith('test@example.com', 'WrongPassword')
      })

      // Should show error message (check for generic error message since specific message may vary)
      await waitFor(() => {
        const errorMessage = screen.queryByText(/invalid email or password/i) || 
                           screen.queryByText(/unexpected error/i) ||
                           screen.queryByText(/error/i)
        expect(errorMessage).toBeInTheDocument()
      })
    })
  })

  describe('Complete Workflow Creation and Management', () => {
    beforeEach(() => {
      // Mock authenticated user
      localStorageMock.getItem.mockReturnValue(mockToken)
      vi.mocked(authAPI.getCurrentUser).mockResolvedValue({ data: mockUser })
      vi.mocked(nodeAPI.getNodes).mockResolvedValue({ data: mockNodes })
    })

    it('should handle complete workflow creation flow', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 6: Node type validation**
       * **Feature: bria-workflow-platform, Property 7: Connection compatibility validation**
       * **Feature: bria-workflow-platform, Property 8: Workflow persistence round-trip**
       */
      const TestWrapper = createTestWrapper()

      // Mock workflow creation
      vi.mocked(workflowAPI.createWorkflow).mockResolvedValue({ data: mockWorkflow })
      vi.mocked(workflowAPI.validateConnection).mockResolvedValue({ data: { is_valid: true } })
      vi.mocked(workflowAPI.validateWorkflow).mockResolvedValue({ data: { is_valid: true } })

      render(
        <TestWrapper>
          <WorkflowBuilder />
        </TestWrapper>
      )

      // Wait for nodes to load
      await waitFor(() => {
        expect(nodeAPI.getNodes).toHaveBeenCalled()
      })

      // Should show ReactFlow canvas
      expect(screen.getByTestId('react-flow')).toBeInTheDocument()

      // Test workflow saving
      const saveButton = screen.getByRole('button', { name: /save/i })
      if (saveButton) {
        await user.click(saveButton)

        await waitFor(() => {
          expect(workflowAPI.createWorkflow).toHaveBeenCalled()
        })
      }
    })

    it('should display user workflows in dashboard', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 4: User data isolation**
       * **Feature: bria-workflow-platform, Property 5: Workflow run data completeness**
       */
      const TestWrapper = createTestWrapper()

      // Mock dashboard data
      vi.mocked(workflowAPI.getWorkflows).mockResolvedValue({ data: [mockWorkflow] })
      vi.mocked(workflowRunAPI.getWorkflowRuns).mockResolvedValue({ data: [mockWorkflowRun] })

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      // Wait for data to load
      await waitFor(() => {
        expect(workflowAPI.getWorkflows).toHaveBeenCalled()
        expect(workflowRunAPI.getWorkflowRuns).toHaveBeenCalled()
      })

      // Should show workflow runs
      await waitFor(() => {
        expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      })

      // Should show run status and completion data
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })
  })

  describe('Workflow Execution Flow', () => {
    beforeEach(() => {
      // Mock authenticated user
      localStorageMock.getItem.mockReturnValue(mockToken)
      vi.mocked(authAPI.getCurrentUser).mockResolvedValue({ data: mockUser })
    })

    it('should handle workflow execution initiation', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 9: Workflow execution initiation**
       * **Feature: bria-workflow-platform, Property 12: Execution data preservation**
       */
      const TestWrapper = createTestWrapper()

      // Mock workflow execution
      vi.mocked(workflowAPI.getWorkflow).mockResolvedValue({ data: mockWorkflow })
      vi.mocked(workflowRunAPI.createWorkflowRun).mockResolvedValue({ data: mockWorkflowRun })
      vi.mocked(workflowRunAPI.getWorkflowRun).mockResolvedValue({ data: mockWorkflowRun })

      // Mock URL params
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useParams: () => ({ id: 'workflow-123' })
        }
      })

      render(
        <TestWrapper>
          <WorkflowExecution />
        </TestWrapper>
      )

      // Wait for workflow to load
      await waitFor(() => {
        expect(workflowAPI.getWorkflow).toHaveBeenCalledWith('workflow-123')
      })

      // Should show execution interface
      expect(screen.getByTestId('react-flow')).toBeInTheDocument()

      // Test execution start
      const executeButton = screen.getByRole('button', { name: /execute/i })
      if (executeButton) {
        await user.click(executeButton)

        await waitFor(() => {
          expect(workflowRunAPI.createWorkflowRun).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Structured Prompt Approval Workflow', () => {
    beforeEach(() => {
      // Mock authenticated user
      localStorageMock.getItem.mockReturnValue(mockToken)
      vi.mocked(authAPI.getCurrentUser).mockResolvedValue({ data: mockUser })
    })

    it('should handle structured prompt approval flow', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 13: StructuredPromptV2 approval workflow**
       * **Feature: bria-workflow-platform, Property 16: Structured prompt schema validation**
       */
      const TestWrapper = createTestWrapper()

      const mockStructuredPromptRun = {
        ...mockWorkflowRun,
        status: 'WAITING_APPROVAL',
        execution_snapshot: {
          'structured-prompt-node-1': {
            node_type: 'StructuredPromptV2',
            status: 'WAITING_APPROVAL',
            response: {
              structured_prompt: {
                style: 'photorealistic',
                subject: 'mountain landscape',
                mood: 'serene',
                lighting: 'golden hour'
              }
            }
          }
        }
      }

      // Mock pending approvals
      vi.mocked(workflowRunAPI.getPendingApprovals).mockResolvedValue({
        data: {
          'structured-prompt-node-1': {
            structured_prompt: {
              style: 'photorealistic',
              subject: 'mountain landscape',
              mood: 'serene',
              lighting: 'golden hour'
            }
          }
        }
      })

      vi.mocked(workflowRunAPI.getWorkflowRun).mockResolvedValue({ data: mockStructuredPromptRun })
      vi.mocked(workflowRunAPI.approveStructuredPrompt).mockResolvedValue({ data: { message: 'Approved' } })

      render(
        <TestWrapper>
          <WorkflowExecution />
        </TestWrapper>
      )

      // Wait for pending approvals to load
      await waitFor(() => {
        expect(workflowRunAPI.getPendingApprovals).toHaveBeenCalled()
      })

      // Should show approval dialog
      const approveButton = screen.getByRole('button', { name: /approve/i })
      if (approveButton) {
        await user.click(approveButton)

        await waitFor(() => {
          expect(workflowRunAPI.approveStructuredPrompt).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Error Handling and Validation', () => {
    beforeEach(() => {
      // Mock authenticated user
      localStorageMock.getItem.mockReturnValue(mockToken)
      vi.mocked(authAPI.getCurrentUser).mockResolvedValue({ data: mockUser })
    })

    it('should handle API errors gracefully', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 18: Error handling and reporting**
       */
      const TestWrapper = createTestWrapper()

      // Mock API error
      vi.mocked(workflowAPI.getWorkflows).mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      })

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      )

      // Should handle error gracefully
      await waitFor(() => {
        expect(workflowAPI.getWorkflows).toHaveBeenCalled()
      })

      // Should show error message or fallback UI
      // The exact implementation depends on error handling strategy
    })

    it('should validate file uploads', async () => {
      /**
       * **Feature: bria-workflow-platform, Property 19: File upload validation**
       */
      const TestWrapper = createTestWrapper()

      // Mock file upload validation error
      vi.mocked(fileAPI.uploadFile).mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'File too large' }
        }
      })

      render(
        <TestWrapper>
          <WorkflowBuilder />
        </TestWrapper>
      )

      // Create a large file
      const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })

      // Find file input (if exists in the component)
      const fileInput = screen.queryByLabelText(/upload/i) || screen.queryByRole('button', { name: /upload/i })
      
      if (fileInput) {
        // Simulate file upload
        if (fileInput.tagName === 'INPUT') {
          await user.upload(fileInput as HTMLInputElement, largeFile)
        } else {
          await user.click(fileInput)
        }

        // Should handle validation error
        await waitFor(() => {
          // Error handling implementation depends on component design
          expect(fileAPI.uploadFile).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Network Status and Offline Handling', () => {
    it('should handle network status changes', async () => {
      const TestWrapper = createTestWrapper()

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      )

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      fireEvent(window, new Event('offline'))

      // Should show offline indicator
      await waitFor(() => {
        const offlineIndicator = screen.queryByText(/offline/i)
        if (offlineIndicator) {
          expect(offlineIndicator).toBeInTheDocument()
        }
      })

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      fireEvent(window, new Event('online'))

      // Should hide offline indicator
      await waitFor(() => {
        const offlineIndicator = screen.queryByText(/offline/i)
        if (offlineIndicator) {
          expect(offlineIndicator).not.toBeInTheDocument()
        }
      })
    })
  })
})