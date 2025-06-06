# Testing Guide

This document outlines how to run and work with the test suite for the CompanyCam AI Photo Inspirations application.

## Test Framework

We use **Vitest** as our testing framework with:
- **@testing-library/react** for component testing
- **jsdom** environment for DOM simulation
- **supertest** for API endpoint testing
- **axios mocking** for HTTP request testing

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui
```

### Advanced Test Running

```bash
# Run specific test file
npm test src/__tests__/companyCamService.test.ts

# Run tests matching a pattern
npm test -- --grep "getPhotos"

# Run tests in a specific directory
npm test api/__tests__/

# Run tests with verbose output
npm test -- --verbose

# Run tests and exit (useful for CI)
npm test -- --run
```

## Watch Mode

When running `npm run test:watch`, you get an interactive mode with these commands:

- **`a`** - Run all tests
- **`f`** - Run only failed tests
- **`p`** - Filter by filename pattern
- **`t`** - Filter by test name pattern
- **`q`** - Quit watch mode
- **`Enter`** - Trigger test run

## Coverage Reports

Running `npm run test:coverage` generates:

- **Terminal output** - Coverage percentages by file
- **HTML report** - Detailed coverage in `coverage/index.html`
- **JSON report** - Machine-readable coverage data

Coverage excludes:
- `node_modules/`
- `dist/`
- `.vercel/`
- `src/test/`
- `**/*.d.ts`
- `**/*.config.*`

## Test Structure

### Current Test Files

1. **`api/__tests__/ai-enhancements.test.ts`**
   - Tests `/api/ai-enhancements` endpoint
   - Covers GET, POST, DELETE operations
   - Mocks Vercel KV storage
   - 19 test cases

2. **`src/__tests__/companyCamService.test.ts`**
   - Tests HTTP service layer
   - Mocks axios requests
   - Covers all CompanyCam API methods
   - 21 test cases

### Test Organization

```
├── api/__tests__/          # API endpoint tests
├── src/__tests__/          # Service and utility tests
├── src/components/__tests__/ # Component tests (future)
└── src/test/               # Test utilities and setup
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected)
  })
})
```

### Mocking External Dependencies

```typescript
// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  mockedAxios.get.mockResolvedValue({ data: mockData })
  
  const result = await serviceMethod()
  
  expect(result).toEqual(expectedData)
})
```

## Best Practices

1. **Use descriptive test names** - Clearly state what is being tested
2. **Test both success and error scenarios** - Don't just test the happy path
3. **Mock external dependencies** - Keep tests isolated and fast
4. **Clean up after tests** - Use `beforeEach` and `afterEach` hooks
5. **Test edge cases** - Empty arrays, null values, invalid inputs
6. **Verify API calls** - Check that requests are made with correct parameters

## Debugging Tests

### Common Issues

1. **Mock not working** - Ensure mocks are defined before imports
2. **Async test hanging** - Check for unresolved promises
3. **Import errors** - Verify TypeScript configuration

### Debug Commands

```bash
# Run single test with debug info
npm test -- --grep "specific test name" --verbose

# Run tests with Node.js debugging
node --inspect-brk node_modules/.bin/vitest

# Check test coverage for specific file
npm run test:coverage -- src/services/companyCamService.ts
```

## CI/CD Integration

For continuous integration, use:

```bash
# Run tests once and exit
npm test -- --run

# Run tests with coverage and exit
npm run test:coverage -- --run
```

## Future Test Areas

Planned testing expansion:
- Component tests for PhotoCard, PhotoModal, HomePage
- Integration tests for AI pipeline
- E2E tests with Playwright
- Performance tests for large photo sets

## Troubleshooting

### Test Environment

Tests run in a **jsdom** environment that simulates a browser DOM. If you need Node.js environment for specific tests, you can override it:

```typescript
// @vitest-environment node
```

### Memory Issues

For large test suites, you might need to increase Node.js memory:

```bash
node --max-old-space-size=4096 node_modules/.bin/vitest
```

### TypeScript Issues

Ensure `tsconfig.json` includes test files:

```json
{
  "include": ["src/**/*", "api/**/*", "**/*.test.ts"]
}
```