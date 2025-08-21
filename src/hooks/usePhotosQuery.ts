// © 2025 Mark Hustad — MIT License

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { photoQueryKeys, fetchPhotosWithEnhancements } from '../lib/queries/photoQueries';
import { persistentCache } from '../utils/persistentCache';
import type { Photo } from '../types';

interface UsePhotosQueryOptions {
  page?: number;
  perPage?: number;
  tagIds?: string[];
  enabled?: boolean;
}

interface UsePhotosQueryReturn {
  // Data
  photos: Photo[];
  allPhotos: Photo[]; // All photos across all pages
  
  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  
  // Error state
  error: Error | null;
  
  // Pagination
  currentPage: number;
  hasMorePhotos: boolean;
  
  // Actions
  loadMore: () => void;
  refresh: () => void;
  updatePhotoInCache: (photo: Photo) => void;
  setPage: (page: number) => void;
}

export const usePhotosQuery = (options: UsePhotosQueryOptions = {}): UsePhotosQueryReturn => {
  const {
    page: initialPage = 1,
    perPage = 20,
    tagIds = [],
    enabled = true
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [allFetchedPhotos, setAllFetchedPhotos] = useState<Photo[]>([]);
  
  const queryClient = useQueryClient();
  
  // Get API key from localStorage
  const apiKey = localStorage.getItem('companyCamApiKey');
  
  // Current page query
  const {
    data: currentPagePhotos = [],
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: photoQueryKeys.list(currentPage, { tagIds }),
    queryFn: () => {
      if (!apiKey) {
        throw new Error('Please enter an API Key.');
      }
      return fetchPhotosWithEnhancements(apiKey, currentPage, perPage, tagIds.length > 0 ? tagIds : undefined, false);
    },
    enabled: enabled && !!apiKey,
    staleTime: 30 * 60 * 1000, // 30 minutes - photos don't change frequently
    gcTime: 60 * 60 * 1000, // 1 hour - keep in memory longer
    refetchOnWindowFocus: false, // Don't refetch when user comes back to tab
    refetchOnMount: false, // Don't refetch on component mount if data exists
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error (401/403)
      if (error && 'status' in error) {
        const status = (error as any).status;
        if (status === 401 || status === 403) {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  // Optimistically determine if there are more photos
  const hasMorePhotos = useMemo(() => {
    return currentPagePhotos.length === perPage;
  }, [currentPagePhotos.length, perPage]);

  // Check if we're loading more (not the initial load)
  const isLoadingMore = useMemo(() => {
    return isFetching && currentPage > 1 && allFetchedPhotos.length > 0;
  }, [isFetching, currentPage, allFetchedPhotos.length]);

  // Update allFetchedPhotos when we get new data
  useMemo(() => {
    if (currentPagePhotos.length > 0) {
      setAllFetchedPhotos(prevPhotos => {
        // Apply archived states from localStorage
        const archivedPhotoIds = JSON.parse(localStorage.getItem('archivedPhotos') || '[]');
        
        const photosWithArchiveState = currentPagePhotos.map(photo => {
          if (archivedPhotoIds.includes(photo.id)) {
            return {
              ...photo,
              archive_state: 'archived' as const,
              archived_at: Date.now(),
              archive_reason: 'User archived for testing'
            };
          }
          return photo;
        });

        if (currentPage === 1) {
          // First page or refresh - replace all photos
          return photosWithArchiveState;
        } else {
          // Additional page - append new photos, avoiding duplicates
          const existingIds = new Set(prevPhotos.map(p => p.id));
          const newPhotos = photosWithArchiveState.filter(p => !existingIds.has(p.id));
          return [...prevPhotos, ...newPhotos];
        }
      });
    }
  }, [currentPagePhotos, currentPage]);

  // Filter photos based on tagIds (client-side filtering for now)
  const filteredPhotos = useMemo(() => {
    if (tagIds.length === 0) {
      return allFetchedPhotos;
    }
    
    return allFetchedPhotos.filter(photo =>
      tagIds.every(filterTagId =>
        photo.tags?.some(photoTag => photoTag.id === filterTagId)
      )
    );
  }, [allFetchedPhotos, tagIds]);

  // Actions
  const loadMore = useCallback(() => {
    if (hasMorePhotos && !isFetching) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMorePhotos, isFetching]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    setAllFetchedPhotos([]);
    // Clear persistent cache to force fresh API calls
    persistentCache.clearPhotos();
    // Clear React Query cache
    queryClient.setQueryData(
      photoQueryKeys.list(1, { tagIds }),
      undefined
    );
    // Invalidate all photo queries to force fresh data
    queryClient.invalidateQueries({
      queryKey: photoQueryKeys.lists(),
      exact: false
    });
    // Manually call the query function with forceRefresh=true
    if (apiKey) {
      fetchPhotosWithEnhancements(apiKey, 1, perPage, tagIds.length > 0 ? tagIds : undefined, true)
        .then((freshPhotos) => {
          queryClient.setQueryData(
            photoQueryKeys.list(1, { tagIds }),
            freshPhotos
          );
        });
    }
  }, [queryClient, apiKey, perPage, tagIds]);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
    if (page === 1) {
      setAllFetchedPhotos([]);
    }
  }, []);

  // Optimistic update for photo modifications
  const updatePhotoInCache = useCallback((updatedPhoto: Photo) => {
    console.log(`[usePhotosQuery] updatePhotoInCache called for photo ${updatedPhoto.id}`)
    console.log(`[usePhotosQuery] Updated photo data:`, updatedPhoto)
    
    // Save archive state to localStorage for persistence across refresh
    if (updatedPhoto.archive_state === 'archived') {
      const archivedPhotos = JSON.parse(localStorage.getItem('archivedPhotos') || '[]');
      if (!archivedPhotos.includes(updatedPhoto.id)) {
        archivedPhotos.push(updatedPhoto.id);
        localStorage.setItem('archivedPhotos', JSON.stringify(archivedPhotos));
      }
    } else {
      // Remove from archived list if unarchived
      const archivedPhotos = JSON.parse(localStorage.getItem('archivedPhotos') || '[]');
      const filteredArchived = archivedPhotos.filter((id: string) => id !== updatedPhoto.id);
      localStorage.setItem('archivedPhotos', JSON.stringify(filteredArchived));
    }

    // Update the query cache for current page
    console.log(`[usePhotosQuery] Updating React Query cache for page ${currentPage}`)
    queryClient.setQueryData(
      photoQueryKeys.list(currentPage, { tagIds }),
      (oldData: Photo[] | undefined) => {
        if (!oldData) {
          console.log(`[usePhotosQuery] No oldData in cache for page ${currentPage}`)
          return oldData;
        }
        console.log(`[usePhotosQuery] Found ${oldData.length} photos in cache, updating photo ${updatedPhoto.id}`)
        return oldData.map(photo => 
          photo.id === updatedPhoto.id ? { ...updatedPhoto } : photo
        );
      }
    );

    // Update local state with new object reference to force re-render
    console.log(`[usePhotosQuery] Updating local state (allFetchedPhotos)`)
    setAllFetchedPhotos(prevPhotos => {
      console.log(`[usePhotosQuery] Current allFetchedPhotos has ${prevPhotos.length} photos`)
      const updated = prevPhotos.map(photo => 
        photo.id === updatedPhoto.id ? { ...updatedPhoto } : photo
      );
      console.log(`[usePhotosQuery] Updated allFetchedPhotos, photo ${updatedPhoto.id} now has ${updatedPhoto.tags?.length || 0} tags`)
      
      // Also update the persistent cache to keep it in sync
      const cachedPhotos = persistentCache.getPhotos();
      if (cachedPhotos.photos.length > 0) {
        const updatedCachedPhotos = cachedPhotos.photos.map(photo => 
          photo.id === updatedPhoto.id ? { ...updatedPhoto } : photo
        );
        persistentCache.savePhotos(updatedCachedPhotos, cachedPhotos.page || 1);
        console.log(`[usePhotosQuery] Updated persistent cache for photo ${updatedPhoto.id}`);
      }
      
      return updated;
    });

    // Don't invalidate queries - this causes a refetch with stale data
    // The local state update above is sufficient for UI updates
    console.log(`[usePhotosQuery] Skipping query invalidation to prevent stale data refetch`);
  }, [queryClient, currentPage, tagIds]);

  return {
    photos: filteredPhotos,
    allPhotos: allFetchedPhotos,
    isLoading: isLoading && currentPage === 1, // Only show loading for first page
    isFetching,
    isLoadingMore,
    error: error as Error | null,
    currentPage,
    hasMorePhotos,
    loadMore,
    refresh,
    updatePhotoInCache,
    setPage,
  };
};

// Hook for prefetching next page
export const usePrefetchNextPage = (currentPage: number, tagIds: string[] = []) => {
  const queryClient = useQueryClient();
  const apiKey = localStorage.getItem('companyCamApiKey');

  const prefetchNextPage = useCallback(() => {
    if (!apiKey) return;

    const nextPage = currentPage + 1;
    queryClient.prefetchQuery({
      queryKey: photoQueryKeys.list(nextPage, { tagIds }),
      queryFn: () => fetchPhotosWithEnhancements(apiKey, nextPage, 20, tagIds.length > 0 ? tagIds : undefined),
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient, apiKey, currentPage, tagIds]);

  return { prefetchNextPage };
};