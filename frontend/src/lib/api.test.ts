import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios completely
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      defaults: {
        baseURL: 'http://localhost:8000/api/v1',
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      },
      interceptors: {
        request: { handlers: [{ fulfilled: vi.fn() }], use: vi.fn() },
        response: { use: vi.fn() }
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

// Import after mocking
const { apiClient, authAPI, workflowAPI, workflowRunAPI, nodeAPI, fileAPI } = await import('./api')

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

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    dispatchEventSpy.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('apiClient configuration', () => {
    it('should be configured with correct base URL and timeout', () => {
      expect(apiClient.defaults.baseURL).toBe('http://localhost:8000/api/v1')
      expect(apiClient.defaults.timeout).toBe(30000)
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json')
    })
  })

  describe('request interceptor', () => {
    it('should have interceptors configured', () => {
      expect(apiClient.interceptors).toBeDefined()
      expect(apiClient.interceptors.request).toBeDefined()
      expect(apiClient.interceptors.response).toBeDefined()
    })
  })

  describe('authAPI', () => {
    it('should call login endpoint with correct parameters', async () => {
      const mockResponse = { data: { access_token: 'token', user: { id: '1' } } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await authAPI.login('test@example.com', 'password')

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password'
      })
      expect(result).toBe(mockResponse)
    })

    it('should call register endpoint with correct parameters', async () => {
      const mockResponse = { data: { access_token: 'token', user: { id: '1' } } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await authAPI.register('Test User', 'test@example.com', 'password')

      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password'
      })
      expect(result).toBe(mockResponse)
    })

    it('should call refresh endpoint', async () => {
      const mockResponse = { data: { access_token: 'new-token' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await authAPI.refresh()

      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh')
      expect(result).toBe(mockResponse)
    })

    it('should call logout endpoint', async () => {
      const mockResponse = { data: { message: 'Logged out' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await authAPI.logout()

      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout')
      expect(result).toBe(mockResponse)
    })
  })

  describe('workflowAPI', () => {
    it('should call get workflows endpoint', async () => {
      const mockResponse = { data: [] }
      apiClient.get = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowAPI.getWorkflows()

      expect(apiClient.get).toHaveBeenCalledWith('/workflows')
      expect(result).toBe(mockResponse)
    })

    it('should call get workflow endpoint with id', async () => {
      const mockResponse = { data: { id: '1' } }
      apiClient.get = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowAPI.getWorkflow('1')

      expect(apiClient.get).toHaveBeenCalledWith('/workflows/1')
      expect(result).toBe(mockResponse)
    })

    it('should call create workflow endpoint', async () => {
      const workflow = { name: 'Test Workflow' }
      const mockResponse = { data: { id: '1', ...workflow } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowAPI.createWorkflow(workflow)

      expect(apiClient.post).toHaveBeenCalledWith('/workflows', workflow)
      expect(result).toBe(mockResponse)
    })

    it('should call update workflow endpoint', async () => {
      const workflow = { name: 'Updated Workflow' }
      const mockResponse = { data: { id: '1', ...workflow } }
      apiClient.put = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowAPI.updateWorkflow('1', workflow)

      expect(apiClient.put).toHaveBeenCalledWith('/workflows/1', workflow)
      expect(result).toBe(mockResponse)
    })

    it('should call delete workflow endpoint', async () => {
      const mockResponse = { data: { message: 'Deleted' } }
      apiClient.delete = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowAPI.deleteWorkflow('1')

      expect(apiClient.delete).toHaveBeenCalledWith('/workflows/1')
      expect(result).toBe(mockResponse)
    })
  })

  describe('workflowRunAPI', () => {
    it('should call get workflow runs endpoint', async () => {
      const mockResponse = { data: [] }
      apiClient.get = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowRunAPI.getWorkflowRuns()

      expect(apiClient.get).toHaveBeenCalledWith('/workflow-runs')
      expect(result).toBe(mockResponse)
    })

    it('should call create workflow run endpoint', async () => {
      const mockResponse = { data: { id: '1' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowRunAPI.createWorkflowRun('workflow-1', { input: 'test' })

      expect(apiClient.post).toHaveBeenCalledWith('/workflow-runs', {
        workflow_id: 'workflow-1',
        inputs: { input: 'test' }
      })
      expect(result).toBe(mockResponse)
    })

    it('should call approve structured prompt endpoint', async () => {
      const structuredPrompt = { prompt: 'test' }
      const mockResponse = { data: { message: 'Approved' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowRunAPI.approveStructuredPrompt('run-1', 'node-1', structuredPrompt)

      expect(apiClient.post).toHaveBeenCalledWith('/approvals/run-1/node-1/approve', {
        structured_prompt: structuredPrompt
      })
      expect(result).toBe(mockResponse)
    })

    it('should call reject structured prompt endpoint', async () => {
      const mockResponse = { data: { message: 'Rejected' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await workflowRunAPI.rejectStructuredPrompt('run-1', 'node-1')

      expect(apiClient.post).toHaveBeenCalledWith('/approvals/run-1/node-1/reject')
      expect(result).toBe(mockResponse)
    })
  })

  describe('nodeAPI', () => {
    it('should call get nodes endpoint', async () => {
      const mockResponse = { data: [] }
      apiClient.get = vi.fn().mockResolvedValue(mockResponse)

      const result = await nodeAPI.getNodes()

      expect(apiClient.get).toHaveBeenCalledWith('/nodes')
      expect(result).toBe(mockResponse)
    })
  })

  describe('fileAPI', () => {
    it('should call upload file endpoint with FormData', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const mockResponse = { data: { url: 'http://example.com/file.txt' } }
      apiClient.post = vi.fn().mockResolvedValue(mockResponse)

      const result = await fileAPI.uploadFile(file)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/files/upload',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      expect(result).toBe(mockResponse)
    })
  })
})