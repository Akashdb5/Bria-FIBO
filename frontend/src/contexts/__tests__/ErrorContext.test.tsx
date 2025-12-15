import { render, screen, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ErrorProvider, useError } from '../ErrorContext'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// Test component that uses the error context
const TestComponent = () => {
  const { showErrorToast, handleError } = useError()
  
  return (
    <div>
      <button onClick={() => showErrorToast('Error', 'Test error message')}>
        Show Error Toast
      </button>
      <button onClick={() => handleError(new Error('Test error message'))}>
        Handle Error
      </button>
      <div data-testid="context-available">Context Available</div>
    </div>
  )
}

describe('ErrorContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides error context to children', () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    )
    
    expect(screen.getByText('Show Error Toast')).toBeInTheDocument()
    expect(screen.getByText('Handle Error')).toBeInTheDocument()
    expect(screen.getByTestId('context-available')).toBeInTheDocument()
  })

  it('shows error toast when showErrorToast is called', async () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    )
    
    act(() => {
      screen.getByText('Show Error Toast').click()
    })
    
    // Import the mocked toast function
    const { toast } = await import('@/hooks/use-toast')
    expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Test error message',
      variant: 'destructive',
    })
  })

  it('handles errors when handleError is called', async () => {
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    )
    
    act(() => {
      screen.getByText('Handle Error').click()
    })
    
    // Import the mocked toast function
    const { toast } = await import('@/hooks/use-toast')
    expect(toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Test error message',
      variant: 'destructive',
    })
  })

  it('throws error when useError is used outside ErrorProvider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = vi.fn()
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useError must be used within an ErrorProvider')
    
    console.error = originalError
  })
})