// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePhotoData } from '../usePhotoData'
import { companyCamService } from '../../services/companyCamService'
import type { Photo, Tag } from '../../types'

// Mock companyCamService
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    getPhotos: vi.fn(),
    getPhotoTags: vi.fn(),
  },
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock fetch for AI enhancements
global.fetch = vi.fn()

describe('usePhotoData', () => {
  const mockPhoto: Photo = {
    id: 'photo-1',
    company_id: 'company-1',
    creator_id: 'user-1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project-1',
    processing_status: 'processed',
    coordinates: [],
    uris: [],
    hash: 'test-hash',
    description: 'Test photo',
    internal: false,
    photo_url: 'https://example.com/photo1.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
  }

  const mockTag: Tag = {
    id: 'tag-1',
    company_id: 'company-1',
    display_value: 'Test Tag',
    value: 'test tag',
    created_at: Date.now(),
    updated_at: Date.now(),
  }

  const mockApiEnhancement = {
    photo_id: 'photo-1',
    user_id: 'user-1',
    ai_description: 'AI enhanced description',
    accepted_ai_tags: ['ai-tag-1', 'ai-tag-2'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    suggestion_source: 'openai',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('test-api-key')
    vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto])
    vi.mocked(companyCamService.getPhotoTags).mockResolvedValue([mockTag])
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockApiEnhancement),
      text: () => Promise.resolve(''),
    } as Response)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePhotoData())

      expect(result.current.photos).toEqual([])
      expect(result.current.allFetchedPhotos).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.currentPage).toBe(0)
      expect(result.current.hasMorePhotos).toBe(true)
    })

    it('should provide all expected functions', () => {
      const { result } = renderHook(() => usePhotoData())

      expect(typeof result.current.fetchPhotos).toBe('function')
      expect(typeof result.current.loadMore).toBe('function')
      expect(typeof result.current.refreshPhotos).toBe('function')
      expect(typeof result.current.applyFilters).toBe('function')
      expect(typeof result.current.updatePhotoInCache).toBe('function')
    })
  })

  describe('Photo Fetching', () => {
    it('should fetch photos successfully on first load', async () => {
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(companyCamService.getPhotos).toHaveBeenCalledWith('test-api-key', 1, 20)
      expect(companyCamService.getPhotoTags).toHaveBeenCalledWith('test-api-key', 'photo-1')
      expect(result.current.allFetchedPhotos).toHaveLength(1)
      expect(result.current.photos).toHaveLength(1)
      expect(result.current.currentPage).toBe(1)
    })

    it('should set loading state during fetch', async () => {
      const { result } = renderHook(() => usePhotoData())

      // Start the fetch without awaiting immediately
      let fetchPromise: Promise<void>
      act(() => {
        fetchPromise = result.current.fetchPhotos(1)
      })

      // Check loading state
      expect(result.current.isLoading).toBe(true)

      // Wait for fetch to complete
      await act(async () => {
        await fetchPromise
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle API key missing', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      expect(result.current.error).toBe('Please enter an API Key.')
      expect(result.current.isLoading).toBe(false)
      expect(companyCamService.getPhotos).not.toHaveBeenCalled()
    })

    it('should handle companyCamService.getPhotos error', async () => {
      const errorMessage = 'API request failed'
      vi.mocked(companyCamService.getPhotos).mockRejectedValue(new Error(errorMessage))
      
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage)
      })
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle companyCamService.getPhotoTags error', async () => {
      vi.mocked(companyCamService.getPhotoTags).mockRejectedValue(new Error('Tags fetch failed'))
      
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Tags fetch failed')
      })
    })
  })

  describe('AI Enhancements Integration', () => {
    it('should fetch and apply AI enhancements successfully', async () => {
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements?photoId=photo-1')
      
      const photo = result.current.allFetchedPhotos[0]
      expect(photo.description).toBe('AI enhanced description')
      expect(photo.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            display_value: 'Test Tag',
            isAiEnhanced: false,
          }),
          expect.objectContaining({
            display_value: 'ai-tag-1',
            isAiEnhanced: true,
          }),
          expect.objectContaining({
            display_value: 'ai-tag-2',
            isAiEnhanced: true,
          }),
        ])
      )
    })

    it('should handle 404 response for AI enhancements gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('Not found'),
      } as Response)

      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const photo = result.current.allFetchedPhotos[0]
      expect(photo.description).toBe('Test photo') // Original description
      expect(photo.tags).toHaveLength(1) // Only original tag
    })

    it('should handle AI enhancement fetch errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should still process the photo without AI enhancements
      expect(result.current.allFetchedPhotos).toHaveLength(1)
    })
  })

  describe('Pagination', () => {
    it('should handle pagination correctly', async () => {
      const secondPhoto = { ...mockPhoto, id: 'photo-2' }
      vi.mocked(companyCamService.getPhotos)
        .mockResolvedValueOnce([mockPhoto])
        .mockResolvedValueOnce([secondPhoto])

      const { result } = renderHook(() => usePhotoData())

      // First page
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      // Second page
      await act(async () => {
        await result.current.fetchPhotos(2)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(2)
      })

      expect(result.current.currentPage).toBe(2)
    })

    it('should replace photos when fetching page 1', async () => {
      const { result } = renderHook(() => usePhotoData())

      // First load
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      // Fetch page 1 again (refresh)
      const newPhoto = { ...mockPhoto, id: 'photo-new' }
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([newPhoto])

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      expect(result.current.allFetchedPhotos[0].id).toBe('photo-new')
    })

    it('should set hasMorePhotos to false when fewer than 20 photos returned', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto]) // Only 1 photo

      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.hasMorePhotos).toBe(false)
      })
    })

    it('should provide loadMore convenience function', async () => {
      const { result } = renderHook(() => usePhotoData())

      // Set up initial state
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.currentPage).toBe(1)
      })

      // Mock second page with 20 photos to ensure hasMorePhotos is true
      const secondPhoto = { ...mockPhoto, id: 'photo-2' }
      // First call should return 20 photos to set hasMorePhotos = true
      vi.mocked(companyCamService.getPhotos).mockResolvedValueOnce(Array(20).fill(mockPhoto).map((p, i) => ({ ...p, id: `photo-${i + 1}` })))
      
      // Re-fetch first page to ensure hasMorePhotos = true
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.hasMorePhotos).toBe(true)
      })

      // Now mock the second page
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([secondPhoto])

      await act(async () => {
        await result.current.loadMore()
      })

      await waitFor(() => {
        expect(result.current.currentPage).toBe(2)
      })

      expect(companyCamService.getPhotos).toHaveBeenLastCalledWith('test-api-key', 2, 20)
    })
  })

  describe('Filtering', () => {
    it('should filter photos by tag IDs', async () => {
      const photoWithTag = { ...mockPhoto, id: 'photo-1' }
      const photoWithoutTag = { ...mockPhoto, id: 'photo-2', tags: [] }
      
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([photoWithTag, photoWithoutTag])
      vi.mocked(companyCamService.getPhotoTags)
        .mockResolvedValueOnce([mockTag])
        .mockResolvedValueOnce([])

      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(2)
      })

      // Apply filter
      act(() => {
        result.current.applyFilters(['tag-1'])
      })

      expect(result.current.photos).toHaveLength(1)
      expect(result.current.photos[0].id).toBe('photo-1')
    })

    it('should show all photos when no filters applied', async () => {
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      act(() => {
        result.current.applyFilters([])
      })

      expect(result.current.photos).toEqual(result.current.allFetchedPhotos)
    })

    it('should handle AND logic for multiple tag filters', async () => {
      const tag2 = { ...mockTag, id: 'tag-2', display_value: 'Tag 2' }
      const photoWithBothTags = { ...mockPhoto, id: 'photo-1' }
      const photoWithOneTag = { ...mockPhoto, id: 'photo-2' }
      
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([photoWithBothTags, photoWithOneTag])
      vi.mocked(companyCamService.getPhotoTags)
        .mockResolvedValueOnce([mockTag, tag2])
        .mockResolvedValueOnce([mockTag])

      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters(['tag-1', 'tag-2'])
      })

      expect(result.current.photos).toHaveLength(1)
      expect(result.current.photos[0].id).toBe('photo-1')
    })
  })

  describe('Photo Cache Updates', () => {
    it('should update specific photo in cache', async () => {
      const { result } = renderHook(() => usePhotoData())

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      const updatedPhoto = { ...mockPhoto, description: 'Updated description' }

      act(() => {
        result.current.updatePhotoInCache(updatedPhoto)
      })

      expect(result.current.allFetchedPhotos[0].description).toBe('Updated description')
    })

    it('should handle updatePhotoInCache for non-existent photo', async () => {
      const { result } = renderHook(() => usePhotoData())

      const nonExistentPhoto = { ...mockPhoto, id: 'non-existent' }

      act(() => {
        result.current.updatePhotoInCache(nonExistentPhoto)
      })

      // Should not crash and should not affect state
      expect(result.current.allFetchedPhotos).toHaveLength(0)
    })
  })

  describe('Refresh Functionality', () => {
    it('should refresh photos (fetch page 1)', async () => {
      const { result } = renderHook(() => usePhotoData())

      // Initial load
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      // Mock refresh data
      const refreshedPhoto = { ...mockPhoto, id: 'refreshed-photo' }
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([refreshedPhoto])

      await act(async () => {
        await result.current.refreshPhotos()
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos[0].id).toBe('refreshed-photo')
      })

      expect(companyCamService.getPhotos).toHaveBeenCalledWith('test-api-key', 1, 20)
    })
  })

  describe('Error Recovery', () => {
    it('should clear error on successful fetch after error', async () => {
      vi.mocked(companyCamService.getPhotos).mockRejectedValueOnce(new Error('Network error'))
      
      const { result } = renderHook(() => usePhotoData())

      // First fetch fails
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })

      // Second fetch succeeds
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto])

      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('Duplicate Photo Handling', () => {
    it('should prevent duplicate photos when paginating', async () => {
      const { result } = renderHook(() => usePhotoData())

      // First page
      await act(async () => {
        await result.current.fetchPhotos(1)
      })

      await waitFor(() => {
        expect(result.current.allFetchedPhotos).toHaveLength(1)
      })

      // Second page returns same photo (duplicate)
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto])

      await act(async () => {
        await result.current.fetchPhotos(2)
      })

      await waitFor(() => {
        expect(result.current.currentPage).toBe(2)
      })

      // Should still only have 1 photo
      expect(result.current.allFetchedPhotos).toHaveLength(1)
    })
  })
})