import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorProvider } from './contexts/ErrorContext'
import { Toaster } from './components/ui/toaster'
import ErrorBoundary from './components/ErrorBoundary'
import { useGlobalErrorHandler } from './hooks/use-global-error-handler'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import WorkflowBuilder from './pages/WorkflowBuilder'
import WorkflowSelection from './pages/WorkflowSelection'
import WorkflowExecution from './pages/WorkflowExecution'
import Profile from '@/pages/Profile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors (authentication failures)
        if (error?.response?.status === 401) {
          return false
        }
        // Don't retry on 4xx client errors (except 408, 429)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          if (error?.response?.status === 408 || error?.response?.status === 429) {
            return failureCount < 2
          }
          return false
        }
        // Retry up to 3 times for network errors and 5xx server errors
        return failureCount < 3
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Disable refetch on window focus to reduce API calls
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry mutations on client errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        // Retry mutations up to 2 times for network/server errors
        return failureCount < 2
      },
    },
  },
})

function AppContent() {
  // Initialize global error handling
  useGlobalErrorHandler()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workflows/builder" element={<WorkflowBuilder />} />
        <Route path="workflows/execute" element={<WorkflowSelection />} />
        <Route path="workflows/execute/:workflowId" element={<WorkflowExecution />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <ErrorProvider>
            <AuthProvider>
              <AppContent />
              <Toaster />
            </AuthProvider>
          </ErrorProvider>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App