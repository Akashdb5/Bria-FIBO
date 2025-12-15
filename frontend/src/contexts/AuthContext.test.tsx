import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import * as apiModule from '../lib/api'

// Mock the API module
vi.mock('../lib/api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Test component that uses the auth context
const TestComponent = () => {
  const { user, token, login, logout, register, isAuthenticated, isLoading } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{user ? user.name : 'no-user'}</div>
      <div data-testid="token">{token || 'no-token'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => register('Test User', 'test@example.com', 'password')}>Register</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should provide initial unauthenticated state', async () => {
    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('token')).toHaveTextContent('no-token')
  })

  it('should handle successful login', async () => {
    const mockResponse = {
      data: {
        access_token: 'test-token',
        user: { id: '1', name: 'Test User', email: 'test@example.com' }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    }
    
    vi.mocked(apiModule.authAPI.login).mockResolvedValue(mockResponse)

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    await act(async () => {
      screen.getByText('Login').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    expect(screen.getByTestId('token')).toHaveTextContent('test-token')
    expect(localStorage.getItem('token')).toBe('test-token')
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockResponse.data.user))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should handle successful registration', async () => {
    const mockResponse = {
      data: {
        access_token: 'test-token',
        user: { id: '1', name: 'Test User', email: 'test@example.com' }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    }
    
    vi.mocked(apiModule.authAPI.register).mockResolvedValue(mockResponse)

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    await act(async () => {
      screen.getByText('Register').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    expect(screen.getByTestId('token')).toHaveTextContent('test-token')
    expect(localStorage.getItem('token')).toBe('test-token')
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockResponse.data.user))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should handle logout', async () => {
    // Set up initial authenticated state
    const user = { id: '1', name: 'Test User', email: 'test@example.com' }
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify(user))

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    })

    await act(async () => {
      screen.getByText('Logout').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('token')).toHaveTextContent('no-token')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('should restore authentication state from localStorage', async () => {
    const user = { id: '1', name: 'Test User', email: 'test@example.com' }
    // Create a valid token that won't be expired (expires in 1 hour)
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = `header.${btoa(JSON.stringify(payload))}.signature`
    
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    expect(screen.getByTestId('token')).toHaveTextContent(token)
  })

  it('should handle expired token on initialization', async () => {
    const user = { id: '1', name: 'Test User', email: 'test@example.com' }
    // Create an expired token
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 }
    const expiredToken = `header.${btoa(JSON.stringify(payload))}.signature`
    
    localStorage.setItem('token', expiredToken)
    localStorage.setItem('user', JSON.stringify(user))

    // Mock refresh to fail
    vi.mocked(apiModule.authAPI.refresh).mockRejectedValue(new Error('Refresh failed'))

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
    })

    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(screen.getByTestId('token')).toHaveTextContent('no-token')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('should handle auth:logout event', async () => {
    const user = { id: '1', name: 'Test User', email: 'test@example.com' }
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify(user))

    renderWithRouter(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated')
    })

    // Simulate the logout event from API client
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:logout'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated')
    })

    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')
    
    consoleSpy.mockRestore()
  })
})