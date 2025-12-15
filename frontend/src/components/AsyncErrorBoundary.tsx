import { Component, ErrorInfo, ReactNode } from 'react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  onRetry?: () => void
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isNetworkError: boolean
}

class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, isNetworkError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    const isNetworkError = error.message.includes('Network Error') || 
                          error.message.includes('fetch') ||
                          error.name === 'NetworkError'
    
    return { 
      hasError: true, 
      error, 
      isNetworkError 
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AsyncErrorBoundary caught an error:', error, errorInfo)
    
    // Show appropriate toast based on error type
    if (this.state.isNetworkError) {
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: 'The requested operation could not be completed. Please try again.',
      })
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isNetworkError: false })
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="w-full max-w-sm mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              {this.state.isNetworkError ? (
                <WifiOff className="h-6 w-6 text-orange-600" />
              ) : (
                <Wifi className="h-6 w-6 text-orange-600" />
              )}
            </div>
            <CardTitle className="text-lg">
              {this.state.isNetworkError ? 'Connection Problem' : 'Operation Failed'}
            </CardTitle>
            <CardDescription>
              {this.state.isNetworkError 
                ? 'Unable to connect to the server. Please check your internet connection.'
                : 'Something went wrong while processing your request.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={this.handleRetry} 
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default AsyncErrorBoundary