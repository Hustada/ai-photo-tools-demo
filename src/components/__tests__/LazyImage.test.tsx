// © 2025 Mark Hustad — MIT License

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LazyImage from '../LazyImage';

// Mock intersection observer
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});

// Mock image utils
vi.mock('../../utils/imageUtils', () => ({
  createPlaceholderDataUrl: vi.fn().mockReturnValue('data:image/png;base64,placeholder'),
  detectImageFormatSupport: vi.fn().mockReturnValue({ webp: true, avif: false }),
  getOptimizedImageUrl: vi.fn().mockImplementation((url) => url),
  preloadImage: vi.fn(),
  isInViewport: vi.fn().mockReturnValue(true)
}));

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});

Object.defineProperty(global, 'Image', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    onload: null,
    onerror: null,
    src: '',
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0
  }))
});

describe('LazyImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test image',
    className: 'test-image',
    width: 300,
    height: 200
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset intersection observer mock for each test
    mockIntersectionObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render placeholder initially when not in viewport', () => {
    // Mock intersection observer to not trigger
    mockIntersectionObserver.mockImplementation((callback) => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    render(<LazyImage {...defaultProps} />);
    
    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'data:image/png;base64,placeholder');
    expect(image).toHaveAttribute('alt', 'Test image');
    expect(image).toHaveClass('test-image');
  });

  it('should have loading state initially', () => {
    render(<LazyImage {...defaultProps} />);
    
    const container = screen.getByTestId('lazy-image-container');
    expect(container).toHaveAttribute('data-loading', 'true');
  });

  it('should trigger intersection observer on mount', () => {
    const mockObserve = vi.fn();
    mockIntersectionObserver.mockImplementation(() => ({
      observe: mockObserve,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    render(<LazyImage {...defaultProps} />);
    
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should load actual image when entering viewport', async () => {
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    // Mock successful image load
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
      complete: false,
      naturalWidth: 300,
      naturalHeight: 200
    };
    
    vi.mocked(global.Image).mockImplementation(() => mockImage);

    render(<LazyImage {...defaultProps} />);
    
    // Simulate intersection
    intersectionCallback([{ isIntersecting: true, target: screen.getByRole('img') }]);
    
    // Simulate image load
    await waitFor(() => {
      if (mockImage.onload) {
        mockImage.complete = true;
        mockImage.onload();
      }
    });

    await waitFor(() => {
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', defaultProps.src);
    });
  });

  it('should handle image load error gracefully', async () => {
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    // Mock image load error
    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
      complete: false,
      naturalWidth: 0,
      naturalHeight: 0
    };
    
    vi.mocked(global.Image).mockImplementation(() => mockImage);

    render(<LazyImage {...defaultProps} />);
    
    // Simulate intersection
    intersectionCallback([{ isIntersecting: true, target: screen.getByRole('img') }]);
    
    // Simulate image error
    await waitFor(() => {
      if (mockImage.onerror) {
        mockImage.onerror();
      }
    });

    await waitFor(() => {
      const container = screen.getByTestId('lazy-image-container');
      expect(container).toHaveAttribute('data-error', 'true');
    });
  });

  it('should set loaded state when image loads successfully', async () => {
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
      complete: false,
      naturalWidth: 300,
      naturalHeight: 200
    };
    
    vi.mocked(global.Image).mockImplementation(() => mockImage);

    render(<LazyImage {...defaultProps} />);
    
    // Start with loading state
    expect(screen.getByTestId('lazy-image-container')).toHaveAttribute('data-loading', 'true');
    
    // Simulate intersection and load
    intersectionCallback([{ isIntersecting: true, target: screen.getByRole('img') }]);
    
    await waitFor(() => {
      if (mockImage.onload) {
        mockImage.complete = true;
        mockImage.onload();
      }
    });

    await waitFor(() => {
      const container = screen.getByTestId('lazy-image-container');
      expect(container).toHaveAttribute('data-loading', 'false');
      expect(container).toHaveAttribute('data-loaded', 'true');
    });
  });

  it('should accept custom placeholder', () => {
    const customPlaceholder = 'data:image/png;base64,custom';
    
    render(<LazyImage {...defaultProps} placeholder={customPlaceholder} />);
    
    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', customPlaceholder);
  });

  it('should apply custom loading threshold', () => {
    const customThreshold = 100;
    
    mockIntersectionObserver.mockImplementation((callback, options) => {
      expect(options?.rootMargin).toBe('100px');
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    render(<LazyImage {...defaultProps} loadingThreshold={customThreshold} />);
  });

  it('should cleanup intersection observer on unmount', () => {
    const mockDisconnect = vi.fn();
    mockIntersectionObserver.mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: mockDisconnect,
    }));

    const { unmount } = render(<LazyImage {...defaultProps} />);
    
    unmount();
    
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should call onLoad callback when image loads', async () => {
    const mockOnLoad = vi.fn();
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
      complete: false,
      naturalWidth: 300,
      naturalHeight: 200
    };
    
    vi.mocked(global.Image).mockImplementation(() => mockImage);

    render(<LazyImage {...defaultProps} onLoad={mockOnLoad} />);
    
    // Simulate intersection and load
    intersectionCallback([{ isIntersecting: true, target: screen.getByRole('img') }]);
    
    await waitFor(() => {
      if (mockImage.onload) {
        mockImage.complete = true;
        mockImage.onload();
      }
    });

    await waitFor(() => {
      expect(mockOnLoad).toHaveBeenCalledWith(expect.objectContaining({
        naturalWidth: 300,
        naturalHeight: 200
      }));
    });
  });

  it('should call onError callback when image fails to load', async () => {
    const mockOnError = vi.fn();
    let intersectionCallback: (entries: any[]) => void;
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    const mockImage = {
      onload: null as any,
      onerror: null as any,
      src: '',
      complete: false,
      naturalWidth: 0,
      naturalHeight: 0
    };
    
    vi.mocked(global.Image).mockImplementation(() => mockImage);

    render(<LazyImage {...defaultProps} onError={mockOnError} />);
    
    // Simulate intersection and error
    intersectionCallback([{ isIntersecting: true, target: screen.getByRole('img') }]);
    
    await waitFor(() => {
      if (mockImage.onerror) {
        mockImage.onerror();
      }
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled();
    });
  });
});