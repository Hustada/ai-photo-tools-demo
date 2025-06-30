// © 2025 Mark Hustad — MIT License

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BlogPage from '../BlogPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the markdown loader
vi.mock('../../utils/markdownLoader', () => ({
  loadBlogPost: vi.fn(),
  getAllBlogPosts: vi.fn(() => [
    {
      id: '001',
      title: 'Introducing CodeCraft: Your Technical Documentation Agent',
      author: 'CodeCraft',
      date: 'December 30, 2024',
      description: 'Introduction to our technical documentation system',
      filename: '001-introducing-codecraft.md',
      readingTime: 5,
      tags: ['Technical Documentation'],
      heroImage: '/blog-images/001-hero.jpg'
    },
    {
      id: '002',
      title: 'Building High-Performance Image Loading with Test-Driven Development',
      author: 'Mark Hustad',
      date: 'December 30, 2024',
      description: 'Deep dive into implementing lazy image loading',
      filename: '002-image-loading-optimization.md',
      readingTime: 8,
      tags: ['Performance', 'TDD'],
      heroImage: '/blog-images/002-hero.jpg'
    }
  ])
}));

// Mock the image generation utility
vi.mock('../../utils/imageGeneration', () => ({
  generateBlogHeroImage: vi.fn(() => Promise.resolve({
    success: true,
    imageUrl: '/blog-images/test-hero.jpg',
    cached: false
  }))
}));

// Mock BlogArticle component
vi.mock('../../components/BlogArticle', () => {
  return {
    default: ({ post, onBack }: any) => (
      <div data-testid="blog-article">
        <button onClick={onBack}>Back to blog posts</button>
        <h1>{post.metadata.title}</h1>
        <div>{post.content}</div>
      </div>
    )
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('BlogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render blog page with loading state initially', () => {
    renderWithRouter(<BlogPage />);
    
    expect(screen.getByText('Loading blog posts...')).toBeInTheDocument();
  });

  it('should render blog posts list after loading', async () => {
    renderWithRouter(<BlogPage />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check header elements
    expect(screen.getByText('CodeCraft Blog')).toBeInTheDocument();
    expect(screen.getByText('Scout AI Development Blog')).toBeInTheDocument();
    
    // Check blog posts
    expect(screen.getByText('Introducing CodeCraft: Your Technical Documentation Agent')).toBeInTheDocument();
    expect(screen.getByText('Building High-Performance Image Loading with Test-Driven Development')).toBeInTheDocument();
    
    // Check reading time and author info
    expect(screen.getByText('5 min read')).toBeInTheDocument();
    expect(screen.getByText('8 min read')).toBeInTheDocument();
    expect(screen.getByText('By CodeCraft')).toBeInTheDocument();
    expect(screen.getByText('By Mark Hustad')).toBeInTheDocument();
  });

  it('should navigate back to Scout AI when back button is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    const backButton = screen.getByText('← Scout AI');
    await user.click(backButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should open blog post when clicked', async () => {
    const { loadBlogPost } = await import('../../utils/markdownLoader');
    const mockLoadBlogPost = loadBlogPost as any;
    
    // Mock the blog post content
    mockLoadBlogPost.mockResolvedValue({
      metadata: {
        id: '001',
        title: 'Introducing CodeCraft: Your Technical Documentation Agent',
        author: 'CodeCraft',
        date: 'December 30, 2024',
        description: 'Introduction to our technical documentation system',
        filename: '001-introducing-codecraft.md',
        readingTime: 5,
        tags: ['Technical Documentation'],
        heroImage: '/blog-images/001-hero.jpg'
      },
      content: '# Test Content',
      rawContent: '# Test Content'
    });
    
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    const firstPost = screen.getByText('Introducing CodeCraft: Your Technical Documentation Agent');
    await user.click(firstPost);
    
    // Should show the BlogArticle component
    await waitFor(() => {
      expect(screen.getByTestId('blog-article')).toBeInTheDocument();
      expect(screen.getByText('Back to blog posts')).toBeInTheDocument();
    });
  });

  it('should navigate back to blog list from post view', async () => {
    const { loadBlogPost } = await import('../../utils/markdownLoader');
    const mockLoadBlogPost = loadBlogPost as any;
    
    mockLoadBlogPost.mockResolvedValue({
      metadata: {
        id: '001',
        title: 'Introducing CodeCraft: Your Technical Documentation Agent',
        author: 'CodeCraft',
        date: 'December 30, 2024',
        description: 'Introduction to our technical documentation system',
        filename: '001-introducing-codecraft.md',
        readingTime: 5,
        tags: ['Technical Documentation'],
        heroImage: '/blog-images/001-hero.jpg'
      },
      content: '# Test Content',
      rawContent: '# Test Content'
    });
    
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Click on a post
    const firstPost = screen.getByText('Introducing CodeCraft: Your Technical Documentation Agent');
    await user.click(firstPost);
    
    await waitFor(() => {
      expect(screen.getByTestId('blog-article')).toBeInTheDocument();
    });

    // Click back to blog posts
    const backToBlogButton = screen.getByText('Back to blog posts');
    await user.click(backToBlogButton);
    
    // Should be back to the blog list
    await waitFor(() => {
      expect(screen.getByText('Scout AI Development Blog')).toBeInTheDocument();
      expect(screen.queryByTestId('blog-article')).not.toBeInTheDocument();
    });
  });

  it('should display correct post metadata', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check metadata for both posts
    expect(screen.getByText('By CodeCraft')).toBeInTheDocument();
    expect(screen.getByText('By Mark Hustad')).toBeInTheDocument();
    expect(screen.getAllByText('December 30, 2024')).toHaveLength(2);
    expect(screen.getByText('5 min read')).toBeInTheDocument();
    expect(screen.getByText('8 min read')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check that the back button has proper title
    const backButton = screen.getByTitle('Back to Scout AI');
    expect(backButton).toBeInTheDocument();
    
    // Check that blog title is present
    const blogTitle = screen.getByText('CodeCraft Blog');
    expect(blogTitle).toBeInTheDocument();
  });

  it('should display blog posts with hero images', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check that hero images are present
    const heroImages = screen.getAllByRole('img');
    expect(heroImages.length).toBeGreaterThanOrEqual(2);
    
    // Check alt text for hero images
    expect(screen.getByAltText('Hero image for Introducing CodeCraft: Your Technical Documentation Agent')).toBeInTheDocument();
    expect(screen.getByAltText('Hero image for Building High-Performance Image Loading with Test-Driven Development')).toBeInTheDocument();
  });
  
  it('should show tags for each blog post', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check that tags are displayed
    expect(screen.getByText('Technical Documentation')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('TDD')).toBeInTheDocument();
  });
});