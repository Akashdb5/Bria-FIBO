import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'

// Mock the auth context for testing
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
  }),
}))

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // Since user is not authenticated, should redirect to login
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument()
  })
})