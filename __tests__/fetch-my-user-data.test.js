// © 2025 Mark Hustad — MIT License
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch before importing the module
const mockFetch = vi.fn()
vi.mock('node-fetch', () => ({
  default: mockFetch
}))

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('fetch-my-user-data.js', () => {
  let originalEnv

  beforeEach(() => {
    vi.clearAllMocks()
    mockConsoleLog.mockClear()
    mockConsoleError.mockClear()
    mockConsoleWarn.mockClear()
    
    // Store original environment
    originalEnv = { ...process.env }
    
    // Set up test environment variables
    process.env.COMPANYCAM_API_KEY = 'test-api-key'
    delete process.env.VITE_APP_COMPANYCAM_API_KEY
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Restore original environment
    process.env = originalEnv
  })

  const createMockResponse = (ok, status = 200, statusText = 'OK', data = null) => ({
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue('Error response body'),
  })

  describe('successful API calls', () => {
    it('should fetch user data successfully with COMPANYCAM_API_KEY', async () => {
      const mockUserData = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
      }
      
      mockFetch.mockResolvedValue(createMockResponse(true, 200, 'OK', mockUserData))
      
      // Import and execute the function
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockFetch).toHaveBeenCalledWith('https://api.companycam.com/v2/users/current', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Fetching your user data from https://api.companycam.com/v2/users/current...')
      expect(mockConsoleLog).toHaveBeenCalledWith('\nSuccessfully fetched your user data:')
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockUserData, null, 2))
      expect(mockConsoleLog).toHaveBeenCalledWith('\nYour User ID is: 123')
      expect(mockConsoleLog).toHaveBeenCalledWith('You can use this as VITE_APP_DEFAULT_USER_ID in your .env file for testing Step 4.')
      expect(result).toEqual(mockUserData)
    })

    it('should use existing API key from test environment', async () => {
      // This test verifies the function works with the configured test API key
      const mockUserData = { id: '456', name: 'Test User with API Key' }
      mockFetch.mockResolvedValue(createMockResponse(true, 200, 'OK', mockUserData))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      await fetchMyUserData()
      
      expect(mockFetch).toHaveBeenCalledWith('https://api.companycam.com/v2/users/current', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      expect(mockConsoleLog).toHaveBeenCalledWith('\nSuccessfully fetched your user data:')
    })

    it('should handle user data without id field', async () => {
      const mockUserData = { name: 'No ID User', email: 'noid@example.com' }
      mockFetch.mockResolvedValue(createMockResponse(true, 200, 'OK', mockUserData))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleWarn).toHaveBeenCalledWith('\nCould not find "id" in the user data response.')
      expect(result).toEqual(mockUserData)
    })
  })

  describe('API error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValue(createMockResponse(false, 401, 'Unauthorized'))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
      expect(mockConsoleError).toHaveBeenCalledWith('API Error 401: Unauthorized. Body: Error response body')
      expect(result).toBeNull()
    })

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValue(createMockResponse(false, 404, 'Not Found'))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
      expect(mockConsoleError).toHaveBeenCalledWith('API Error 404: Not Found. Body: Error response body')
      expect(result).toBeNull()
    })

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValue(createMockResponse(false, 500, 'Internal Server Error'))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
      expect(mockConsoleError).toHaveBeenCalledWith('API Error 500: Internal Server Error. Body: Error response body')
      expect(result).toBeNull()
    })
  })

  describe('network error handling', () => {
    it('should handle fetch network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error: connection failed'))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
      expect(mockConsoleError).toHaveBeenCalledWith('Network error: connection failed')
      expect(result).toBeNull()
    })

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        text: vi.fn().mockResolvedValue('Invalid response')
      }
      mockFetch.mockResolvedValue(mockResponse)
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      const result = await fetchMyUserData()
      
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
      expect(mockConsoleError).toHaveBeenCalledWith('Invalid JSON')
      expect(result).toBeNull()
    })
  })

  describe('API key behavior', () => {
    it('should handle API key from environment and get unauthorized response', async () => {
      // This test verifies the function handles 401 responses when API key is invalid
      mockFetch.mockResolvedValue(createMockResponse(false, 401, 'Unauthorized'))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      await fetchMyUserData()
      
      // Should call fetch with the test API key
      expect(mockFetch).toHaveBeenCalledWith('https://api.companycam.com/v2/users/current', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      expect(mockConsoleError).toHaveBeenCalledWith('\nError fetching your user data:')
    })
  })

  describe('console output verification', () => {
    it('should log correct startup message', async () => {
      mockFetch.mockResolvedValue(createMockResponse(true, 200, 'OK', { id: '123' }))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      await fetchMyUserData()
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Fetching your user data from https://api.companycam.com/v2/users/current...')
    })

    it('should log success messages with user data', async () => {
      const userData = { id: '789', name: 'Console Test User' }
      mockFetch.mockResolvedValue(createMockResponse(true, 200, 'OK', userData))
      
      const { default: fetchMyUserData } = await import('../fetch-my-user-data.js')
      await fetchMyUserData()
      
      expect(mockConsoleLog).toHaveBeenCalledWith('\nSuccessfully fetched your user data:')
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(userData, null, 2))
      expect(mockConsoleLog).toHaveBeenCalledWith('\nYour User ID is: 789')
    })
  })
})