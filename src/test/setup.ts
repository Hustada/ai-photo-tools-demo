// © 2025 Mark Hustad — MIT License
import '@testing-library/jest-dom'

// Global test setup
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear()
  
  // Clear any console warnings/errors for clean test output
  vi.clearAllMocks()
})

// Mock environment variables for tests
Object.defineProperty(process, 'env', {
  value: {
    ...process.env,
    // Add any default test environment variables here
    NODE_ENV: 'test',
  },
})