import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Dashboard from './Dashboard'
import { ErrorProvider } from '@/contexts/ErrorContext'
import * as api from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  workflowRunAPI: {
    getWorkflowRuns: vi.fn()
  }
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((_date, formatStr) => {
    if (formatStr === 'MMM dd, yyyy HH:mm') {
      return 'Dec 15, 2024 10:30'
    }
    return 'Dec 15, 2024'
  })
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorProvider>
          {children}
        </ErrorProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard header and description', async () => {
    const mockWorkflowRuns = {
      items: [],
      total: 0,
      skip: 0,
      limit: 100
    }

    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockResolvedValue({
      data: mockWorkflowRuns
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('View your workflow execution history and generated outputs.')).toBeInTheDocument()
  })

  it('displays filters and search section', async () => {
    const mockWorkflowRuns = {
      items: [],
      total: 0,
      skip: 0,
      limit: 100
    }

    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockResolvedValue({
      data: mockWorkflowRuns
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('Filters & Search')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by run ID or workflow ID...')).toBeInTheDocument()
  })

  it('displays empty state when no workflow runs exist', async () => {
    const mockWorkflowRuns = {
      items: [],
      total: 0,
      skip: 0,
      limit: 100
    }

    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockResolvedValue({
      data: mockWorkflowRuns
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('No workflow runs found.')).toBeInTheDocument()
    })
  })

  it('displays workflow runs when data is available', async () => {
    const mockWorkflowRuns = {
      items: [
        {
          id: 'run-123',
          workflow_id: 'workflow-456',
          status: 'COMPLETED',
          execution_snapshot: {
            'node-1': {
              node_type: 'GenerateImageV2',
              status: 'COMPLETED',
              response: {
                image_url: 'https://example.com/image.jpg'
              }
            }
          },
          created_at: '2024-12-15T10:30:00Z',
          completed_at: '2024-12-15T10:35:00Z'
        }
      ],
      total: 1,
      skip: 0,
      limit: 100
    }

    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockResolvedValue({
      data: mockWorkflowRuns
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/Run run-123/)).toBeInTheDocument()
      expect(screen.getByText(/Workflow:/)).toBeInTheDocument()
      // Look for the status badge specifically
      const statusBadges = screen.getAllByText('Completed')
      expect(statusBadges.length).toBeGreaterThan(0)
    })
  })

  it('displays loading state initially', () => {
    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<Dashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading workflow runs...')).toBeInTheDocument()
  })

  it('displays error state when API call fails', async () => {
    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockRejectedValue(
      new Error('API Error')
    )

    render(<Dashboard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Failed to load workflow runs. Please try again later.')).toBeInTheDocument()
    })
  })

  it('displays total count correctly', async () => {
    const mockWorkflowRuns = {
      items: [
        {
          id: 'run-123',
          workflow_id: 'workflow-456',
          status: 'COMPLETED',
          execution_snapshot: {},
          created_at: '2024-12-15T10:30:00Z',
          completed_at: '2024-12-15T10:35:00Z'
        }
      ],
      total: 5,
      skip: 0,
      limit: 100
    }

    vi.mocked(api.workflowRunAPI.getWorkflowRuns).mockResolvedValue({
      data: mockWorkflowRuns
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/5.*total runs/)).toBeInTheDocument()
    })
  })
})