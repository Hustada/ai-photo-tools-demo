// © 2025 Mark Hustad — MIT License
// Advanced photo filtering algorithms and utilities

import type { Photo } from './types';
import type { FilterCriteria } from '../components/AdvancedPhotoFilter';

export interface FilterResult {
  photos: Photo[];
  totalMatched: number;
  executionTime: number;
  filterBreakdown: {
    dateRange: number;
    fileSize: number;
    dimensions: number;
    tags: number;
    search: number;
  };
}

/**
 * Advanced photo filtering with performance tracking
 */
export const applyAdvancedFilters = (
  photos: Photo[],
  criteria: FilterCriteria
): FilterResult => {
  const startTime = performance.now();
  let filteredPhotos = [...photos];
  
  const breakdown = {
    dateRange: photos.length,
    fileSize: photos.length,
    dimensions: photos.length,
    tags: photos.length,
    search: photos.length
  };

  // Date range filter
  if (criteria.dateRange.start || criteria.dateRange.end) {
    filteredPhotos = filterByDateRange(filteredPhotos, criteria.dateRange);
    breakdown.dateRange = filteredPhotos.length;
  }

  // File size filter
  if (criteria.fileSize.min > 0 || criteria.fileSize.max < 100) {
    filteredPhotos = filterByFileSize(filteredPhotos, criteria.fileSize);
    breakdown.fileSize = filteredPhotos.length;
  }

  // Dimensions filter
  if (criteria.dimensions.minWidth > 0 || criteria.dimensions.minHeight > 0) {
    filteredPhotos = filterByDimensions(filteredPhotos, criteria.dimensions);
    breakdown.dimensions = filteredPhotos.length;
  }

  // Tags filter
  if (criteria.tags.length > 0) {
    filteredPhotos = filterByTags(filteredPhotos, criteria.tags);
    breakdown.tags = filteredPhotos.length;
  }

  // Search filter (most expensive, do last)
  if (criteria.searchQuery.trim()) {
    filteredPhotos = filterBySearch(filteredPhotos, criteria.searchQuery);
    breakdown.search = filteredPhotos.length;
  }

  const executionTime = performance.now() - startTime;

  return {
    photos: filteredPhotos,
    totalMatched: filteredPhotos.length,
    executionTime,
    filterBreakdown: breakdown
  };
};

/**
 * Filter photos by date range
 */
const filterByDateRange = (
  photos: Photo[],
  dateRange: { start: Date | null; end: Date | null }
): Photo[] => {
  return photos.filter(photo => {
    const photoDate = new Date(photo.taken_at);
    
    if (dateRange.start && photoDate < dateRange.start) {
      return false;
    }
    
    if (dateRange.end && photoDate > dateRange.end) {
      return false;
    }
    
    return true;
  });
};

/**
 * Filter photos by file size (in MB)
 */
const filterByFileSize = (
  photos: Photo[],
  sizeRange: { min: number; max: number }
): Photo[] => {
  return photos.filter(photo => {
    // Estimate file size based on dimensions and compression
    const estimatedSizeMB = estimateFileSizeMB(photo);
    return estimatedSizeMB >= sizeRange.min && estimatedSizeMB <= sizeRange.max;
  });
};

/**
 * Filter photos by minimum dimensions
 */
const filterByDimensions = (
  photos: Photo[],
  dimensions: { minWidth: number; minHeight: number }
): Photo[] => {
  return photos.filter(photo => {
    const width = photo.width || 0;
    const height = photo.height || 0;
    
    return width >= dimensions.minWidth && height >= dimensions.minHeight;
  });
};

/**
 * Filter photos by tags (any tag match)
 */
const filterByTags = (photos: Photo[], requiredTags: string[]): Photo[] => {
  return photos.filter(photo => {
    if (!photo.tags || photo.tags.length === 0) {
      return false;
    }
    
    // Check if photo has any of the required tags
    return requiredTags.some(requiredTag =>
      photo.tags.some(photoTag =>
        photoTag.toLowerCase().includes(requiredTag.toLowerCase())
      )
    );
  });
};

/**
 * Filter photos by search query (filename, description, tags)
 */
const filterBySearch = (photos: Photo[], query: string): Photo[] => {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  
  return photos.filter(photo => {
    const searchableText = [
      photo.filename || '',
      photo.description || '',
      ...(photo.tags || [])
    ].join(' ').toLowerCase();
    
    // All search terms must be found
    return searchTerms.every(term => searchableText.includes(term));
  });
};

/**
 * Estimate file size in MB based on photo properties
 */
const estimateFileSizeMB = (photo: Photo): number => {
  const width = photo.width || 1920;
  const height = photo.height || 1080;
  const pixels = width * height;
  
  // Rough estimation: 3 bytes per pixel (RGB) with JPEG compression (~10:1)
  const estimatedBytes = (pixels * 3) / 10;
  const estimatedMB = estimatedBytes / (1024 * 1024);
  
  return Math.round(estimatedMB * 100) / 100; // Round to 2 decimal places
};

/**
 * Create filter preset configurations
 */
export const FILTER_PRESETS: Record<string, Partial<FilterCriteria>> = {
  'high-res': {
    dimensions: { minWidth: 2048, minHeight: 1536 },
    fileSize: { min: 2, max: 100 }
  },
  'recent': {
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: null
    }
  },
  'large-files': {
    fileSize: { min: 5, max: 100 }
  },
  'tagged': {
    tags: ['important', 'progress', 'issue']
  }
};

/**
 * Debounced filter application for performance
 */
export const createDebouncedFilter = (
  callback: (photos: Photo[], criteria: FilterCriteria) => void,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout;
  
  return (photos: Photo[], criteria: FilterCriteria) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(photos, criteria);
    }, delay);
  };
};