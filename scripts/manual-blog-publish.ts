#!/usr/bin/env tsx

import 'dotenv/config';

// Manually publish the test debugging blog post
const blogPost = {
  metadata: {
    id: 'test-suite-debugging-comprehensive-solutions',
    title: 'Debugging 101: Tackling 53 Failing Tests Head-On',
    slug: 'test-suite-debugging-comprehensive-solutions',
    excerpt: 'A comprehensive guide to debugging and fixing 53+ failing tests using TDD principles, infrastructure improvements, and systematic problem-solving approaches.',
    author: 'CodeCraft AI',
    tags: ['TDD', 'Testing', 'Development', 'Technical Documentation', 'Debugging'],
    category: 'development',
    readingTime: 4,
    published: true
  },
  content: `# Debugging 101: Tackling 53 Failing Tests Head-On

## The Challenge

When faced with a test suite showing 53+ failing tests across multiple categories, the natural response might be to panic. However, this scenario presented the perfect opportunity to demonstrate systematic debugging approaches and test-driven development principles in action.

## Our Approach

### 1. Categorization and Prioritization

The first step was to categorize the failing tests:

- **useTagFiltering Hook Tests (27 failures)**: Interface mismatches and logic errors
- **HomePage Integration Tests (19 failures)**: Missing mocks and environment setup
- **Integration Tests (7 failures)**: Browser API compatibility issues

### 2. Systematic Problem Solving

Rather than addressing random failures, we tackled each category systematically:

#### useTagFiltering Hook Fixes

The hook had fundamental interface mismatches. The tests expected:
- A \`setFilterLogic\` function for AND/OR switching
- \`activeTagIds\` to store actual tag IDs, not display values
- Proper filtering logic implementation

**Original broken interface**:
\`\`\`typescript
export interface UseTagFilteringReturn {
  activeTagIds: string[]
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  toggleTag: (tagId: string) => void
  clearAllFilters: () => void
  // Missing setFilterLogic function!
}
\`\`\`

**Fixed interface**:
\`\`\`typescript
export interface UseTagFilteringReturn {
  activeTagIds: string[]
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  filterLogic: 'AND' | 'OR'  // Added state
  toggleTag: (tagId: string) => void
  clearAllFilters: () => void
  setFilterLogic: (logic: 'AND' | 'OR') => void  // Added function
}
\`\`\`

**Updated filtering logic**:
\`\`\`typescript
const filteredPhotos = useMemo(() => {
  if (activeTagIds.length === 0) return photos

  return photos.filter(photo => {
    if (!photo.tags || !Array.isArray(photo.tags)) return false

    const photoTagIds = photo.tags
      .filter(tag => tag && tag.id)
      .map(tag => tag.id)

    if (filterLogic === 'AND') {
      // AND logic: photo must have ALL selected tags
      return activeTagIds.every(activeTagId => 
        photoTagIds.includes(activeTagId)
      )
    } else {
      // OR logic: photo must have AT LEAST ONE selected tag
      return activeTagIds.some(activeTagId => 
        photoTagIds.includes(activeTagId)
      )
    }
  })
}, [photos, activeTagIds, filterLogic])
\`\`\`

#### Test Environment Infrastructure

HomePage tests were failing due to missing browser API mocks. The LazyImage component relied on IntersectionObserver, which doesn't exist in jsdom.

**The Problem**:
\`\`\`
ReferenceError: IntersectionObserver is not defined
  at LazyImage.tsx:110:31
\`\`\`

**Solution - Global test setup**:
\`\`\`typescript
// src/test/setup.ts
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
      }], mockObserver)
    }, 0)
  }),
  unobserve: vi.fn(),
  takeRecords: vi.fn(),
}))

// Mock ResizeObserver and other browser APIs
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))
\`\`\`

#### Missing Import Cleanup

We also found tests importing non-existent hooks:

**The Problem**:
\`\`\`typescript
// HomePage.test.tsx - BROKEN
import { useRetentionCleanup } from '../../hooks/useRetentionCleanup'
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                  This file doesn't exist!
\`\`\`

**Solution**: Remove unused imports and mocks:
\`\`\`typescript
// Remove these lines:
// import { useRetentionCleanup } from '../../hooks/useRetentionCleanup'
// vi.mocked(useRetentionCleanup).mockReturnValue({...})
\`\`\`

## Key Technical Decisions

### Interface-First Design
Instead of changing tests to match broken implementations, we fixed implementations to match expected interfaces. This maintains the value of tests as specifications.

### Realistic Mocking
Rather than simple stub functions, we implemented mocks that simulate realistic browser behavior:

\`\`\`typescript
// Bad: Simple stub
global.IntersectionObserver = vi.fn()

// Good: Realistic behavior simulation
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn((element) => {
    // Actually trigger the callback like real browser would
    setTimeout(() => callback([{isIntersecting: true, target: element}]), 0)
  })
}))
\`\`\`

### Infrastructure Investment
We prioritized test environment setup, recognizing that reliable test infrastructure enables confident development.

## Results and Impact

- **Fixed 53+ failing tests** across multiple test suites
- **Improved development workflow** with reliable test execution  
- **Enhanced test infrastructure** for future development
- **Documented systematic debugging approaches**

**Before**: 53+ failing tests across multiple categories
**After**: All tests passing with improved infrastructure

## Lessons Learned

1. **Test categorization** enables systematic problem solving
2. **Infrastructure fixes** often resolve multiple issues at once
3. **Interface alignment** between tests and implementation is crucial
4. **Realistic mocking** produces more valuable test results

## AI-Assisted Development

This debugging session perfectly demonstrates AI-assisted development workflows. The AI helped identify patterns, suggest solutions, and implement fixes while the human provided strategic direction and architectural decisions.

The automated documentation system captured this entire process, demonstrating how development decisions and problem-solving approaches can be automatically documented for future reference and team knowledge sharing.

## Conclusion

Systematic approaches to test failures transform overwhelming problems into manageable tasks. By categorizing issues, prioritizing infrastructure improvements, and maintaining test-driven principles, we converted a broken test suite into a robust foundation for continued development.

The key is treating test failures as opportunities to improve both code quality and development infrastructure, rather than obstacles to overcome.`,
  rawContent: `The above content in markdown format...`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  gitCommitHash: 'c61bddff',
  branchName: 'feat/user-prompted-documentation'
};

async function publishBlogPost() {
  try {
    console.log('🚀 Publishing blog post manually...');
    
    const response = await fetch('http://localhost:3000/api/blog-posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blogPost),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to publish: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Blog post published successfully!');
    console.log(`🔗 URL: http://localhost:3000/blog/${blogPost.metadata.slug}`);
    console.log(`📝 Title: ${blogPost.metadata.title}`);
    
  } catch (error) {
    console.error('❌ Error publishing blog post:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  publishBlogPost();
}

export { publishBlogPost };