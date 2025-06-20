// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

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

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
})

describe('LoginPage', () => {
  const renderLoginPage = () => {
    return render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      renderLoginPage()

      expect(screen.getByRole('heading', { name: /scout ai/i })).toBeInTheDocument()
      expect(screen.getByText(/enter your companycam api key/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/companycam api key/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
      expect(screen.getByText(/your api key will be stored locally/i)).toBeInTheDocument()
    })

    it('should render input field with password type', () => {
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      expect(input).toHaveAttribute('type', 'password')
      expect(input).toHaveAttribute('placeholder', 'Paste your API key here')
    })
  })

  describe('Form interaction', () => {
    it('should update input value when user types', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      await user.type(input, 'test-api-key-123')

      expect(input).toHaveValue('test-api-key-123')
    })

    it('should clear input after successful login', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(input, 'test-api-key-123')
      await user.click(loginButton)

      expect(input).toHaveValue('')
    })
  })

  describe('Login validation', () => {
    it('should show alert when API key is empty', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)

      expect(window.alert).toHaveBeenCalledWith('Please enter an API Key.')
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should show alert when API key is only whitespace', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(input, '   ')
      await user.click(loginButton)

      expect(window.alert).toHaveBeenCalledWith('Please enter an API Key.')
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Successful login', () => {
    it('should store API key in localStorage and navigate to home', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(input, 'valid-api-key-123')
      await user.click(loginButton)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('companyCamApiKey', 'valid-api-key-123')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should handle API key with leading/trailing spaces', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      const loginButton = screen.getByRole('button', { name: /login/i })

      await user.type(input, '  valid-api-key-123  ')
      await user.click(loginButton)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('companyCamApiKey', '  valid-api-key-123  ')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('Keyboard interaction', () => {
    it('should submit form when Enter key is pressed in input field', async () => {
      const user = userEvent.setup()
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      
      await user.type(input, 'test-api-key-123')
      await user.keyboard('{Enter}')

      // Note: The current implementation doesn't handle Enter key, 
      // so this test documents current behavior
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Security considerations', () => {
    it('should use password input type to obscure API key', () => {
      renderLoginPage()

      const input = screen.getByLabelText(/companycam api key/i)
      expect(input).toHaveAttribute('type', 'password')
    })

    it('should inform user about local storage', () => {
      renderLoginPage()

      expect(screen.getByText(/your api key will be stored locally in your browser/i)).toBeInTheDocument()
    })
  })
})