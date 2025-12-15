import { AxiosError } from 'axios'

// Utility function to safely execute async operations
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T,
  onError?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    console.error('Async operation failed:', error)
    
    if (onError) {
      onError(error as Error)
    }
    
    // Dispatch error event for global handling
    window.dispatchEvent(new CustomEvent('async:error', {
      detail: { error }
    }))
    
    return fallback
  }
}

// Utility to check if an error is a network error
export function isNetworkError(error: any): boolean {
  return !error.response && (
    error.code === 'NETWORK_ERROR' ||
    error.message === 'Network Error' ||
    error.name === 'NetworkError' ||
    error.code === 'ECONNABORTED'
  )
}

// Utility to check if an error is a timeout error
export function isTimeoutError(error: any): boolean {
  return error.code === 'ECONNABORTED' || 
         error.message?.includes('timeout')
}

// Utility to get user-friendly error message
export function getErrorMessage(error: any): string {
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }
  
  if (isTimeoutError(error)) {
    return 'The request timed out. Please try again.'
  }
  
  if (error.response?.data?.detail) {
    return error.response.data.detail
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  
  if (error.message) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}

// Utility to determine if an error should be retried
export function shouldRetryError(error: AxiosError, retryCount: number = 0): boolean {
  const maxRetries = 3
  
  if (retryCount >= maxRetries) {
    return false
  }
  
  // Don't retry client errors (4xx) except for specific cases
  if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
    // Retry on 408 (Request Timeout) and 429 (Too Many Requests)
    return error.response.status === 408 || error.response.status === 429
  }
  
  // Retry on network errors and server errors (5xx)
  return isNetworkError(error) || 
         (error.response?.status !== undefined && error.response.status >= 500)
}

// Utility for exponential backoff delay
export function getRetryDelay(retryCount: number): number {
  const baseDelay = 1000 // 1 second
  const maxDelay = 10000 // 10 seconds
  
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
  
  // Add some jitter to prevent thundering herd
  return delay + Math.random() * 1000
}

// Utility to retry async operations with exponential backoff
export async function retryAsync<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  shouldRetry: (error: any, retryCount: number) => boolean = shouldRetryError
): Promise<T> {
  let lastError: any
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (i === maxRetries || !shouldRetry(error, i)) {
        throw error
      }
      
      // Wait before retrying
      const delay = getRetryDelay(i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}