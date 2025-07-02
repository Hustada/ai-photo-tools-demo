// © 2025 Mark Hustad — MIT License

import type { Photo } from '../types';

export type AnalysisMode = 'smart' | 'date-range' | 'all' | 'selection';

export interface FilterOptions {
  mode: AnalysisMode;
  startDate?: Date;
  endDate?: Date;
  selectedPhotoIds?: string[];
  newPhotoDays?: number; // For 'smart' mode
  forceReanalysis?: boolean; // Ignore previous analysis
  includeArchived?: boolean; // Include archived photos (default: false)
}

/**
 * Filter photos based on analysis mode and options
 */
export function filterPhotosForAnalysis(
  photos: Photo[], 
  options: FilterOptions
): Photo[] {
  const { mode, startDate, endDate, selectedPhotoIds, newPhotoDays = 7, forceReanalysis = false, includeArchived = false } = options;
  
  // First filter out archived photos unless explicitly included
  const filteredPhotos = includeArchived ? photos : photos.filter(photo => photo.archive_state !== 'archived');

  switch (mode) {
    case 'smart':
      return getSmartFilteredPhotos(filteredPhotos, newPhotoDays, forceReanalysis);
      
    case 'date-range':
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required for date-range mode');
      }
      return getPhotosInDateRange(filteredPhotos, startDate, endDate, forceReanalysis);
      
    case 'all':
      return forceReanalysis ? filteredPhotos : getUnanalyzedPhotos(filteredPhotos);
      
    case 'selection':
      if (!selectedPhotoIds || selectedPhotoIds.length === 0) {
        throw new Error('Selected photo IDs are required for selection mode');
      }
      return filteredPhotos.filter(photo => selectedPhotoIds.includes(photo.id));
      
    default:
      throw new Error(`Unknown analysis mode: ${mode}`);
  }
}

/**
 * Get photos for "smart" analysis - new photos from recent days
 */
function getSmartFilteredPhotos(
  photos: Photo[], 
  daysSince: number, 
  forceReanalysis: boolean
): Photo[] {
  const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);
  
  return photos.filter(photo => {
    // Convert Unix timestamp to Date (captured_at is in seconds, need milliseconds)
    const capturedAt = new Date(photo.captured_at * 1000);
    
    // If forcing reanalysis, include all photos from the timeframe
    if (forceReanalysis) {
      return capturedAt >= cutoffDate;
    }
    
    // Otherwise, apply smart logic
    // Photo is new if:
    // 1. Never analyzed, OR
    // 2. Captured after last analysis, OR  
    // 3. Analysis is older than cutoff date
    
    if (!photo.scout_ai_analyzed_at) {
      // For never-analyzed photos, check if they're within the time window
      return capturedAt >= cutoffDate;
    }
    
    const analyzedAt = new Date(photo.scout_ai_analyzed_at);
    
    // If photo was captured after it was analyzed, it's "new"
    if (capturedAt > analyzedAt) {
      return true;
    }
    
    // If analysis is older than cutoff, consider it stale
    return analyzedAt < cutoffDate;
  });
}

/**
 * Get photos within a specific date range
 */
function getPhotosInDateRange(
  photos: Photo[], 
  startDate: Date, 
  endDate: Date,
  forceReanalysis: boolean
): Photo[] {
  const photosInRange = photos.filter(photo => {
    // Convert Unix timestamp to Date (captured_at is in seconds, need milliseconds)
    const capturedAt = new Date(photo.captured_at * 1000);
    return capturedAt >= startDate && capturedAt <= endDate;
  });
  
  if (forceReanalysis) {
    return photosInRange;
  }
  
  // Only return unanalyzed photos in the range
  return photosInRange.filter(photo => !photo.scout_ai_analyzed_at);
}

/**
 * Get photos that have never been analyzed
 */
function getUnanalyzedPhotos(photos: Photo[]): Photo[] {
  return photos.filter(photo => !photo.scout_ai_analyzed_at);
}

/**
 * Get analysis mode description for UI display
 */
export function getAnalysisModeDescription(options: FilterOptions): string {
  const { mode, startDate, endDate, selectedPhotoIds, newPhotoDays = 7, forceReanalysis, includeArchived = false } = options;

  switch (mode) {
    case 'smart':
      const forceText = forceReanalysis ? ' (re-analyzing all)' : '';
      const smartArchiveText = includeArchived ? ' including archived' : ' excluding archived';
      return `New photos from last ${newPhotoDays} day${newPhotoDays === 1 ? '' : 's'}${forceText}${smartArchiveText}`;
      
    case 'date-range':
      if (!startDate || !endDate) return 'Custom date range';
      const start = startDate.toLocaleDateString();
      const end = endDate.toLocaleDateString();
      const forceRangeText = forceReanalysis ? ' (re-analyzing all)' : ' (new only)';
      return `${start} to ${end}${forceRangeText}`;
      
    case 'all':
      const archiveText = includeArchived ? ' including archived' : ' excluding archived';
      return forceReanalysis ? `All photos (re-analyzing${archiveText})` : `All unanalyzed photos${archiveText}`;
      
    case 'selection':
      const count = selectedPhotoIds?.length || 0;
      return `${count} selected photo${count === 1 ? '' : 's'}`;
      
    default:
      return 'Unknown mode';
  }
}

/**
 * Estimate how many photos will be analyzed with given options
 */
export function estimateAnalysisCount(
  photos: Photo[], 
  options: FilterOptions
): { count: number; description: string } {
  try {
    const filteredPhotos = filterPhotosForAnalysis(photos, options);
    const count = filteredPhotos.length;
    const description = getAnalysisModeDescription(options);
    
    return { count, description };
  } catch (error) {
    return { 
      count: 0, 
      description: error instanceof Error ? error.message : 'Error estimating count'
    };
  }
}

/**
 * Validate filter options
 */
export function validateFilterOptions(options: FilterOptions): { valid: boolean; error?: string } {
  const { mode, startDate, endDate, selectedPhotoIds } = options;

  switch (mode) {
    case 'date-range':
      if (!startDate || !endDate) {
        return { valid: false, error: 'Start date and end date are required for date-range mode' };
      }
      if (startDate > endDate) {
        return { valid: false, error: 'Start date must be before end date' };
      }
      break;
      
    case 'selection':
      if (!selectedPhotoIds || selectedPhotoIds.length === 0) {
        return { valid: false, error: 'At least one photo must be selected' };
      }
      break;
  }

  return { valid: true };
}