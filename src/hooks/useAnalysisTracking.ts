// © 2025 Mark Hustad — MIT License

import { useState, useCallback, useMemo } from 'react';
import type { Photo } from '../types';
import { companyCamService } from '../services/companyCamService';

export interface AnalysisStats {
  totalPhotos: number;
  analyzedPhotos: number;
  newPhotos: number;
  lastAnalysisDate: Date | null;
  neverAnalyzedCount: number;
}

export interface AnalysisTrackingOptions {
  defaultNewPhotoDays?: number; // Default days to consider "new" photos
}

/**
 * Hook for tracking photo analysis state and smart filtering
 */
export const useAnalysisTracking = (options: AnalysisTrackingOptions = {}) => {
  const { defaultNewPhotoDays = 7 } = options;
  
  const [isMarkingAnalyzed, setIsMarkingAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get photos that should be considered "new" for analysis
   */
  const getNewPhotos = useCallback((photos: Photo[], daysSince: number = defaultNewPhotoDays): Photo[] => {
    const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);
    
    return photos.filter(photo => {
      // Photo is new if:
      // 1. Never analyzed, OR
      // 2. Captured after last analysis, OR  
      // 3. Analysis is older than cutoff date
      
      if (!photo.scout_ai_analyzed_at) {
        return true; // Never analyzed
      }
      
      // Convert Unix timestamp to Date (captured_at is in seconds, need milliseconds)
      const capturedAt = new Date(photo.captured_at * 1000);
      const analyzedAt = new Date(photo.scout_ai_analyzed_at);
      
      // If photo was captured after it was analyzed, it's "new"
      if (capturedAt > analyzedAt) {
        return true;
      }
      
      // If analysis is older than cutoff, consider it stale
      return analyzedAt < cutoffDate;
    });
  }, [defaultNewPhotoDays]);

  /**
   * Get photos within a specific date range
   */
  const getPhotosInDateRange = useCallback((
    photos: Photo[], 
    startDate: Date, 
    endDate: Date
  ): Photo[] => {
    return photos.filter(photo => {
      // Convert Unix timestamp to Date (captured_at is in seconds, need milliseconds)
      const capturedAt = new Date(photo.captured_at * 1000);
      return capturedAt >= startDate && capturedAt <= endDate;
    });
  }, []);

  /**
   * Get analysis statistics for a collection of photos
   */
  const getAnalysisStats = useMemo(() => 
    (photos: Photo[]): AnalysisStats => {
      const analyzedPhotos = photos.filter(p => p.scout_ai_analyzed_at);
      const newPhotos = getNewPhotos(photos);
      const neverAnalyzedPhotos = photos.filter(p => !p.scout_ai_analyzed_at);
      
      let lastAnalysisDate: Date | null = null;
      if (analyzedPhotos.length > 0) {
        const timestamps = analyzedPhotos
          .map(p => new Date(p.scout_ai_analyzed_at!).getTime())
          .filter(t => !isNaN(t));
        
        if (timestamps.length > 0) {
          lastAnalysisDate = new Date(Math.max(...timestamps));
        }
      }

      return {
        totalPhotos: photos.length,
        analyzedPhotos: analyzedPhotos.length,
        newPhotos: newPhotos.length,
        lastAnalysisDate,
        neverAnalyzedCount: neverAnalyzedPhotos.length
      };
    }, [getNewPhotos]);

  /**
   * Mark a single photo as analyzed
   */
  const markPhotoAnalyzed = useCallback(async (
    photoId: string,
    userAction?: 'kept' | 'archived' | 'pending' | null
  ): Promise<boolean> => {
    try {
      setError(null);
      const result = await companyCamService.markPhotoAnalyzed(photoId, userAction);
      
      if (!result.success) {
        setError(result.error || 'Failed to mark photo as analyzed');
        return false;
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useAnalysisTracking] Error marking photo as analyzed:', err);
      return false;
    }
  }, []);

  /**
   * Mark multiple photos as analyzed in batch
   */
  const markPhotosAnalyzed = useCallback(async (
    photoIds: string[],
    userActions?: Record<string, 'kept' | 'archived' | 'pending' | null>
  ): Promise<{ success: boolean; successCount: number; failCount: number }> => {
    if (photoIds.length === 0) {
      return { success: true, successCount: 0, failCount: 0 };
    }

    setIsMarkingAnalyzed(true);
    setError(null);

    try {
      console.log('[useAnalysisTracking] Marking', photoIds.length, 'photos as analyzed');
      
      const result = await companyCamService.markPhotosAnalyzed(photoIds, userActions);
      
      if (!result.success) {
        setError(result.error || 'Failed to mark photos as analyzed');
        return { success: false, successCount: 0, failCount: photoIds.length };
      }

      const successCount = result.results?.filter(r => r.success).length || 0;
      const failCount = photoIds.length - successCount;

      console.log('[useAnalysisTracking] Batch analysis marking complete:', {
        total: photoIds.length,
        successful: successCount,
        failed: failCount
      });

      if (failCount > 0) {
        setError(`${failCount} photos failed to update`);
      }

      return { success: successCount > 0, successCount, failCount };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useAnalysisTracking] Error in batch marking:', err);
      return { success: false, successCount: 0, failCount: photoIds.length };
    } finally {
      setIsMarkingAnalyzed(false);
    }
  }, []);

  /**
   * Check if analysis should be suggested for new photos
   */
  const shouldSuggestAnalysis = useCallback((photos: Photo[], daysSince: number = defaultNewPhotoDays): boolean => {
    const newPhotos = getNewPhotos(photos, daysSince);
    return newPhotos.length > 0; // Suggest if there are any new photos
  }, [getNewPhotos, defaultNewPhotoDays]);

  /**
   * Get a user-friendly description of analysis status
   */
  const getAnalysisStatusMessage = useCallback((photos: Photo[]): string => {
    const stats = getAnalysisStats(photos);
    
    if (stats.totalPhotos === 0) {
      return 'No photos to analyze';
    }
    
    if (stats.neverAnalyzedCount === stats.totalPhotos) {
      return `${stats.totalPhotos} photos have never been analyzed`;
    }
    
    if (stats.newPhotos === 0) {
      const lastAnalysis = stats.lastAnalysisDate 
        ? formatRelativeTime(stats.lastAnalysisDate)
        : 'unknown time';
      return `All photos analyzed (last analysis: ${lastAnalysis})`;
    }
    
    return `${stats.newPhotos} new photos since last analysis`;
  }, [getAnalysisStats]);

  return {
    // Analysis filtering
    getNewPhotos,
    getPhotosInDateRange,
    
    // Statistics
    getAnalysisStats,
    shouldSuggestAnalysis,
    getAnalysisStatusMessage,
    
    // Tracking actions
    markPhotoAnalyzed,
    markPhotosAnalyzed,
    
    // State
    isMarkingAnalyzed,
    error,
    
    // Utilities
    defaultNewPhotoDays
  };
};

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}