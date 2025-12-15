import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useNetworkStatus } from '../use-network-status'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

describe('useNetworkStatus', () => {
  const originalNavigator = globalThis.navigator

  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(globalThis.navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    globalThis.navigator = originalNavigator
    vi.clearAllMocks()
  })

  it('should return initial online status', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(true)
    expect(result.current.isSlowConnection).toBe(false)
    expect(result.current.connectionType).toBe(null)
  })

  it('should detect offline status', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      writable: true,
      value: false,
    })

    const { result } = renderHook(() => useNetworkStatus())
    
    expect(result.current.isOnline).toBe(false)
  })

  it('should handle online/offline events', () => {
    const { result } = renderHook(() => useNetworkStatus())
    
    // Initially online
    expect(result.current.isOnline).toBe(true)
    
    // Simulate going offline
    Object.defineProperty(globalThis.navigator, 'onLine', {
      writable: true,
      value: false,
    })
    
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    
    expect(result.current.isOnline).toBe(false)
    
    // Simulate going back online
    Object.defineProperty(globalThis.navigator, 'onLine', {
      writable: true,
      value: true,
    })
    
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    
    expect(result.current.isOnline).toBe(true)
  })
})