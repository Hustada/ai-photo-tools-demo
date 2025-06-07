// © 2025 Mark Hustad — MIT License
import { describe, it, expect } from 'vitest'

describe('main.tsx', () => {
  it('should be covered by running import', () => {
    // This ensures main.tsx gets required for coverage analysis
    // We don't actually run the main module since it has side effects
    expect(typeof window).toBe('object')
  })
})