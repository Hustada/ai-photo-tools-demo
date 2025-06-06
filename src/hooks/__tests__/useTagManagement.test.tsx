// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTagManagement } from '../useTagManagement'
import { companyCamService } from '../../services/companyCamService'
import type { Photo, Tag, CurrentUser } from '../../types'

// Mock companyCamService
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    listCompanyCamTags: vi.fn(),
    createCompanyCamTagDefinition: vi.fn(),
    addTagsToPhoto: vi.fn(),
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

// Mock fetch for AI enhancement persistence
global.fetch = vi.fn()

describe('useTagManagement', () => {
  const mockUser: CurrentUser = {
    id: 'user-123',
    company_id: 'company-456',
    email_address: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    status: 'active',
  }

  const mockTag1: Tag = {
    id: 'tag-1',
    company_id: 'company-1',
    display_value: 'Roofing',
    value: 'roofing',
    created_at: Date.now(),
    updated_at: Date.now(),
  }

  const mockTag2: Tag = {
    id: 'tag-2',
    company_id: 'company-1',
    display_value: 'Repair',
    value: 'repair',
    created_at: Date.now(),
    updated_at: Date.now(),
  }

  const mockPhoto1: Photo = {
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
    description: 'Test photo 1',
    internal: false,
    photo_url: 'https://example.com/photo1.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag1],
  }

  const mockPhoto2: Photo = {
    id: 'photo-2',
    company_id: 'company-1',
    creator_id: 'user-1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project-1',
    processing_status: 'processed',
    coordinates: [],
    uris: [],
    hash: 'test-hash-2',
    description: 'Test photo 2',
    internal: false,
    photo_url: 'https://example.com/photo2.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag2],
  }

  const mockPhotos = [mockPhoto1, mockPhoto2]

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('test-api-key')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response)
    vi.mocked(companyCamService.listCompanyCamTags).mockResolvedValue([mockTag1, mockTag2])
    vi.mocked(companyCamService.createCompanyCamTagDefinition).mockResolvedValue({
      id: 'new-tag-id',
      company_id: 'company-1',
      display_value: 'New Tag',
      value: 'new tag',
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    vi.mocked(companyCamService.addTagsToPhoto).mockResolvedValue()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.uniqueFilterableTags).toEqual([mockTag1, mockTag2])
      expect(result.current.filteredPhotos).toEqual(mockPhotos)
      expect(result.current.tagError).toBeNull()
      expect(result.current.isAddingTag).toBe(false)
      expect(typeof result.current.handleTagClick).toBe('function')
      expect(typeof result.current.handleAddTagRequest).toBe('function')
      expect(typeof result.current.clearAllFilters).toBe('function')
    })

    it('should compute unique filterable tags from photos', () => {
      const photosWithDuplicateTags = [
        { ...mockPhoto1, tags: [mockTag1, mockTag2] },
        { ...mockPhoto2, tags: [mockTag1] },
      ]
      
      const { result } = renderHook(() => useTagManagement(photosWithDuplicateTags, mockUser))

      expect(result.current.uniqueFilterableTags).toHaveLength(2)
      expect(result.current.uniqueFilterableTags).toContainEqual(mockTag1)
      expect(result.current.uniqueFilterableTags).toContainEqual(mockTag2)
    })

    it('should handle empty photos array', () => {
      const { result } = renderHook(() => useTagManagement([], mockUser))

      expect(result.current.uniqueFilterableTags).toEqual([])
      expect(result.current.filteredPhotos).toEqual([])
    })

    it('should handle photos without tags', () => {
      const photosWithoutTags = [
        { ...mockPhoto1, tags: [] },
        { ...mockPhoto2, tags: undefined },
      ]
      
      const { result } = renderHook(() => useTagManagement(photosWithoutTags, mockUser))

      expect(result.current.uniqueFilterableTags).toEqual([])
      expect(result.current.filteredPhotos).toEqual(photosWithoutTags)
    })
  })

  describe('Tag Filtering', () => {
    it('should toggle tag selection on handleTagClick', () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      // Select first tag
      act(() => {
        result.current.handleTagClick('tag-1')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1'])

      // Select second tag (multiple selection)
      act(() => {
        result.current.handleTagClick('tag-2')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1', 'tag-2'])

      // Deselect first tag
      act(() => {
        result.current.handleTagClick('tag-1')
      })

      expect(result.current.activeTagIds).toEqual(['tag-2'])
    })

    it('should filter photos based on active tag IDs', () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      // Filter by tag-1 (should show photo1)
      act(() => {
        result.current.handleTagClick('tag-1')
      })

      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-1')

      // Filter by tag-2 (should show photo2)
      act(() => {
        result.current.handleTagClick('tag-1') // deselect
        result.current.handleTagClick('tag-2') // select
      })

      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-2')
    })

    it('should use AND logic for multiple tag filters', () => {
      const photoWithBothTags = {
        ...mockPhoto1,
        tags: [mockTag1, mockTag2],
      }
      const photosForAndLogic = [photoWithBothTags, mockPhoto2]
      
      const { result } = renderHook(() => useTagManagement(photosForAndLogic, mockUser))

      // Select both tags
      act(() => {
        result.current.handleTagClick('tag-1')
        result.current.handleTagClick('tag-2')
      })

      // Should only show photo that has BOTH tags
      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-1')
    })

    it('should clear all filters', () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      // Select some tags
      act(() => {
        result.current.handleTagClick('tag-1')
        result.current.handleTagClick('tag-2')
      })

      expect(result.current.activeTagIds).toHaveLength(2)

      // Clear all filters
      act(() => {
        result.current.clearAllFilters()
      })

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.filteredPhotos).toEqual(mockPhotos)
    })

    it('should show all photos when no filters are active', () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      expect(result.current.filteredPhotos).toEqual(mockPhotos)
    })
  })

  describe('Tag Addition - Existing Tags', () => {
    it('should add existing tag to photo successfully', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Repair')
      })

      // Should find existing tag
      expect(companyCamService.listCompanyCamTags).toHaveBeenCalledWith('test-api-key')
      expect(companyCamService.createCompanyCamTagDefinition).not.toHaveBeenCalled()
      expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith('test-api-key', 'photo-1', ['tag-2'])

      // Should call photo update callback
      expect(onPhotoUpdate).toHaveBeenCalledWith(
        'photo-1',
        expect.objectContaining({
          id: 'tag-2',
          display_value: 'Repair',
          isAiEnhanced: false,
        }),
        false
      )
    })

    it('should add existing tag as AI-enhanced when requested', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Repair', true)
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        'photo-1',
        expect.objectContaining({
          id: 'tag-2',
          display_value: 'Repair',
          isAiEnhanced: true,
        }),
        true
      )

      // Should persist AI tag acceptance
      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'photo-1',
          userId: 'user-123',
          acceptedAiTags: ['Repair'],
        }),
      })
    })
  })

  describe('Tag Addition - New Tags', () => {
    it('should create and add new tag to photo', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'New Tag')
      })

      // Should create new tag
      expect(companyCamService.createCompanyCamTagDefinition).toHaveBeenCalledWith('test-api-key', 'New Tag')
      expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith('test-api-key', 'photo-1', ['new-tag-id'])

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        'photo-1',
        expect.objectContaining({
          id: 'new-tag-id',
          display_value: 'New Tag',
        }),
        false
      )
    })

    it('should create new AI-enhanced tag', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'AI New Tag', true)
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        'photo-1',
        expect.objectContaining({
          id: 'new-tag-id',
          display_value: 'New Tag', // Mock returns 'New Tag' regardless of input
          isAiEnhanced: true,
        }),
        true
      )

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'photo-1',
          userId: 'user-123',
          acceptedAiTags: ['AI New Tag'],
        }),
      })
    })

    it('should set loading state during tag addition', async () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      // Mock delayed response
      let resolveCompanyCamTags: (value: any) => void
      const companyCamTagsPromise = new Promise(resolve => {
        resolveCompanyCamTags = resolve
      })
      vi.mocked(companyCamService.listCompanyCamTags).mockReturnValue(companyCamTagsPromise)

      // Start tag addition
      let addTagPromise: Promise<void>
      act(() => {
        addTagPromise = result.current.handleAddTagRequest('photo-1', 'Test Tag')
      })

      // Should be loading
      expect(result.current.isAddingTag).toBe(true)

      // Complete the operation
      await act(async () => {
        resolveCompanyCamTags([mockTag1, mockTag2])
        await addTagPromise
      })

      // Should no longer be loading
      expect(result.current.isAddingTag).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing API key error', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Test Tag')
      })

      expect(result.current.tagError).toContain('API key')
      expect(result.current.isAddingTag).toBe(false)
    })

    it('should handle tag listing API error', async () => {
      vi.mocked(companyCamService.listCompanyCamTags).mockRejectedValue(new Error('API Error'))
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Test Tag')
      })

      expect(result.current.tagError).toContain('Failed to add tag')
      expect(result.current.isAddingTag).toBe(false)
    })

    it('should handle tag creation error', async () => {
      vi.mocked(companyCamService.createCompanyCamTagDefinition).mockRejectedValue(new Error('Creation failed'))
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'New Tag')
      })

      expect(result.current.tagError).toContain('Failed to add tag')
    })

    it('should handle tag addition to photo error', async () => {
      vi.mocked(companyCamService.addTagsToPhoto).mockRejectedValue(new Error('Addition failed'))
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Repair')
      })

      expect(result.current.tagError).toContain('Failed to add tag')
    })

    it('should handle AI enhancement persistence error gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as Response)

      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'AI Tag', true)
      })

      // Should still update photo even if persistence fails
      expect(onPhotoUpdate).toHaveBeenCalled()
      // Should not set tag error for persistence failure
      expect(result.current.tagError).toBeNull()
    })

    it('should clear error state on successful operation', async () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, mockUser))

      // Cause an error
      mockLocalStorage.getItem.mockReturnValue(null)
      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Test Tag')
      })
      expect(result.current.tagError).toBeTruthy()

      // Fix the issue and retry
      mockLocalStorage.getItem.mockReturnValue('test-api-key')
      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'Repair')
      })

      expect(result.current.tagError).toBeNull()
    })
  })

  describe('User Context Integration', () => {
    it('should handle missing user for AI tag persistence', async () => {
      const { result } = renderHook(() => useTagManagement(mockPhotos, null))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'AI Tag', true)
      })

      // Should not call AI enhancement API without user
      expect(fetch).not.toHaveBeenCalled()
      // Should still complete tag addition
      expect(result.current.tagError).toBeNull()
    })

    it('should use correct user ID for AI enhancement persistence', async () => {
      const customUser = { ...mockUser, id: 'custom-user-id' }
      const { result } = renderHook(() => useTagManagement(mockPhotos, customUser))

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'AI Tag', true)
      })

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'photo-1',
          userId: 'custom-user-id',
          acceptedAiTags: ['AI Tag'],
        }),
      })
    })
  })

  describe('Photos Update Integration', () => {
    it('should update filtered photos when photos prop changes', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => useTagManagement(photos, mockUser),
        { initialProps: { photos: [mockPhoto1] } }
      )

      expect(result.current.filteredPhotos).toHaveLength(1)

      // Update photos
      rerender({ photos: mockPhotos })

      expect(result.current.filteredPhotos).toHaveLength(2)
      expect(result.current.uniqueFilterableTags).toHaveLength(2)
    })

    it('should maintain filter state when photos update', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => useTagManagement(photos, mockUser),
        { initialProps: { photos: mockPhotos } }
      )

      // Set a filter
      act(() => {
        result.current.handleTagClick('tag-1')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1'])

      // Update photos (should maintain filter)
      const updatedPhotos = [...mockPhotos, { ...mockPhoto1, id: 'photo-3' }]
      rerender({ photos: updatedPhotos })

      expect(result.current.activeTagIds).toEqual(['tag-1'])
      expect(result.current.filteredPhotos.every(photo => 
        photo.tags?.some(tag => tag.id === 'tag-1')
      )).toBe(true)
    })
  })

  describe('Case Sensitivity', () => {
    it('should find existing tags case-insensitively', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'ROOFING') // uppercase
      })

      // Should find existing 'Roofing' tag
      expect(companyCamService.createCompanyCamTagDefinition).not.toHaveBeenCalled()
      expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith('test-api-key', 'photo-1', ['tag-1'])
    })

    it('should preserve display value case when adding existing tags', async () => {
      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useTagManagement(mockPhotos, mockUser, { onPhotoUpdate })
      )

      await act(async () => {
        await result.current.handleAddTagRequest('photo-1', 'roofing') // lowercase input
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        'photo-1',
        expect.objectContaining({
          display_value: 'Roofing', // should preserve original case
        }),
        false
      )
    })
  })
})