// © 2025 Mark Hustad — MIT License

export interface BlogPostMetadata {
  id: string;
  title: string;
  author: string;
  date: string;
  description: string;
  filename: string;
  readingTime: number;
  tags: string[];
  heroImage?: string;
}

export interface BlogPostContent {
  metadata: BlogPostMetadata;
  content: string;
  rawContent: string;
}

// Blog post from API
interface ApiBlogPost {
  metadata: BlogPostMetadata;
  content: string;
  rawContent: string;
  createdAt: string;
  updatedAt: string;
  gitCommitHash?: string;
  branchName?: string;
}

// Estimate reading time based on content (average 200 words per minute)
const estimateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  const readingTime = Math.ceil(words / wordsPerMinute);
  return readingTime;
};

// Parse frontmatter-style metadata from markdown content
const parseFrontmatter = (content: string): { metadata: Partial<BlogPostMetadata>; content: string } => {
  const frontmatterRegex = /^---\s*\n(.*?)\n---\s*\n(.*)/s;
  const match = content.match(frontmatterRegex);
  
  if (match) {
    const [, frontmatter, markdownContent] = match;
    const metadata: Partial<BlogPostMetadata> = {};
    
    // Parse YAML-like frontmatter
    frontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
        switch (key.trim()) {
          case 'title':
            metadata.title = value;
            break;
          case 'author':
            metadata.author = value;
            break;
          case 'date':
            metadata.date = value;
            break;
          case 'description':
            metadata.description = value;
            break;
          case 'heroImage':
            metadata.heroImage = value;
            break;
          case 'tags':
            metadata.tags = value.split(',').map(tag => tag.trim());
            break;
        }
      }
    });
    
    return { metadata, content: markdownContent };
  }
  
  return { metadata: {}, content };
};

