import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { NetworkStatusIndicator } from '../NetworkStatusIndicator'

// Mock the network status hook
const mockUseNetworkStatus = vi.fn()
vi.mock('@/hooks/use-network-status', () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}))

describe('NetworkStatusIndicator', () => {
  it('renders nothing when online', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isSlowConnection: false,
    })
    
    const { container } = render(<NetworkStatusIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('shows offline indicator when offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isSlowConnection: false,
    })
    
    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows slow connection indicator when connection is slow', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isSlowConnection: true,
    })
    
    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText('Slow Connection')).toBeInTheDocument()
  })

  it('shows offline indicator when both offline and slow connection', () => {
    mockUseNetworkStatus.mockReturnValue({
      isOnline: false,
      isSlowConnection: true,
    })
    
    render(<NetworkStatusIndicator />)
    
    // Offline takes precedence over slow connection
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.queryByText('Slow Connection')).not.toBeInTheDocument()
  })
})