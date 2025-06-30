// © 2025 Mark Hustad — MIT License

import { 
  detectImageFormatSupport, 
  getOptimizedImageUrl, 
  createPlaceholderDataUrl, 
  preloadImage, 
  isInViewport, 
  calculateOptimalImageSize 
} from '../imageUtils';

// Mock canvas and related APIs for testing
const mockCanvas = {
  width: 1,
  height: 1,
  toDataURL: vi.fn(),
  getContext: vi.fn()
};

const mockContext = {
  fillStyle: '',
  font: '',
  textAlign: '',
  fillRect: vi.fn(),
  fillText: vi.fn()
};

// Mock document.createElement for canvas
Object.defineProperty(document, 'createElement', {
  value: vi.fn().mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      const canvas = {
        width: 1,
        height: 1,
        toDataURL: mockCanvas.toDataURL,
        getContext: vi.fn().mockReturnValue(mockContext)
      };
      return canvas;
    }
    return {};
  }),
  writable: true
});

describe('imageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectImageFormatSupport', () => {
    it('should detect WebP support when canvas supports it', () => {
      mockCanvas.toDataURL.mockImplementation((format: string) => {
        if (format === 'image/webp') return 'data:image/webp;base64,test';
        if (format === 'image/avif') return 'data:image/png;base64,test';
        return 'data:image/png;base64,test';
      });

      const support = detectImageFormatSupport();
      
      expect(support.webp).toBe(true);
      expect(support.avif).toBe(false);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/webp');
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/avif');
    });

    it('should detect AVIF support when canvas supports it', () => {
      mockCanvas.toDataURL.mockImplementation((format: string) => {
        if (format === 'image/webp') return 'data:image/png;base64,test';
        if (format === 'image/avif') return 'data:image/avif;base64,test';
        return 'data:image/png;base64,test';
      });

      const support = detectImageFormatSupport();
      
      expect(support.webp).toBe(false);
      expect(support.avif).toBe(true);
    });

    it('should detect no modern format support when canvas does not support them', () => {
      mockCanvas.toDataURL.mockReturnValue('data:image/png;base64,test');

      const support = detectImageFormatSupport();
      
      expect(support.webp).toBe(false);
      expect(support.avif).toBe(false);
    });
  });

  describe('getOptimizedImageUrl', () => {
    it('should return original URL for now (placeholder implementation)', () => {
      const originalUrl = 'https://example.com/image.jpg';
      const formatSupport = { webp: true, avif: false };
      
      const optimizedUrl = getOptimizedImageUrl(originalUrl, formatSupport);
      
      expect(optimizedUrl).toBe(originalUrl);
    });

    it('should accept quality parameter without changing behavior', () => {
      const originalUrl = 'https://example.com/image.jpg';
      const formatSupport = { webp: true, avif: true };
      
      const optimizedUrl = getOptimizedImageUrl(originalUrl, formatSupport, 95);
      
      expect(optimizedUrl).toBe(originalUrl);
    });
  });

  describe('createPlaceholderDataUrl', () => {
    it('should create a placeholder data URL with default dimensions', () => {
      let createdCanvas: any;
      vi.mocked(document.createElement).mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          createdCanvas = {
            width: 1,
            height: 1,
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,placeholder'),
            getContext: vi.fn().mockReturnValue(mockContext)
          };
          return createdCanvas;
        }
        return {};
      });
      
      const placeholder = createPlaceholderDataUrl();
      
      expect(createdCanvas.width).toBe(300);
      expect(createdCanvas.height).toBe(200);
      expect(mockContext.fillStyle).toBe('#9ca3af');
      expect(mockContext.fillText).toHaveBeenCalledWith('Loading...', 150, 100);
      expect(placeholder).toBe('data:image/png;base64,placeholder');
    });

    it('should create a placeholder with custom dimensions and color', () => {
      let createdCanvas: any;
      let freshMockContext: any;
      const fillStyleHistory: string[] = [];
      
      vi.mocked(document.createElement).mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          freshMockContext = {
            set fillStyle(value: string) {
              fillStyleHistory.push(value);
            },
            get fillStyle() {
              return fillStyleHistory[fillStyleHistory.length - 1] || '';
            },
            font: '',
            textAlign: '',
            fillRect: vi.fn(),
            fillText: vi.fn()
          };
          
          createdCanvas = {
            width: 1,
            height: 1,
            toDataURL: vi.fn().mockReturnValue('data:image/png;base64,custom'),
            getContext: vi.fn().mockReturnValue(freshMockContext)
          };
          return createdCanvas;
        }
        return {};
      });
      
      const placeholder = createPlaceholderDataUrl(400, 300, '#ff0000');
      
      expect(createdCanvas.width).toBe(400);
      expect(createdCanvas.height).toBe(300);
      expect(fillStyleHistory).toContain('#ff0000'); // Background color was set
      expect(fillStyleHistory).toContain('#9ca3af'); // Text color was set
      expect(freshMockContext.fillText).toHaveBeenCalledWith('Loading...', 200, 150);
      expect(placeholder).toBe('data:image/png;base64,custom');
    });

    it('should handle missing canvas context gracefully', () => {
      const mockCanvasNoContext = {
        ...mockCanvas,
        getContext: vi.fn().mockReturnValue(null)
      };
      
      vi.mocked(document.createElement).mockReturnValue(mockCanvasNoContext as any);
      
      const placeholder = createPlaceholderDataUrl();
      
      expect(placeholder).toBe('');
    });
  });

  describe('preloadImage', () => {
    it('should resolve with image element when image loads successfully', async () => {
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: ''
      };
      
      // Mock Image constructor
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      const loadPromise = preloadImage('https://example.com/image.jpg');
      
      // Simulate successful load
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload();
      }, 0);
      
      const result = await loadPromise;
      
      expect(result).toBe(mockImage);
      expect(mockImage.src).toBe('https://example.com/image.jpg');
    });

    it('should reject when image fails to load', async () => {
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: ''
      };
      
      global.Image = vi.fn().mockImplementation(() => mockImage);
      
      const loadPromise = preloadImage('https://example.com/invalid.jpg');
      
      // Simulate error
      setTimeout(() => {
        if (mockImage.onerror) mockImage.onerror();
      }, 0);
      
      await expect(loadPromise).rejects.toBeUndefined();
    });
  });

  describe('isInViewport', () => {
    const mockElement = {
      getBoundingClientRect: vi.fn()
    } as any;

    beforeEach(() => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
    });

    it('should return true when element is fully in viewport', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: 100,
        left: 100,
        bottom: 200,
        right: 300
      });
      
      const result = isInViewport(mockElement);
      
      expect(result).toBe(true);
    });

    it('should return false when element is above viewport', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: -100,
        left: 100,
        bottom: -50,
        right: 300
      });
      
      const result = isInViewport(mockElement);
      
      expect(result).toBe(false);
    });

    it('should return false when element is below viewport', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: 900,
        left: 100,
        bottom: 1000,
        right: 300
      });
      
      const result = isInViewport(mockElement);
      
      expect(result).toBe(false);
    });

    it('should return true when element is partially in viewport with threshold', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        top: -50,
        left: 100,
        bottom: 50,
        right: 300
      });
      
      const result = isInViewport(mockElement, 100);
      
      expect(result).toBe(true);
    });
  });

  describe('calculateOptimalImageSize', () => {
    it('should calculate optimal size with default device pixel ratio', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });
      
      const result = calculateOptimalImageSize(300, 200);
      
      expect(result).toEqual({ width: 300, height: 200 });
    });

    it('should calculate optimal size with high DPI device', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });
      
      const result = calculateOptimalImageSize(300, 200);
      
      expect(result).toEqual({ width: 600, height: 400 });
    });

    it('should handle custom device pixel ratio parameter', () => {
      const result = calculateOptimalImageSize(300, 200, 1.5);
      
      expect(result).toEqual({ width: 450, height: 300 });
    });

    it('should handle missing devicePixelRatio gracefully', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: undefined, writable: true });
      
      const result = calculateOptimalImageSize(300, 200);
      
      expect(result).toEqual({ width: 300, height: 200 });
    });
  });
});