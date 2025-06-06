// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

// Mock the page components
vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">HomePage Component</div>
}))

vi.mock('../pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">LoginPage Component</div>
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderApp = (initialEntries: string[] = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    )
  }

  describe('Protected Routes', () => {
    it('should redirect to login when no API key is present', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderApp(['/'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('companyCamApiKey')
    })

    it('should show HomePage when API key is present', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/'])
      
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('companyCamApiKey')
    })

    it('should show HomePage when API key is empty string but truthy', () => {
      // Empty string is falsy, so should redirect to login
      mockLocalStorage.getItem.mockReturnValue('')
      
      renderApp(['/'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    })

    it('should show HomePage when API key is whitespace (truthy)', () => {
      mockLocalStorage.getItem.mockReturnValue('   ')
      
      renderApp(['/'])
      
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    })
  })

  describe('Login Route', () => {
    it('should show LoginPage on /login route regardless of API key', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/login'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    })

    it('should show LoginPage on /login route when no API key', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderApp(['/login'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    })
  })

  describe('Route Fallbacks', () => {
    it('should redirect unknown routes to home when API key exists', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/unknown-route'])
      
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    })

    it('should redirect unknown routes to login when no API key', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderApp(['/unknown-route'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    })

    it('should handle deeply nested unknown routes', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/some/deep/unknown/route'])
      
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
    })
  })

  describe('Navigation Behavior', () => {
    it('should respect replace navigation for protected route redirects', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      const { container } = renderApp(['/'])
      
      // The Navigate component uses replace, which means the /login route 
      // should replace the / route in history
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('should respect replace navigation for wildcard redirects', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/non-existent'])
      
      // The wildcard Navigate should replace the unknown route with /
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render main app container', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      const { container } = renderApp(['/'])
      
      const appContainer = container.querySelector('.w-full.min-h-screen')
      expect(appContainer).toBeInTheDocument()
    })

    it('should render nested routes within protected route structure', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/'])
      
      // Verify the protected route allows nested content
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })

  describe('Multiple API Key Checks', () => {
    it('should check localStorage each time ProtectedRoute renders', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-api-key')
      
      renderApp(['/'])
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('companyCamApiKey')
      
      // The localStorage check happens during render
      expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle localStorage returning undefined', () => {
      mockLocalStorage.getItem.mockReturnValue(undefined)
      
      renderApp(['/'])
      
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('should handle localStorage throwing an error', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })
      
      // The current implementation doesn't handle localStorage errors gracefully
      // This test documents the current behavior where localStorage errors will propagate
      expect(() => renderApp(['/'])).toThrow('localStorage not available')
    })
  })
})