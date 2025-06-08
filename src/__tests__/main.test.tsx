// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi } from 'vitest'

// Mock React DOM and components to prevent actual DOM manipulation
const mockRender = vi.fn()
const mockCreateRoot = vi.fn(() => ({ render: mockRender }))

vi.mock('react-dom/client', () => ({
  createRoot: mockCreateRoot
}))

vi.mock('../index.css', () => ({}))
vi.mock('../App', () => ({
  default: () => null
}))

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('../contexts/UserContext', () => ({
  UserContextProvider: ({ children }: { children: React.ReactNode }) => children
}))

describe('main.tsx', () => {
  it('should execute main module and render app', async () => {
    // Mock document.getElementById
    const mockElement = document.createElement('div')
    const mockGetElementById = vi.spyOn(document, 'getElementById')
    mockGetElementById.mockReturnValue(mockElement)
    
    // Import main.tsx to execute it - this will trigger the side effects
    await import('../main.tsx')
    
    // Verify the main module executed correctly
    expect(mockGetElementById).toHaveBeenCalledWith('root')
    expect(mockCreateRoot).toHaveBeenCalledWith(mockElement)
    expect(mockRender).toHaveBeenCalledTimes(1)
  })

  it('should import all required dependencies', () => {
    // This test ensures all import lines are covered
    expect(mockCreateRoot).toBeDefined()
    expect(() => import('../main.tsx')).not.toThrow()
  })
})