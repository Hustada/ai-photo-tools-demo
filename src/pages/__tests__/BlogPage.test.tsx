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
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    const firstPost = screen.getByText('Introducing CodeCraft: Your Technical Documentation Agent');
    await user.click(firstPost);
    
    // Should show the post content
    await waitFor(() => {
      expect(screen.getByText('Back to blog posts')).toBeInTheDocument();
      expect(screen.getByText('💡 Want to read the full formatted version?')).toBeInTheDocument();
    });
  });

  it('should navigate back to blog list from post view', async () => {
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Click on a post
    const firstPost = screen.getByText('Introducing CodeCraft: Your Technical Documentation Agent');
    await user.click(firstPost);
    
    await waitFor(() => {
      expect(screen.getByText('Back to blog posts')).toBeInTheDocument();
    });

    // Click back to blog posts
    const backToBlogButton = screen.getByText('Back to blog posts');
    await user.click(backToBlogButton);
    
    // Should be back to the blog list
    await waitFor(() => {
      expect(screen.getByText('Scout AI Development Blog')).toBeInTheDocument();
      expect(screen.queryByText('Back to blog posts')).not.toBeInTheDocument();
    });
  });

  it('should display correct post metadata', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check metadata for both posts
    expect(screen.getAllByText('Published on December 30, 2024 by CodeCraft')).toHaveLength(2);
    expect(screen.getByText('📄 001-introducing-codecraft.md')).toBeInTheDocument();
    expect(screen.getByText('📄 002-image-loading-optimization.md')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', async () => {
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Check that the back button has proper title
    const backButton = screen.getByTitle('Back to Scout AI');
    expect(backButton).toBeInTheDocument();
    
    // Check that blog link has proper title
    const blogTitle = screen.getByText('CodeCraft Blog');
    expect(blogTitle).toBeInTheDocument();
  });

  it('should display helpful instructions for reading full blog posts', async () => {
    const user = userEvent.setup();
    renderWithRouter(<BlogPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading blog posts...')).not.toBeInTheDocument();
    });

    // Click on the image optimization post
    const imagePost = screen.getByText('Building High-Performance Image Loading with Test-Driven Development');
    await user.click(imagePost);
    
    await waitFor(() => {
      expect(screen.getByText('docs/code-blog/002-image-loading-optimization.md')).toBeInTheDocument();
      expect(screen.getByText('Open this file in your preferred markdown viewer or code editor for the best reading experience.')).toBeInTheDocument();
    });
  });
});