// © 2025 Mark Hustad — MIT License
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['api/**', 'node'],
      ['__tests__/fetch-*.test.js', 'node']
    ],
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
        '.next/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        '**/*.test.tsx',
        'scripts/',
        'fetch-*.js',
        '**/test-setup.ts',
        '**/setup.ts',
        // CLI tools and scripts
        'blog-analysis.js',
        'test-env-debug.js',
        'perceptual-hash.ts',
        'similarity-cli.ts',
        'inspection.ts',
        // Build artifacts
        '**/*-manifest.js',
        '**/polyfills.js',
        // Mock and test data files
        '**/ai-enhancements-mock.ts',
        '**/blog-posts-simple.ts',
        // API mock endpoints for testing
        'api/ai-enhancements-batch.ts',
        'api/blog-posts.ts',
        'api/health.ts',
        // Storybook
        '**/*.stories.tsx',
        '**/storybook-static/'
      ]
    }
  },
})