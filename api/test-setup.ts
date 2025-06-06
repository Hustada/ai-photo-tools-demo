// © 2025 Mark Hustad — MIT License
// Test setup for API tests (Node.js environment)

import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Clear any console warnings/errors for clean test output
  vi.clearAllMocks()
})

// Mock environment variables for tests
Object.defineProperty(process, 'env', {
  value: {
    ...process.env,
    NODE_ENV: 'test',
  },
})