// © 2025 Mark Hustad — MIT License

import type { Photo } from '../types';

interface CachedData {
  photos: Photo[];
  timestamp: number;
  page: number;
  totalCached: number;
}

const CACHE_KEY = 'scout-ai-photos-cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const persistentCache = {
  /**
   * Save photos to localStorage with timestamp
   */
  savePhotos: (photos: Photo[], page: number = 1): void => {
    try {
      const existing = persistentCache.getPhotos();
      const allPhotos = page === 1 ? photos : [...existing.photos, ...photos];
      
      const cacheData: CachedData = {
        photos: allPhotos,
        timestamp: Date.now(),
        page,
        totalCached: allPhotos.length
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log(`[PersistentCache] Saved ${allPhotos.length} photos to localStorage`);
    } catch (error) {
      console.warn('[PersistentCache] Failed to save to localStorage:', error);
    }
  },

  /**
   * Get photos from localStorage if not expired
   */
  getPhotos: (): CachedData => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) {
        return { photos: [], timestamp: 0, page: 0, totalCached: 0 };
      }

      const cacheData: CachedData = JSON.parse(cached);
      
      // Check if cache is expired
      if (Date.now() - cacheData.timestamp > CACHE_DURATION) {
        console.log('[PersistentCache] Cache expired, clearing...');
        persistentCache.clearPhotos();
        return { photos: [], timestamp: 0, page: 0, totalCached: 0 };
      }

      console.log(`[PersistentCache] Retrieved ${cacheData.photos.length} photos from localStorage`);
      return cacheData;
    } catch (error) {
      console.warn('[PersistentCache] Failed to read from localStorage:', error);
      return { photos: [], timestamp: 0, page: 0, totalCached: 0 };
    }
  },

  /**
   * Check if we have fresh cached data
   */
  hasFreshData: (): boolean => {
    const cached = persistentCache.getPhotos();
    return cached.photos.length > 0 && cached.timestamp > 0;
  },

  /**
   * Clear cached photos
   */
  clearPhotos: (): void => {
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log('[PersistentCache] Cleared photo cache');
    } catch (error) {
      console.warn('[PersistentCache] Failed to clear cache:', error);
    }
  },

  /**
   * Get cache info for debugging
   */
  getCacheInfo: () => {
    const cached = persistentCache.getPhotos();
    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
    const ageInMinutes = Math.round((Date.now() - cached.timestamp) / (1000 * 60));
    
    return {
      totalPhotos: cached.totalCached,
      cacheAge: `${ageInMinutes} minutes`,
      isExpired,
      lastCached: cached.timestamp ? new Date(cached.timestamp).toLocaleString() : 'Never'
    };
  }
};