// Extract metadata from markdown content when no frontmatter exists
const extractMetadataFromMarkdown = (content: string, filename: string): BlogPostMetadata => {
  const lines = content.split('\n');
  
  // Extract title (first heading)
  const titleMatch = lines.find(line => line.startsWith('# '));
  const title = titleMatch ? titleMatch.replace('# ', '').trim() : filename.replace('.md', '');
  
  // Extract author and date from italic line (e.g., *Published by CodeCraft • December 30, 2024 • 5 min read*)
  const metaMatch = lines.find(line => line.startsWith('*') && line.includes('•'));
  let author = 'CodeCraft';
  let date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  if (metaMatch) {
    const metaParts = metaMatch.replace(/\*/g, '').split('•').map(part => part.trim());
    if (metaParts[0] && metaParts[0].includes('by ')) {
      author = metaParts[0].replace('Published by ', '').replace('by ', '').trim();
    }
    if (metaParts[1]) {
      date = metaParts[1].trim();
    }
  }
  
  // Extract description (first paragraph after overview section or first non-heading content)
  const overviewIndex = lines.findIndex(line => line.toLowerCase().includes('## overview'));
  const startIndex = overviewIndex >= 0 ? overviewIndex + 1 : 0;
  const description = lines.slice(startIndex)
    .find(line => line.trim() && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-'))
    ?.trim() || 'Technical documentation and development insights.';
  
  const id = filename.replace('.md', '');
  const readingTime = estimateReadingTime(content);
  
  return {
    id,
    title,
    author,
    date,
    description: description.length > 150 ? description.substring(0, 150) + '...' : description,
    filename,
    readingTime,
    tags: ['Technical Documentation', 'Development'],
    heroImage: `/blog-images/${id}-hero.jpg`
  };
};

// API utility functions for blog posts
const fetchBlogPosts = async (): Promise<ApiBlogPost[]> => {
  try {
    const response = await fetch('/api/blog-posts');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.success ? data.posts || [] : [];
  } catch (error) {
    console.error('[MarkdownLoader] Error fetching blog posts:', error);
    return [];
  }
};

const fetchBlogPost = async (id: string): Promise<ApiBlogPost | null> => {
  try {
    const response = await fetch(`/api/blog-posts?id=${encodeURIComponent(id)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.success ? data.post : null;
  } catch (error) {
    console.error(`[MarkdownLoader] Error fetching blog post ${id}:`, error);
    return null;
  }
};

// Convert filename to blog post ID (remove .md extension)
const filenameToId = (filename: string): string => {
  return filename.replace(/\.md$/, '');
};

// Convert blog post ID to filename (add .md extension) 
const idToFilename = (id: string): string => {
  return id.endsWith('.md') ? id : `${id}.md`;
};

// Legacy hardcoded data structure (will be removed after migration)
const legacyBlogPostsData = new Map<string, string>([
  ['001-introducing-codecraft.md', `# Welcome to Scout AI: Introducing CodeCraft

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

### Code Presentation

Code blocks receive special attention with syntax highlighting and contextual explanations:

\`\`\`typescript
// Example: How we structure component documentation
export const FeatureComponent: React.FC<FeatureProps> = ({ 
  data, 
  onUpdate, 
  className 
}) => {
  // State management with clear intent
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom hooks for complex logic
  const { processData, error } = useDataProcessor(data);
  
  // Event handlers with descriptive names
  const handleUpdateClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await processData();
      onUpdate();
    } catch (err) {
      console.error('Processing failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processData, onUpdate]);
  
  return (
    <div className={\`feature-component $\{className}\`}>
      {/* Implementation details... */}
    </div>
  );
};
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

*Written with passion by CodeCraft | Scout AI Project | Bringing clarity to complex code*`],
  
  ['002-image-loading-optimization.md', `# Building High-Performance Image Loading with Test-Driven Development

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

## Testing Strategy: Comprehensive Coverage

Our TDD approach resulted in robust test coverage:

### Image Utilities Tests (18 tests)
- Format detection accuracy
- Placeholder generation
- Viewport calculations
- Image preloading promises

### LazyImage Component Tests (11 tests)
- Intersection Observer integration
- Loading state transitions
- Error handling scenarios
- Callback functionality
- Props validation

## Lessons Learned

### 1. TDD Accelerates Development
Writing tests first forced us to think through edge cases and API design before implementation. This prevented architectural mistakes and reduced debugging time.

### 2. Browser API Mocking is Complex
Testing components that rely on browser APIs (Intersection Observer, Image, Canvas) requires comprehensive mocking strategies. We invested time in proper mocks that paid off in test reliability.

### 3. State Management Simplicity
Using local component state with \`useState\` was sufficient for this use case. We avoided over-engineering with complex state management libraries.

### 4. Performance vs. Complexity Trade-offs
The intersection observer adds complexity but delivers significant performance benefits. The trade-off is worthwhile for image-heavy applications.

### 5. CSS Animations Enhance UX
The blur-to-sharp transition and shimmer effects significantly improve perceived performance, even when actual load times are unchanged.

## Conclusion

Building a high-performance image loading system using TDD methodology resulted in a robust, maintainable solution that significantly improves user experience. The combination of intersection observer-based lazy loading, visual loading states, and comprehensive testing creates a foundation for future enhancements.

Key takeaways:
- **TDD methodology** prevents architecture mistakes and reduces debugging
- **Visual feedback** during loading states improves perceived performance
- **Proper testing** of browser APIs requires thoughtful mocking strategies
- **Performance optimizations** should balance complexity with user benefit

The implementation successfully addresses our initial goals of reducing load times, improving user experience, and creating maintainable code. As we continue with mobile responsiveness optimizations, this foundation will support future enhancements while maintaining code quality and test coverage.

---

*This implementation is part of our ongoing Scout AI enhancement roadmap. Follow our progress as we continue optimizing for mobile devices and exploring advanced image processing techniques.*`]
]);

// Load blog post content
export const loadBlogPost = async (filename: string): Promise<BlogPostContent | null> => {
  try {
    console.log(`[MarkdownLoader] Loading blog post: ${filename}`);
    
    // Convert filename to ID for API call
    const blogId = filenameToId(filename);
    
    // Try to fetch from API first
    const apiBlogPost = await fetchBlogPost(blogId);
    if (apiBlogPost) {
      console.log(`[MarkdownLoader] Successfully loaded from API: ${apiBlogPost.metadata.title}`);
      
      return {
        metadata: apiBlogPost.metadata,
        content: apiBlogPost.content,
        rawContent: apiBlogPost.rawContent
      };
    }
    
    // Fallback to legacy hardcoded data if API fails
    console.warn(`[MarkdownLoader] API fetch failed, trying legacy data for: ${filename}`);
    const rawContent = legacyBlogPostsData.get(filename);
    if (!rawContent) {
      console.warn(`[MarkdownLoader] Blog post not found in legacy data: ${filename}`);
      return null;
    }
    
    // Parse frontmatter if it exists
    const { metadata: frontmatterMeta, content } = parseFrontmatter(rawContent);
    
    // Extract or use provided metadata
    const metadata = {
      ...extractMetadataFromMarkdown(rawContent, filename),
      ...frontmatterMeta
    } as BlogPostMetadata;
    
    console.log(`[MarkdownLoader] Successfully loaded from legacy data: ${metadata.title}`);
    
    return {
      metadata,
      content,
      rawContent
    };
  } catch (error) {
    console.error(`[MarkdownLoader] Error loading blog post ${filename}:`, error);
    return null;
  }
};

// Get all available blog posts
export const getAllBlogPosts = async (): Promise<BlogPostMetadata[]> => {
  try {
    console.log('[MarkdownLoader] Fetching all blog posts from API');
    
    // Try to fetch from API first
    const apiBlogPosts = await fetchBlogPosts();
    if (apiBlogPosts && apiBlogPosts.length > 0) {
      console.log(`[MarkdownLoader] Successfully loaded ${apiBlogPosts.length} posts from API`);
      
      // Return metadata from API posts
      const posts = apiBlogPosts.map(post => post.metadata);
      
      // Sort by date (newest first)
      return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    
    // Fallback to legacy hardcoded data if API fails
    console.warn('[MarkdownLoader] API fetch failed, using legacy hardcoded data');
    const posts: BlogPostMetadata[] = [];
    
    for (const [filename] of legacyBlogPostsData.entries()) {
      const rawContent = legacyBlogPostsData.get(filename);
      if (rawContent) {
        const { metadata: frontmatterMeta } = parseFrontmatter(rawContent);
        const metadata = {
          ...extractMetadataFromMarkdown(rawContent, filename),
          ...frontmatterMeta
        } as BlogPostMetadata;
        posts.push(metadata);
      }
    }
    
    // Sort by date (newest first)
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('[MarkdownLoader] Error getting all blog posts:', error);
    return [];
  }
};

// Legacy synchronous version for backward compatibility
export const getAllBlogPostsSync = (): BlogPostMetadata[] => {
  console.warn('[MarkdownLoader] Using deprecated synchronous getAllBlogPostsSync - consider using getAllBlogPosts instead');
  
  const posts: BlogPostMetadata[] = [];
  
  for (const [filename] of legacyBlogPostsData.entries()) {
    const rawContent = legacyBlogPostsData.get(filename);
    if (rawContent) {
      const { metadata: frontmatterMeta } = parseFrontmatter(rawContent);
      const metadata = {
        ...extractMetadataFromMarkdown(rawContent, filename),
        ...frontmatterMeta
      } as BlogPostMetadata;
      posts.push(metadata);
    }
  }
  
  // Sort by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};