// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPlaceholderDataUrl, detectImageFormatSupport, getOptimizedImageUrl } from '../utils/imageUtils';

export interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  loadingThreshold?: number;
  quality?: number;
  onLoad?: (img: HTMLImageElement) => void;
  onError?: (error: Event) => void;
  [key: string]: any; // Allow additional props
}

export interface LazyImageState {
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  currentSrc: string;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width = 300,
  height = 200,
  placeholder,
  loadingThreshold = 50,
  quality = 85,
  onLoad,
  onError,
  ...props
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  const [state, setState] = useState<LazyImageState>({
    isLoading: true,
    isLoaded: false,
    hasError: false,
    currentSrc: placeholder || createPlaceholderDataUrl(width, height)
  });

  // Memoize format support detection
  const formatSupport = useRef(detectImageFormatSupport());

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      isLoaded: true,
      hasError: false,
      currentSrc: src
    }));

    if (onLoad) {
      onLoad(img);
    }
  }, [src, onLoad]);

  const handleImageError = useCallback((error: Event) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      isLoaded: false,
      hasError: true
    }));

    if (onError) {
      onError(error);
    }
  }, [onError]);

  const loadImage = useCallback(() => {
    if (state.isLoaded || state.hasError) return;

    const img = new Image();
    
    img.onload = () => handleImageLoad(img);
    img.onerror = handleImageError;
    
    // Get optimized URL based on format support
    const optimizedSrc = getOptimizedImageUrl(src, formatSupport.current, quality);
    img.src = optimizedSrc;
  }, [src, quality, state.isLoaded, state.hasError, handleImageLoad, handleImageError]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    
    if (entry.isIntersecting && !state.isLoaded && !state.hasError) {
      loadImage();
      
      // Stop observing once we start loading
      if (observerRef.current && imageRef.current) {
        observerRef.current.unobserve(imageRef.current);
      }
    }
  }, [loadImage, state.isLoaded, state.hasError]);

  // Set up intersection observer
  useEffect(() => {
    if (!imageRef.current) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: `${loadingThreshold}px`,
      threshold: 0.1
    });

    observerRef.current.observe(imageRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, loadingThreshold]);

  // Update src when prop changes
  useEffect(() => {
    if (state.currentSrc !== src && !state.isLoading && state.isLoaded) {
      setState(prev => ({
        ...prev,
        isLoading: true,
        isLoaded: false,
        hasError: false,
        currentSrc: placeholder || createPlaceholderDataUrl(width, height)
      }));
    }
  }, [src, placeholder, width, height, state.currentSrc, state.isLoading, state.isLoaded]);

  return (
    <div
      data-testid="lazy-image-container"
      data-loading={state.isLoading}
      data-loaded={state.isLoaded}
      data-error={state.hasError}
      className="lazy-image-container"
    >
      <img
        ref={imageRef}
        src={state.currentSrc}
        alt={alt}
        className={`lazy-image ${className} ${
          state.isLoading ? 'lazy-image--loading' : ''
        } ${
          state.isLoaded ? 'lazy-image--loaded' : ''
        } ${
          state.hasError ? 'lazy-image--error' : ''
        }`}
        width={width}
        height={height}
        loading="lazy" // Native lazy loading as fallback
        {...props}
      />
    </div>
  );
};

export default LazyImage;