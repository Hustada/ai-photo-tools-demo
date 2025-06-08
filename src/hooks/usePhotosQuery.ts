// © 2025 Mark Hustad — MIT License

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { photoQueryKeys, fetchPhotosWithEnhancements } from '../lib/queries/photoQueries';
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
      return fetchPhotosWithEnhancements(apiKey, currentPage, perPage, tagIds.length > 0 ? tagIds : undefined);
    },
    enabled: enabled && !!apiKey,
    staleTime: 2 * 60 * 1000, // 2 minutes - photos don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
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
        if (currentPage === 1) {
          // First page or refresh - replace all photos
          return currentPagePhotos;
        } else {
          // Additional page - append new photos, avoiding duplicates
          const existingIds = new Set(prevPhotos.map(p => p.id));
          const newPhotos = currentPagePhotos.filter(p => !existingIds.has(p.id));
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
    refetch();
  }, [refetch]);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
    if (page === 1) {
      setAllFetchedPhotos([]);
    }
  }, []);

  // Optimistic update for photo modifications
  const updatePhotoInCache = useCallback((updatedPhoto: Photo) => {
    // Update the query cache
    queryClient.setQueryData(
      photoQueryKeys.list(currentPage, { tagIds }),
      (oldData: Photo[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(photo => 
          photo.id === updatedPhoto.id ? updatedPhoto : photo
        );
      }
    );

    // Update local state
    setAllFetchedPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === updatedPhoto.id ? updatedPhoto : photo
      )
    );

    // Invalidate related queries to ensure consistency
    queryClient.invalidateQueries({
      queryKey: photoQueryKeys.lists(),
      exact: false
    });
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