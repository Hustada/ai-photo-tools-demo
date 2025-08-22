// © 2025 Mark Hustad — MIT License
import '@testing-library/jest-dom'

// Mock IntersectionObserver for LazyImage component
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  disconnect: vi.fn(),
  observe: vi.fn((element) => {
    // Immediately trigger callback as if element is visible
    setTimeout(() => {
      callback([{
        isIntersecting: true,
        target: element,
        intersectionRatio: 1,
        boundingClientRect: {},
        intersectionRect: {},
        rootBounds: {},
        time: 0,
      }], {
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(),
      })
    }, 0)
  }),
  unobserve: vi.fn(),
  takeRecords: vi.fn(),
}))

// Mock ResizeObserver if needed
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock HTMLElement methods that might be missing in jsdom
if (typeof HTMLElement !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
  })
}

// Global test setup
beforeEach(() => {
  // Clear localStorage before each test (only in browser-like environments)
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  
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