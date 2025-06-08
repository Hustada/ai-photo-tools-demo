// © 2025 Mark Hustad — MIT License
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    isolate: true, // Ensure test files run in isolation
    pool: 'forks', // Use process forks for better isolation
    maxConcurrency: 1, // Run one test file at a time
    singleThread: true, // Disable threading for complete isolation
    sequence: {
      shuffle: false, // Disable shuffling to maintain order
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.vercel/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'scripts/',
        'fetch-*.js', // Exclude utility scripts
        '**/test-setup.ts', // Exclude test setup files
        '**/setup.ts', // Exclude setup files
      ]
    }
  },
})