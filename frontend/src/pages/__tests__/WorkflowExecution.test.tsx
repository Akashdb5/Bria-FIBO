import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkflowExecution from '../WorkflowExecution'

// Mock the API
vi.mock('@/lib/api', () => ({
  workflowAPI: {
    getWorkflow: vi.fn(),
  },
  workflowRunAPI: {
    createWorkflowRun: vi.fn(),
  },
}))

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ workflowId: 'test-workflow-id' }),
    useNavigate: () => vi.fn(),
  }
})

// Mock WorkflowCanvas component
vi.mock('@/components/workflow/WorkflowCanvas', () => ({
  default: ({ onNodeSelect }: { onNodeSelect: (node: any) => void }) => (
    <div data-testid="workflow-canvas">
      <button onClick={() => onNodeSelect(null)}>Mock Canvas</button>
    </div>
  ),
}))

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('WorkflowExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    renderWithProviders(<WorkflowExecution />)
    
    expect(screen.getByText('Loading workflow...')).toBeInTheDocument()
  })

  it('renders workflow execution interface', async () => {
    const { workflowAPI } = await import('@/lib/api')
    
    // Mock successful workflow fetch
    vi.mocked(workflowAPI.getWorkflow).mockResolvedValue({
      data: {
        id: 'test-workflow-id',
        name: 'Test Workflow',
        workflow_definition: {
          nodes: [
            {
              id: 'node1',
              type: 'StructuredPromptGenerateV2',
              position: { x: 0, y: 0 },
              data: {
                label: 'Test Node',
                nodeType: 'StructuredPromptGenerateV2',
                config: { prompt: 'Test prompt' }
              }
            }
          ],
          edges: []
        },
        created_at: '2023-01-01T00:00:00Z'
      }
    })

    renderWithProviders(<WorkflowExecution />)

    await waitFor(() => {
      expect(screen.getByText('Execute Workflow')).toBeInTheDocument()
    })

    expect(screen.getByText('Test Workflow')).toBeInTheDocument()
    expect(screen.getByText('Execute Workflow')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
  })

  it('handles workflow loading error', async () => {
    const { workflowAPI } = await import('@/lib/api')
    
    // Mock failed workflow fetch
    vi.mocked(workflowAPI.getWorkflow).mockRejectedValue(new Error('Failed to load'))

    renderWithProviders(<WorkflowExecution />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load workflow')).toBeInTheDocument()
    })

    expect(screen.getByText('Back to Workflows')).toBeInTheDocument()
  })
})