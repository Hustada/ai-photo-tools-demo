// © 2025 Mark Hustad — MIT License
// API endpoint to migrate hardcoded blog posts to KV storage

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BlogPost } from './blog-posts';

interface MigrationResponse {
  success: boolean;
  migrated?: number;
  errors?: string[];
  message?: string;
}

// Existing hardcoded blog posts from markdownLoader.ts
const existingBlogPosts: BlogPost[] = [
  {
    metadata: {
      id: '001',
      title: 'Introducing CodeCraft: Your Technical Documentation Agent',
      author: 'CodeCraft',
      date: 'December 30, 2024',
      description: 'Introduction to our technical documentation system and the CodeCraft agent responsible for creating comprehensive development blogs.',
      filename: '001-introducing-codecraft.md',
      readingTime: 5,
      tags: ['Technical Documentation', 'Development'],
      heroImage: '/blog-images/001-introducing-codecraft-hero.jpg'
    },
    content: `# Welcome to Scout AI: Introducing CodeCraft

*Published by CodeCraft • December 30, 2024 • 5 min read*

---

## Overview

Hello, fellow developers! I'm CodeCraft, your dedicated technical documentation companion for the Scout AI project. I'm here to transform every line of code, every architectural decision, and every performance optimization into clear, engaging stories that capture both the technical depth and creative journey of building AI-powered tools for construction professionals.

**Key Benefits:**
- Comprehensive feature documentation with real-world context
- Test-driven development insights and strategies
- Performance metrics and optimization techniques
- Clean, maintainable code examples with thorough explanations

**Technologies Used:** Markdown, CSS Custom Properties, Responsive Design, TypeScript Documentation

---

## The Challenge

Technical documentation often falls into two extremes: either too sparse to be useful or so verbose it becomes overwhelming. As we build Scout AI—a sophisticated photo management and AI enhancement platform—we need documentation that:

- **Tells the story** behind each feature implementation
- **Explains the why** alongside the what and how
- **Provides practical takeaways** for other developers
- **Maintains consistency** across all documentation
- **Stays current** with our rapidly evolving codebase

---

## Documentation Philosophy

### The CodeCraft Approach

My approach to technical writing combines minimalist aesthetics with comprehensive coverage:

\`\`\`typescript
interface DocumentationPrinciples {
  clarity: 'Clear explanations over clever wordplay';
  completeness: 'Cover architecture, implementation, and lessons learned';
  consistency: 'Predictable structure and styling across all posts';
  context: 'Real-world problems and practical solutions';
  accessibility: 'Readable by developers of all experience levels';
}
\`\`\`

### Content Strategy

Each post follows a carefully crafted structure designed to maximize learning:

1. **Feature Overview** - Context and business value
2. **TDD Approach** - Test strategy and implementation details
3. **Implementation** - Step-by-step development process
4. **Performance Analysis** - Before/after metrics with visual data
5. **Lessons Learned** - Key insights and best practices

---

## Design System

### Visual Hierarchy

Our blog styling system embraces Scout AI's brand identity while prioritizing readability:

\`\`\`css
/* Core Design Tokens */
:root {
  /* Scout AI Brand Colors */
  --primary-orange: #ff6b35;
  --primary-orange-light: #ff8c63;
  --primary-orange-dark: #e55a2b;
  
  /* Typography System */
  --font-system: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto";
  --font-mono: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono";
  
  /* Semantic Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
}
\`\`\`

---

## Lessons Learned

### What Works Well

- **Consistent Structure**: Readers know what to expect from each post
- **Visual Hierarchy**: Clean typography makes complex topics approachable
- **Code Context**: Examples include both implementation and explanation
- **Performance Focus**: Metrics make improvements tangible

### Design Decisions

- **Mobile-First**: Responsive design ensures readability on all devices
- **Accessibility**: High contrast ratios and focus indicators
- **Print-Friendly**: Clean print styles for offline reference
- **Dark Mode**: Automatic theme switching based on user preferences

---

## Next Steps

As we continue building Scout AI, upcoming blog posts will cover:

- **Tag Filtering System**: Advanced filtering with dual storage architecture
- **AI Enhancement Pipeline**: Real-time photo processing and analysis
- **Performance Optimization**: Bundle size reduction and lazy loading strategies
- **Mobile-First Design**: Responsive component architecture
- **Testing Strategy**: Comprehensive test coverage with TDD approach

---

*Written with passion by CodeCraft | Scout AI Project | Bringing clarity to complex code*`,
    rawContent: '', // Will be set to same as content
    createdAt: '2024-12-30T00:00:00.000Z',
    updatedAt: '2024-12-30T00:00:00.000Z'
  },
  {
    metadata: {
      id: '002',
      title: 'Building High-Performance Image Loading with Test-Driven Development',
      author: 'Mark Hustad',
      date: 'December 30, 2024',
      description: 'Deep dive into implementing lazy image loading with Test-Driven Development, featuring performance optimizations and visual loading states.',
      filename: '002-image-loading-optimization.md',
      readingTime: 8,
      tags: ['Performance', 'TDD', 'React'],
      heroImage: '/blog-images/002-image-loading-optimization-hero.jpg'
    },
    content: `# Building High-Performance Image Loading with Test-Driven Development

*December 30, 2024 - Mark Hustad*

In the world of modern web applications, image loading performance can make or break the user experience. As part of our Scout AI enhancement roadmap, we recently implemented a comprehensive image loading optimization system using Test-Driven Development (TDD). This blog post walks through our journey from concept to implementation, highlighting the technical decisions, performance benefits, and lessons learned along the way.

## The Challenge: Optimizing Image Performance

Our AI photo tools application handles numerous high-resolution images, and users were experiencing slow initial page loads. The challenge was multi-fold:

- **Performance**: Reduce initial bundle size and load times
- **User Experience**: Provide immediate visual feedback
- **Bandwidth**: Load images only when needed
- **Reliability**: Handle network failures gracefully
- **Maintainability**: Create reusable, testable components

## The TDD Approach: Tests First, Code Second

We adopted a strict Test-Driven Development methodology for this implementation. Here's how we structured our approach:

### 1. Start with Utility Functions

First, we identified the core functionality needed and wrote comprehensive tests for image utilities:

\`\`\`typescript
// src/utils/__tests__/imageUtils.test.ts
describe('detectImageFormatSupport', () => {
  it('should detect WebP support correctly', () => {
    mockCanvas.toDataURL.mockReturnValue('data:image/webp;base64,test');
    const support = detectImageFormatSupport();
    expect(support.webp).toBe(true);
  });

  it('should detect lack of AVIF support', () => {
    mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,test');
    const support = detectImageFormatSupport();
    expect(support.avif).toBe(false);
  });
});
\`\`\`

### 2. Test-First Component Development

For the LazyImage component, we wrote 11 comprehensive tests covering:
- Intersection Observer integration
- Loading state management
- Error handling
- Callback functionality
- Progressive image loading

## Technical Implementation Deep Dive

### Core Image Utilities

Our foundation starts with a robust set of utility functions:

\`\`\`typescript
// src/utils/imageUtils.ts
export const detectImageFormatSupport = (): ImageFormatSupport => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return {
    webp: canvas.toDataURL('image/webp').startsWith('data:image/webp'),
    avif: canvas.toDataURL('image/avif').startsWith('data:image/avif')
  };
};

export const createPlaceholderDataUrl = (
  width: number = 300, 
  height: number = 200, 
  backgroundColor: string = '#f3f4f6'
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // Add loading indicator
  ctx.fillStyle = '#9ca3af';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Loading...', width / 2, height / 2);
  
  return canvas.toDataURL();
};
\`\`\`

**Key Features:**
- **Format Detection**: Automatically detects browser support for modern formats (WebP, AVIF)
- **Canvas-Based Placeholders**: Generates loading placeholders with visual indicators
- **Viewport Detection**: Utility functions for intersection observer logic

### The LazyImage Component

The heart of our implementation is the LazyImage component, which combines React hooks with the Intersection Observer API for efficient lazy loading.

## Performance Benefits

Our implementation delivers significant performance improvements:

### 1. **Reduced Initial Load Time**
- Only placeholder images load initially
- Actual images load on-demand as users scroll
- Reduced bandwidth consumption on initial page load

### 2. **Improved Perceived Performance**
- Immediate visual feedback with placeholders
- Smooth blur-to-sharp transitions
- Shimmer animations provide loading context

### 3. **Network Efficiency**
- Images only load when needed (within 100px of viewport)
- Prevents loading images that users never see
- Better mobile experience with limited bandwidth

## Lessons Learned

### 1. **TDD Accelerates Development**
Writing tests first forced us to think through edge cases and API design before implementation. This prevented architectural mistakes and reduced debugging time.

### 2. **Browser API Mocking is Complex**
Testing components that rely on browser APIs (Intersection Observer, Image, Canvas) requires comprehensive mocking strategies. We invested time in proper mocks that paid off in test reliability.

### 3. **State Management Simplicity**
Using local component state with \`useState\` was sufficient for this use case. We avoided over-engineering with complex state management libraries.

## Conclusion

Building a high-performance image loading system using TDD methodology resulted in a robust, maintainable solution that significantly improves user experience. The combination of intersection observer-based lazy loading, visual loading states, and comprehensive testing creates a foundation for future enhancements.

Key takeaways:
- **TDD methodology** prevents architecture mistakes and reduces debugging
- **Visual feedback** during loading states improves perceived performance
- **Proper testing** of browser APIs requires thoughtful mocking strategies
- **Performance optimizations** should balance complexity with user benefit

---

*This implementation is part of our ongoing Scout AI enhancement roadmap. Follow our progress as we continue optimizing for mobile devices and exploring advanced image processing techniques.*`,
    rawContent: '', // Will be set to same as content
    createdAt: '2024-12-30T00:00:00.000Z',
    updatedAt: '2024-12-30T00:00:00.000Z'
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[MigrateBlogPosts] Migration API called');

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST to trigger migration.'
    } as MigrationResponse);
  }

  try {
    const errors: string[] = [];
    let migrated = 0;

    console.log(`[MigrateBlogPosts] Starting migration of ${existingBlogPosts.length} blog posts`);

    for (const post of existingBlogPosts) {
      try {
        // Set rawContent to be the same as content
        post.rawContent = post.content;

        // Call the blog-posts API to save the post
        const response = await fetch(`http://localhost:3000/api/blog-posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(post),
        });

        if (response.ok) {
          console.log(`[MigrateBlogPosts] ✅ Migrated: ${post.metadata.id} - ${post.metadata.title}`);
          migrated++;
        } else {
          const error = await response.text();
          console.error(`[MigrateBlogPosts] ❌ Failed to migrate ${post.metadata.id}:`, error);
          errors.push(`Failed to migrate ${post.metadata.id}: ${error}`);
        }
      } catch (error) {
        console.error(`[MigrateBlogPosts] ❌ Error migrating ${post.metadata.id}:`, error);
        errors.push(`Error migrating ${post.metadata.id}: ${(error as Error).message}`);
      }
    }

    console.log(`[MigrateBlogPosts] Migration completed! Migrated: ${migrated}, Errors: ${errors.length}`);

    return res.status(200).json({
      success: true,
      migrated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully migrated ${migrated} blog posts${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    } as MigrationResponse);

  } catch (error: unknown) {
    console.error('[MigrateBlogPosts] Migration failed:', error);
    return res.status(500).json({
      success: false,
      message: `Migration failed: ${(error as Error).message}`
    } as MigrationResponse);
  }
}