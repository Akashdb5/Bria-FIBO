import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// Enhanced error handling for API responses
export const handleApiError = (error: AxiosError, context?: string) => {
  // Dispatch custom event for global error handling
  window.dispatchEvent(new CustomEvent('api:error', {
    detail: { error, context }
  }))
  
  return Promise.reject(error)
}

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (error?: any) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  
  failedQueue = []
}

// Helper function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Date.now() / 1000
    // Add 30 second buffer to prevent edge cases
    return payload.exp < (currentTime + 30)
  } catch {
    return true
  }
}

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && !isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Handle network errors
    if (!error.response) {
      // Dispatch network error event
      window.dispatchEvent(new CustomEvent('network:error', {
        detail: { error, message: 'Network connection failed' }
      }))
      return handleApiError(error, 'Network connection failed')
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If we're already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return apiClient(originalRequest)
        }).catch(err => {
          return handleApiError(err, 'Token refresh failed')
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const currentToken = localStorage.getItem('token')
        if (!currentToken) {
          throw new Error('No token available')
        }

        // Attempt to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${currentToken}` }
        })

        const { access_token, user } = response.data
        localStorage.setItem('token', access_token)
        localStorage.setItem('user', JSON.stringify(user))

        // Update the authorization header for the original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }

        processQueue(null, access_token)
        
        // Retry the original request
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        
        // Clear stored auth data and redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        
        // Dispatch a custom event to notify the auth context
        window.dispatchEvent(new CustomEvent('auth:logout'))
        
        return handleApiError(refreshError as AxiosError, 'Authentication failed')
      } finally {
        isRefreshing = false
      }
    }

    return handleApiError(error)
  }
)

// API helper functions for common operations
export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  
  register: (name: string, email: string, password: string) =>
    apiClient.post('/auth/register', { name, email, password }),
  
  refresh: () =>
    apiClient.post('/auth/refresh'),
  
  logout: () =>
    apiClient.post('/auth/logout'),
}

export const workflowAPI = {
  getWorkflows: () =>
    apiClient.get('/workflows'),
  
  getWorkflow: (id: string) =>
    apiClient.get(`/workflows/${id}`),
  
  createWorkflow: (workflow: any) =>
    apiClient.post('/workflows', workflow),
  
  updateWorkflow: (id: string, workflow: any) =>
    apiClient.put(`/workflows/${id}`, workflow),
  
  deleteWorkflow: (id: string) =>
    apiClient.delete(`/workflows/${id}`),
}

export const workflowRunAPI = {
  getWorkflowRuns: () =>
    apiClient.get('/workflow-runs'),
  
  getWorkflowRun: (id: string) =>
    apiClient.get(`/workflow-runs/${id}`),
  
  createWorkflowRun: (workflowId: string, inputs: any) =>
    apiClient.post('/workflow-runs', { workflow_id: workflowId, inputs }),
  
  getApprovals: () =>
    apiClient.get('/approvals'),
  
  approveStructuredPrompt: (runId: string, nodeId: string, structuredPrompt: any) =>
    apiClient.post(`/approvals/${runId}/${nodeId}/approve`, { structured_prompt: structuredPrompt }),
  
  rejectStructuredPrompt: (runId: string, nodeId: string) =>
    apiClient.post(`/approvals/${runId}/${nodeId}/reject`),
}

export const nodeAPI = {
  getNodes: () =>
    apiClient.get('/nodes'),
}

export const fileAPI = {
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}