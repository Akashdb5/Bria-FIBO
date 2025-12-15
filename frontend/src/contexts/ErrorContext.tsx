import React, { createContext, useContext, useCallback, ReactNode } from 'react'
import { toast } from '@/hooks/use-toast'
import { AxiosError } from 'axios'

interface ErrorContextType {
  handleError: (error: Error | AxiosError, context?: string) => void
  handleApiError: (error: AxiosError, context?: string) => void
  handleNetworkError: (error: Error, context?: string) => void
  showErrorToast: (title: string, description?: string) => void
  showSuccessToast: (title: string, description?: string) => void
  showWarningToast: (title: string, description?: string) => void
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const handleError = useCallback((error: Error | AxiosError, context?: string) => {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    
    // Check if it's an Axios error
    if ('response' in error && error.response) {
      handleApiError(error as AxiosError, context)
    } else if (error.message.includes('Network Error') || error.name === 'NetworkError') {
      handleNetworkError(error, context)
    } else {
      // Generic error handling
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
      })
    }
  }, [])

  const handleApiError = useCallback((error: AxiosError, context?: string) => {
    const status = error.response?.status
    const data = error.response?.data as any
    
    let title = 'Request Failed'
    let description = 'An error occurred while processing your request'

    switch (status) {
      case 400:
        title = 'Invalid Request'
        description = data?.detail || 'The request contains invalid data'
        break
      case 401:
        title = 'Authentication Required'
        description = 'Please log in to continue'
        break
      case 403:
        title = 'Access Denied'
        description = 'You do not have permission to perform this action'
        break
      case 404:
        title = 'Not Found'
        description = 'The requested resource could not be found'
        break
      case 409:
        title = 'Conflict'
        description = data?.detail || 'The request conflicts with the current state'
        break
      case 422:
        title = 'Validation Error'
        description = data?.detail || 'Please check your input and try again'
        break
      case 429:
        title = 'Too Many Requests'
        description = 'Please wait a moment before trying again'
        break
      case 500:
        title = 'Server Error'
        description = 'An internal server error occurred. Please try again later'
        break
      case 502:
      case 503:
      case 504:
        title = 'Service Unavailable'
        description = 'The service is temporarily unavailable. Please try again later'
        break
      default:
        if (data?.detail) {
          description = data.detail
        }
    }

    if (context) {
      description = `${description} (${context})`
    }

    toast({
      variant: 'destructive',
      title,
      description,
    })
  }, [])

  const handleNetworkError = useCallback((_error: Error, context?: string) => {
    toast({
      variant: 'destructive',
      title: 'Connection Error',
      description: `Unable to connect to the server${context ? ` while ${context}` : ''}. Please check your internet connection.`,
    })
  }, [])

  const showErrorToast = useCallback((title: string, description?: string) => {
    toast({
      variant: 'destructive',
      title,
      description,
    })
  }, [])

  const showSuccessToast = useCallback((title: string, description?: string) => {
    toast({
      title,
      description,
    })
  }, [])

  const showWarningToast = useCallback((title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'default', // Using default as there's no warning variant
    })
  }, [])

  const value: ErrorContextType = {
    handleError,
    handleApiError,
    handleNetworkError,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  }

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}

// Higher-order component for wrapping components with error handling
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    const { handleError } = useError()
    
    const handleComponentError = useCallback((error: Error) => {
      handleError(error, Component.displayName || Component.name)
    }, [handleError])

    return (
      <ErrorBoundary onError={handleComponentError} fallback={errorFallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// We need to import ErrorBoundary here to avoid circular dependency
import ErrorBoundary from '@/components/ErrorBoundary'