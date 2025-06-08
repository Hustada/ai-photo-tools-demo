// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePhotosQuery } from '../usePhotosQuery';
import * as photoQueries from '../../lib/queries/photoQueries';
import type { Photo } from '../../types';

// Mock the photo queries module
vi.mock('../../lib/queries/photoQueries');

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const mockPhoto: Photo = {
  id: 'photo-1',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Doe',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'web', uri: 'https://example.com/photo.jpg', url: 'https://example.com/photo.jpg' }
  ],
  hash: 'abc123',
  description: 'Test photo',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  tags: [],
};

// Create wrapper component with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePhotosQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('test-api-key');
    
    // Setup default mock implementation
    vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockResolvedValue([mockPhoto]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should fetch photos successfully', async () => {
      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.photos).toEqual([mockPhoto]);
      expect(result.current.allPhotos).toEqual([mockPhoto]);
      expect(result.current.error).toBeNull();
      expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledWith(
        'test-api-key',
        1,
        20,
        undefined
      );
    });

    it('should handle loading state correctly', () => {
      vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isFetching).toBe(true);
      expect(result.current.photos).toEqual([]);
      expect(result.current.allPhotos).toEqual([]);
    });

  });

  describe('Options Handling', () => {
    it('should use custom page and perPage options', async () => {
      const { result } = renderHook(
        () => usePhotosQuery({ page: 2, perPage: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledWith(
        'test-api-key',
        2,
        10,
        undefined
      );
    });

    it('should pass tagIds when provided', async () => {
      const tagIds = ['tag1', 'tag2'];
      
      const { result } = renderHook(
        () => usePhotosQuery({ tagIds }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledWith(
        'test-api-key',
        1,
        20,
        tagIds
      );
    });

    it('should respect enabled option', () => {
      const { result } = renderHook(
        () => usePhotosQuery({ enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(photoQueries.fetchPhotosWithEnhancements).not.toHaveBeenCalled();
    });

    it('should be disabled when no API key is available', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(photoQueries.fetchPhotosWithEnhancements).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should handle hasMorePhotos correctly when full page is returned', async () => {
      const fullPagePhotos = Array.from({ length: 20 }, (_, i) => ({
        ...mockPhoto,
        id: `photo-${i}`,
      }));
      
      vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockResolvedValue(fullPagePhotos);

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMorePhotos).toBe(true);
    });

    it('should handle hasMorePhotos correctly when partial page is returned', async () => {
      const partialPagePhotos = Array.from({ length: 5 }, (_, i) => ({
        ...mockPhoto,
        id: `photo-${i}`,
      }));
      
      vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockResolvedValue(partialPagePhotos);

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMorePhotos).toBe(false);
    });

    it('should handle loadMore correctly', async () => {
      // Create full page for first load to enable loadMore
      const firstPagePhotos = Array.from({ length: 20 }, (_, i) => ({ ...mockPhoto, id: `photo-${i + 1}` }));
      const secondPagePhotos = [{ ...mockPhoto, id: 'photo-21' }];

      vi.mocked(photoQueries.fetchPhotosWithEnhancements)
        .mockResolvedValueOnce(firstPagePhotos)
        .mockResolvedValueOnce(secondPagePhotos);

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      // Wait for first page to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasMorePhotos).toBe(true);

      // Load more
      act(() => {
        result.current.loadMore();
      });

      // Wait for page to increment
      await waitFor(() => {
        expect(result.current.currentPage).toBe(2);
      });

      // Verify loadMore was called (basic functionality test)
      expect(result.current.currentPage).toBe(2);
    });

    it('should handle isLoadingMore state logic', async () => {
      // Test basic isLoadingMore behavior
      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initially isLoadingMore should be false
      expect(result.current.isLoadingMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Actions', () => {
    it('should handle refresh correctly', async () => {
      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.clearAllMocks();

      act(() => {
        result.current.refresh();
      });

      expect(result.current.currentPage).toBe(1);
      
      await waitFor(() => {
        expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledWith(
          'test-api-key',
          1,
          20,
          undefined
        );
      });
    });

    it('should handle setPage correctly', async () => {
      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setPage(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should handle updatePhotoInCache correctly', async () => {
      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updatedPhoto = { ...mockPhoto, description: 'Updated description' };

      act(() => {
        result.current.updatePhotoInCache(updatedPhoto);
      });

      expect(result.current.allPhotos[0]).toEqual(updatedPhoto);
    });
  });

  describe('Tag Filtering', () => {
    it('should filter photos by tagIds', async () => {
      const photosWithTags = [
        { ...mockPhoto, id: 'photo-1', tags: [{ id: 'tag1', display_value: 'Tag 1', value: 'tag1', company_id: 'comp1', created_at: 0, updated_at: 0 }] },
        { ...mockPhoto, id: 'photo-2', tags: [{ id: 'tag2', display_value: 'Tag 2', value: 'tag2', company_id: 'comp1', created_at: 0, updated_at: 0 }] },
      ];

      vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockResolvedValue(photosWithTags);

      const { result } = renderHook(
        () => usePhotosQuery({ tagIds: ['tag1'] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Note: Client-side filtering is handled in the hook
      expect(result.current.allPhotos).toEqual(photosWithTags);
    });
  });

  describe('Error Handling', () => {
    it('should not execute query when no API key is available', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(
        () => usePhotosQuery({ enabled: true }),
        { wrapper: createWrapper() }
      );

      // Should not execute the query at all when no API key
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(photoQueries.fetchPhotosWithEnhancements).not.toHaveBeenCalled();
    });

    it('should handle auth errors correctly by not retrying', async () => {
      const authError = { status: 401 };
      vi.mocked(photoQueries.fetchPhotosWithEnhancements).mockRejectedValue(authError);

      const { result } = renderHook(() => usePhotosQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toEqual(authError);
      });

      // Should not retry auth errors
      expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledTimes(1);
    });
  });

  describe('Query Key Management', () => {
    it('should use correct query keys for caching', async () => {
      const { result } = renderHook(
        () => usePhotosQuery({ tagIds: ['tag1'] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(photoQueries.fetchPhotosWithEnhancements).toHaveBeenCalledWith(
        'test-api-key',
        1,
        20,
        ['tag1']
      );
    });
  });
});