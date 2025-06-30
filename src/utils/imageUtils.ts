// © 2025 Mark Hustad — MIT License

/**
 * Image utility functions for optimized loading and format detection
 */

export interface ImageFormatSupport {
  webp: boolean;
  avif: boolean;
}

/**
 * Detect browser support for modern image formats
 */
export const detectImageFormatSupport = (): ImageFormatSupport => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return {
    webp: canvas.toDataURL('image/webp').startsWith('data:image/webp'),
    avif: canvas.toDataURL('image/avif').startsWith('data:image/avif')
  };
};

/**
 * Convert image URL to optimized format if supported
 */
export const getOptimizedImageUrl = (
  originalUrl: string, 
  formatSupport: ImageFormatSupport,
  quality: number = 85
): string => {
  // For now, return original URL since we'd need server-side image processing
  // This is a placeholder for future implementation with image CDN
  return originalUrl;
};

/**
 * Create a placeholder image data URL for loading states
 */
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

/**
 * Preload an image and return a promise
 */
export const preloadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Check if an element is in the viewport
 */
export const isInViewport = (element: HTMLElement, threshold: number = 0): boolean => {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  
  return (
    rect.top >= -threshold &&
    rect.left >= -threshold &&
    rect.bottom <= windowHeight + threshold &&
    rect.right <= windowWidth + threshold
  );
};

/**
 * Calculate the optimal image size based on container and device pixel ratio
 */
export const calculateOptimalImageSize = (
  containerWidth: number,
  containerHeight: number,
  devicePixelRatio: number = window.devicePixelRatio || 1
): { width: number; height: number } => {
  return {
    width: Math.ceil(containerWidth * devicePixelRatio),
    height: Math.ceil(containerHeight * devicePixelRatio)
  };
};