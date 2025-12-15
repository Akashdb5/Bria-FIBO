
import { useNetworkStatus } from '@/hooks/use-network-status'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Signal } from 'lucide-react'

interface NetworkStatusIndicatorProps {
  showWhenOnline?: boolean
  className?: string
}

export function NetworkStatusIndicator({ 
  showWhenOnline = false, 
  className = '' 
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, connectionType } = useNetworkStatus()

  // Don't show anything if online and showWhenOnline is false
  if (isOnline && !showWhenOnline && !isSlowConnection) {
    return null
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        text: 'Offline',
        variant: 'destructive' as const,
        description: 'No internet connection'
      }
    }

    if (isSlowConnection) {
      return {
        icon: Signal,
        text: 'Slow Connection',
        variant: 'secondary' as const,
        description: `Connection: ${connectionType || 'Unknown'}`
      }
    }

    return {
      icon: Wifi,
      text: 'Online',
      variant: 'default' as const,
      description: `Connection: ${connectionType || 'Good'}`
    }
  }

  const { icon: Icon, text, variant, description } = getStatusInfo()

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge variant={variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{text}</span>
      </Badge>
      {showWhenOnline && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {description}
        </span>
      )}
    </div>
  )
}

// Compact version for status bars
export function NetworkStatusBadge() {
  const { isOnline, isSlowConnection } = useNetworkStatus()

  if (isOnline && !isSlowConnection) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <NetworkStatusIndicator showWhenOnline={false} />
    </div>
  )
}