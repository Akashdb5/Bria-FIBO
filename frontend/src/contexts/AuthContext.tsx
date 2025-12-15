import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../lib/api'

interface User {
  id: string
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (name: string, email: string, password: string) => Promise<void>
  refreshToken: () => Promise<boolean>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to decode JWT and check expiration
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Date.now() / 1000
    // Add 30 second buffer to prevent edge cases
    return payload.exp < (currentTime + 30)
  } catch {
    return true
  }
}

// Helper function to get token expiration time
const getTokenExpiration = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 // Convert to milliseconds
  } catch {
    return null
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimeoutRef = useRef<number | null>(null)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    // Clear the refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }

    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    // Navigate to login page
    navigate('/login')
  }, [navigate])

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const currentToken = localStorage.getItem('token')
      if (!currentToken || isTokenExpired(currentToken)) {
        return false
      }

      const response = await authAPI.refresh()
      const { access_token, user: userData } = response.data

      setToken(access_token)
      setUser(userData)
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))

      // Set up next automatic refresh
      scheduleTokenRefresh(access_token)

      return true
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }, [logout])

  const scheduleTokenRefresh = useCallback((tokenToSchedule: string) => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    const expiration = getTokenExpiration(tokenToSchedule)
    if (expiration) {
      // Refresh 5 minutes before expiry, but at least 1 minute from now
      const refreshTime = Math.max(
        expiration - Date.now() - 5 * 60 * 1000,
        60 * 1000
      )

      if (refreshTime > 0) {
        refreshTimeoutRef.current = setTimeout(() => {
          refreshToken()
        }, refreshTime)
      }
    }
  }, [refreshToken])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const response = await authAPI.login(email, password)
      const { access_token, user: userData } = response.data

      // Store in localStorage first
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))

      // Update state
      setToken(access_token)
      setUser(userData)

      // Set up automatic token refresh
      scheduleTokenRefresh(access_token)

      // Navigate to dashboard with replace to prevent back navigation to login
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }, [navigate, scheduleTokenRefresh])

  const register = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    try {
      const response = await authAPI.register(name, email, password)
      const { access_token, user: userData } = response.data

      // Store in localStorage first
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))

      // Update state
      setToken(access_token)
      setUser(userData)

      // Set up automatic token refresh
      scheduleTokenRefresh(access_token)

      // Navigate to dashboard with replace to prevent back navigation to register page
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }, [navigate, scheduleTokenRefresh])

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      // Validate that stored values are not "undefined" or "null" strings
      const isValidToken = storedToken && storedToken !== 'undefined' && storedToken !== 'null'
      const isValidUser = storedUser && storedUser !== 'undefined' && storedUser !== 'null'

      if (isValidToken && isValidUser) {
        if (isTokenExpired(storedToken)) {
          // Try to refresh the token
          const refreshed = await refreshToken()
          if (!refreshed) {
            logout()
          }
        } else {
          try {
            const parsedUser = JSON.parse(storedUser)
            setToken(storedToken)
            setUser(parsedUser)

            // Set up automatic refresh for existing token
            scheduleTokenRefresh(storedToken)
          } catch (error) {
            console.error('Failed to parse stored user data:', error)
            // Clear invalid data from localStorage
            localStorage.removeItem('token')
            localStorage.removeItem('user')
          }
        }
      } else if (storedToken || storedUser) {
        // Clean up invalid localStorage data
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      setIsLoading(false)
    }

    initializeAuth()

    // Listen for logout events from the API client
    const handleLogout = () => {
      logout()
    }

    window.addEventListener('auth:logout', handleLogout)

    return () => {
      window.removeEventListener('auth:logout', handleLogout)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [refreshToken, logout, scheduleTokenRefresh])

  const value = {
    user,
    token,
    login,
    logout,
    register,
    refreshToken,
    isAuthenticated: !!token && !!user && !isTokenExpired(token),
    isLoading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}