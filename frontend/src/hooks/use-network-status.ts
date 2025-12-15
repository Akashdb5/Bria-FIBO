import { useState, useEffect } from 'react'
import { toast } from '@/hooks/use-toast'

interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string | null
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    connectionType: null
  })

  useEffect(() => {
    const updateNetworkStatus = () => {
      const isOnline = navigator.onLine
      
      // Check connection type if available
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection
      
      const connectionType = connection?.effectiveType || null
      const isSlowConnection = connection?.effectiveType === '2g' || 
                              connection?.effectiveType === 'slow-2g' ||
                              connection?.downlink < 1.5

      setNetworkStatus({
        isOnline,
        isSlowConnection: isSlowConnection || false,
        connectionType
      })
    }

    const handleOnline = () => {
      updateNetworkStatus()
      toast({
        title: 'Connection Restored',
        description: 'You are back online. All features are now available.',
        variant: 'default'
      })
    }

    const handleOffline = () => {
      updateNetworkStatus()
      toast({
        title: 'Connection Lost',
        description: 'You are currently offline. Some features may not be available.',
        variant: 'destructive'
      })
    }

    const handleConnectionChange = () => {
      updateNetworkStatus()
      
      const connection = (navigator as any).connection
      if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') {
        toast({
          title: 'Slow Connection Detected',
          description: 'Your connection is slow. Some operations may take longer.',
          variant: 'default'
        })
      }
    }

    // Initial status check
    updateNetworkStatus()

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Listen for connection changes if supported
    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [])

  return networkStatus
}

// Hook for handling offline-first behavior
export function useOfflineSupport() {
  const networkStatus = useNetworkStatus()
  
  const executeWithOfflineSupport = async <T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> => {
    if (!networkStatus.isOnline && fallback) {
      toast({
        title: 'Offline Mode',
        description: 'Using cached data while offline.',
        variant: 'default'
      })
      return await fallback()
    }

    try {
      return await operation()
    } catch (error: any) {
      // If it's a network error and we have a fallback
      if (!networkStatus.isOnline && fallback) {
        toast({
          title: 'Using Cached Data',
          description: 'Unable to fetch latest data. Showing cached version.',
          variant: 'default'
        })
        return await fallback()
      }
      throw error
    }
  }

  return {
    ...networkStatus,
    executeWithOfflineSupport
  }
}