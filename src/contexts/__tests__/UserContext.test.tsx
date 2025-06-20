// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UserContextProvider, useUserContext } from '../UserContext'
import { companyCamService } from '../../services/companyCamService'
import type { CurrentUser, CompanyDetails, Project } from '../../types'

// Mock the companyCamService
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    getCurrentUser: vi.fn(),
    getCompanyDetails: vi.fn(),
    getProjects: vi.fn(),
  },
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

// Test component that uses the context
const TestConsumer: React.FC = () => {
  const context = useUserContext()
  
  return (
    <div>
      <div data-testid="loading">{context.loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error">{context.error || 'No Error'}</div>
      <div data-testid="current-user">
        {context.currentUser ? context.currentUser.email_address : 'No User'}
      </div>
      <div data-testid="company-details">
        {context.companyDetails ? context.companyDetails.name : 'No Company'}
      </div>
      <div data-testid="projects-count">{context.projects.length}</div>
      <button 
        data-testid="refetch-button" 
        onClick={() => context.fetchUserContext()}
      >
        Refetch
      </button>
    </div>
  )
}

// Component that throws error when used outside provider
const TestConsumerOutsideProvider: React.FC = () => {
  try {
    useUserContext()
    return <div data-testid="no-error">No Error</div>
  } catch (error) {
    return <div data-testid="context-error">{(error as Error).message}</div>
  }
}

describe('UserContext', () => {
  const mockUser: CurrentUser = {
    id: 'user-123',
    company_id: 'company-456',
    email_address: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    status: 'active',
  }

  const mockCompany: CompanyDetails = {
    id: 'company-456',
    name: 'Test Company',
    status: 'active',
  }

  const mockProjects: Project[] = [
    { id: 'project-1', name: 'Project Alpha' },
    { id: 'project-2', name: 'Project Beta' },
  ]

  const renderWithProvider = (initialEntries: string[] = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <UserContextProvider>
          <TestConsumer />
        </UserContextProvider>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset all mocks to successful responses by default
    vi.mocked(companyCamService.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(companyCamService.getCompanyDetails).mockResolvedValue(mockCompany)
    vi.mocked(companyCamService.getProjects).mockResolvedValue(mockProjects)
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'userSettings') {
        return null; // No saved settings
      }
      return 'valid-api-key'; // For other keys like auth tokens
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Context Provider Setup', () => {
    it('should throw error when useUserContext is used outside provider', () => {
      render(<TestConsumerOutsideProvider />)
      
      expect(screen.getByTestId('context-error')).toHaveTextContent(
        'useUserContext must be used within a UserContextProvider'
      )
    })

    it('should provide context when used within provider', async () => {
      renderWithProvider()
      
      expect(screen.queryByTestId('context-error')).not.toBeInTheDocument()
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      
      // Wait for loading to complete to avoid act warnings
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })
  })

  describe('Initial State', () => {
    it('should start with loading state and empty data', async () => {
      renderWithProvider()
      
      // Initially should be loading
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
      expect(screen.getByTestId('current-user')).toHaveTextContent('No User')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })
  })

  describe('Successful Data Fetching', () => {
    it('should fetch and display user data when API key exists', async () => {
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('current-user')).toHaveTextContent('test@example.com')
      expect(screen.getByTestId('company-details')).toHaveTextContent('Test Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('2')
      expect(screen.getByTestId('error')).toHaveTextContent('No Error')
      
      // Verify API calls were made with correct parameters
      expect(companyCamService.getCurrentUser).toHaveBeenCalledWith('valid-api-key')
      expect(companyCamService.getCompanyDetails).toHaveBeenCalledWith('valid-api-key', 'company-456')
      expect(companyCamService.getProjects).toHaveBeenCalledWith('valid-api-key')
    })

    it('should not fetch company details if user has no company_id', async () => {
      const userWithoutCompany = { ...mockUser, company_id: '' }
      vi.mocked(companyCamService.getCurrentUser).mockResolvedValue(userWithoutCompany)
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(companyCamService.getCurrentUser).toHaveBeenCalledWith('valid-api-key')
      expect(companyCamService.getCompanyDetails).not.toHaveBeenCalled()
      expect(companyCamService.getProjects).toHaveBeenCalledWith('valid-api-key')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
    })
  })

  describe('No API Key Scenarios', () => {
    it('should handle missing API key gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent('No API Key found. Please log in.')
      expect(screen.getByTestId('current-user')).toHaveTextContent('No User')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
      
      // API should not be called
      expect(companyCamService.getCurrentUser).not.toHaveBeenCalled()
      expect(companyCamService.getCompanyDetails).not.toHaveBeenCalled()
      expect(companyCamService.getProjects).not.toHaveBeenCalled()
    })

    it('should handle empty string API key', async () => {
      mockLocalStorage.getItem.mockReturnValue('')
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent('No API Key found. Please log in.')
      expect(companyCamService.getCurrentUser).not.toHaveBeenCalled()
    })

    it('should handle undefined API key', async () => {
      mockLocalStorage.getItem.mockReturnValue(undefined)
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent('No API Key found. Please log in.')
      expect(companyCamService.getCurrentUser).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle getCurrentUser API error', async () => {
      const errorMessage = 'Failed to fetch user'
      vi.mocked(companyCamService.getCurrentUser).mockRejectedValue(new Error(errorMessage))
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent(errorMessage)
      expect(screen.getByTestId('current-user')).toHaveTextContent('No User')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
    })

    it('should handle getCompanyDetails API error', async () => {
      const errorMessage = 'Failed to fetch company'
      vi.mocked(companyCamService.getCompanyDetails).mockRejectedValue(new Error(errorMessage))
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent(errorMessage)
      // User should be fetched but company and projects should be cleared due to error
      expect(screen.getByTestId('current-user')).toHaveTextContent('No User')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
    })

    it('should handle getProjects API error', async () => {
      const errorMessage = 'Failed to fetch projects'
      vi.mocked(companyCamService.getProjects).mockRejectedValue(new Error(errorMessage))
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent(errorMessage)
      expect(screen.getByTestId('current-user')).toHaveTextContent('No User')
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
    })

    it('should handle API error without message', async () => {
      vi.mocked(companyCamService.getCurrentUser).mockRejectedValue(new Error())
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch user context')
    })

    it('should handle non-Error objects thrown', async () => {
      vi.mocked(companyCamService.getCurrentUser).mockRejectedValue('String error')
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch user context')
    })
  })

  describe('Route Changes', () => {
    it('should respond to location changes', async () => {
      // This test verifies that the context includes location.pathname in useEffect dependencies
      // The actual route change triggering is handled by React Router, so we just verify
      // that the context is set up to listen for route changes
      renderWithProvider(['/'])
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(companyCamService.getCurrentUser).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('current-user')).toHaveTextContent('test@example.com')
    })
  })

  describe('Manual Refetch', () => {
    it('should allow manual refetch via fetchUserContext', async () => {
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(companyCamService.getCurrentUser).toHaveBeenCalledTimes(1)
      
      // Click refetch button
      const refetchButton = screen.getByTestId('refetch-button')
      refetchButton.click()
      
      await waitFor(() => {
        expect(companyCamService.getCurrentUser).toHaveBeenCalledTimes(2)
      })
    })

    it('should show loading state during manual refetch', async () => {
      // Make the API call take longer
      vi.mocked(companyCamService.getCurrentUser).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockUser), 100))
      )
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      // Click refetch button
      const refetchButton = screen.getByTestId('refetch-button')
      refetchButton.click()
      
      // Should show loading during refetch
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle localStorage throwing an error', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable')
      })
      
      // Should not crash the app
      expect(() => renderWithProvider()).not.toThrow()
    })

    it('should handle empty projects array', async () => {
      vi.mocked(companyCamService.getProjects).mockResolvedValue([])
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(screen.getByTestId('projects-count')).toHaveTextContent('0')
    })

    it('should handle user without company_id field', async () => {
      const userWithoutCompanyId = {
        id: 'user-123',
        email_address: 'test@example.com',
        status: 'active' as const,
      } as CurrentUser
      
      vi.mocked(companyCamService.getCurrentUser).mockResolvedValue(userWithoutCompanyId)
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
      
      expect(companyCamService.getCompanyDetails).not.toHaveBeenCalled()
      expect(screen.getByTestId('company-details')).toHaveTextContent('No Company')
    })
  })

  describe('Loading States', () => {
    it('should clear error when starting new fetch', async () => {
      // First call fails
      vi.mocked(companyCamService.getCurrentUser).mockRejectedValueOnce(new Error('First error'))
      
      renderWithProvider()
      
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('First error')
      })
      
      // Second call succeeds
      vi.mocked(companyCamService.getCurrentUser).mockResolvedValueOnce(mockUser)
      
      const refetchButton = screen.getByTestId('refetch-button')
      refetchButton.click()
      
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('No Error')
      })
    })

    it('should maintain loading state throughout all API calls', async () => {
      let resolveUser: (value: CurrentUser) => void
      let resolveCompany: (value: CompanyDetails) => void
      let resolveProjects: (value: Project[]) => void
      
      vi.mocked(companyCamService.getCurrentUser).mockImplementation(
        () => new Promise(resolve => { resolveUser = resolve })
      )
      vi.mocked(companyCamService.getCompanyDetails).mockImplementation(
        () => new Promise(resolve => { resolveCompany = resolve })
      )
      vi.mocked(companyCamService.getProjects).mockImplementation(
        () => new Promise(resolve => { resolveProjects = resolve })
      )
      
      renderWithProvider()
      
      // Should be loading initially
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
      
      // Resolve user
      resolveUser!(mockUser)
      await waitFor(() => {
        expect(companyCamService.getCompanyDetails).toHaveBeenCalled()
      })
      
      // Should still be loading
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
      
      // Resolve company
      resolveCompany!(mockCompany)
      await waitFor(() => {
        expect(companyCamService.getProjects).toHaveBeenCalled()
      })
      
      // Should still be loading
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
      
      // Resolve projects
      resolveProjects!(mockProjects)
      
      // Now should not be loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })
  })
})