import { useEffect } from 'react'
import { useError } from '@/contexts/ErrorContext'
import { AxiosError } from 'axios'

export function useGlobalErrorHandler() {
  const { handleApiError, handleNetworkError } = useError()

  useEffect(() => {
    // Handle API errors
    const handleApiErrorEvent = (event: CustomEvent) => {
      const { error, context } = event.detail
      handleApiError(error as AxiosError, context)
    }

    // Handle network errors
    const handleNetworkErrorEvent = (event: CustomEvent) => {
      const { error, message } = event.detail
      handleNetworkError(error, message)
    }

    // Handle authentication logout
    const handleAuthLogout = () => {
      // This is handled by the AuthContext, but we can add additional cleanup here
      console.log('User logged out due to authentication error')
    }

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      
      // Check if it's an API error
      if (event.reason?.response) {
        handleApiError(event.reason as AxiosError, 'Unhandled promise rejection')
      } else if (event.reason?.message?.includes('Network Error')) {
        handleNetworkError(event.reason, 'Unhandled promise rejection')
      }
      
      // Prevent the default browser behavior
      event.preventDefault()
    }

    // Handle JavaScript errors
    const handleError = (event: ErrorEvent) => {
      console.error('Global JavaScript error:', event.error)
      
      // Don't show toast for every JS error as it might be too noisy
      // Only handle specific types of errors that we care about
      if (event.error?.name === 'ChunkLoadError') {
        // Handle chunk load errors (common in SPAs with code splitting)
        window.location.reload()
      }
    }

    // Add event listeners
    window.addEventListener('api:error', handleApiErrorEvent as EventListener)
    window.addEventListener('network:error', handleNetworkErrorEvent as EventListener)
    window.addEventListener('auth:logout', handleAuthLogout)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    // Cleanup
    return () => {
      window.removeEventListener('api:error', handleApiErrorEvent as EventListener)
      window.removeEventListener('network:error', handleNetworkErrorEvent as EventListener)
      window.removeEventListener('auth:logout', handleAuthLogout)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [handleApiError, handleNetworkError])
}