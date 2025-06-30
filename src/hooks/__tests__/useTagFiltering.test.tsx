// © 2025 Mark Hustad — MIT License
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTagFiltering } from '../useTagFiltering'
import type { Photo, Tag } from '../../types'

describe('useTagFiltering', () => {
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

  const mockTag3: Tag = {
    id: 'tag-3',
    company_id: 'company-1',
    display_value: 'Inspection',
    value: 'inspection',
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
    description: 'Photo with roofing tag',
    internal: false,
    photo_url: 'https://example.com/photo1.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag1], // Roofing
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
    description: 'Photo with repair tag',
    internal: false,
    photo_url: 'https://example.com/photo2.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag2], // Repair
  }

  const mockPhoto3: Photo = {
    id: 'photo-3',
    company_id: 'company-1',
    creator_id: 'user-1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project-1',
    processing_status: 'processed',
    coordinates: [],
    uris: [],
    hash: 'test-hash-3',
    description: 'Photo with multiple tags',
    internal: false,
    photo_url: 'https://example.com/photo3.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag1, mockTag2], // Roofing + Repair
  }

  const mockPhoto4: Photo = {
    id: 'photo-4',
    company_id: 'company-1',
    creator_id: 'user-1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project-1',
    processing_status: 'processed',
    coordinates: [],
    uris: [],
    hash: 'test-hash-4',
    description: 'Photo with inspection tag',
    internal: false,
    photo_url: 'https://example.com/photo4.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [mockTag3], // Inspection tag
  }

  const mockPhotos = [mockPhoto1, mockPhoto2, mockPhoto3, mockPhoto4]

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.filteredPhotos).toEqual(mockPhotos)
      expect(result.current.isFiltering).toBe(false)
      expect(result.current.availableFilterTags).toHaveLength(3)
      expect(typeof result.current.toggleTag).toBe('function')
      expect(typeof result.current.clearAllFilters).toBe('function')
      expect(typeof result.current.setFilterLogic).toBe('function')
    })

    it('should compute available filter tags from photos', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      const availableTags = result.current.availableFilterTags
      expect(availableTags).toHaveLength(3)
      expect(availableTags.map(tag => tag.id)).toContain('tag-1')
      expect(availableTags.map(tag => tag.id)).toContain('tag-2')
      expect(availableTags.map(tag => tag.id)).toContain('tag-3')
    })

    it('should handle empty photos array', () => {
      const { result } = renderHook(() => useTagFiltering([]))

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.filteredPhotos).toEqual([])
      expect(result.current.availableFilterTags).toEqual([])
      expect(result.current.isFiltering).toBe(false)
    })

    it('should handle photos without tags', () => {
      const photoWithoutTags = { ...mockPhoto4, tags: [] } // Override to have no tags
      const photosWithoutTags = [photoWithoutTags]
      const { result } = renderHook(() => useTagFiltering(photosWithoutTags))

      expect(result.current.availableFilterTags).toEqual([])
      expect(result.current.filteredPhotos).toEqual(photosWithoutTags)
    })
  })

  describe('Tag Toggle Functionality', () => {
    it('should add tag to active filters when toggled on', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1'])
      expect(result.current.isFiltering).toBe(true)
    })

    it('should remove tag from active filters when toggled off', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      // Add tag first
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1'])

      // Remove tag
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.isFiltering).toBe(false)
    })

    it('should handle multiple tags selection', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('tag-1')
        result.current.toggleTag('tag-2')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1', 'tag-2'])
      expect(result.current.isFiltering).toBe(true)
    })

    it('should handle non-existent tag ID gracefully', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('non-existent-tag')
      })

      expect(result.current.activeTagIds).toEqual(['non-existent-tag'])
      // Should still work, filtering will just return no results
    })
  })

  describe('Clear All Filters', () => {
    it('should clear all active filters', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      // Add multiple filters
      act(() => {
        result.current.toggleTag('tag-1')
        result.current.toggleTag('tag-2')
      })

      expect(result.current.activeTagIds).toHaveLength(2)

      // Clear all
      act(() => {
        result.current.clearAllFilters()
      })

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.filteredPhotos).toEqual(mockPhotos)
      expect(result.current.isFiltering).toBe(false)
    })

    it('should handle clearing when no filters are active', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      // Clear when already empty
      act(() => {
        result.current.clearAllFilters()
      })

      expect(result.current.activeTagIds).toEqual([])
      expect(result.current.isFiltering).toBe(false)
    })
  })

  describe('Filtering Logic - AND Mode', () => {
    it('should filter photos with single tag (AND mode)', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('tag-1') // Roofing
      })

      // Should return photos with tag-1 (photo1 and photo3)
      expect(result.current.filteredPhotos).toHaveLength(2)
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-1')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-3')
    })

    it('should filter photos with multiple tags using AND logic', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.setFilterLogic('AND')
        result.current.toggleTag('tag-1') // Roofing
        result.current.toggleTag('tag-2') // Repair
      })

      // Should return only photos with BOTH tags (photo3 only)
      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-3')
    })

    it('should return empty array when no photos match AND criteria', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.setFilterLogic('AND')
        result.current.toggleTag('tag-2') // Repair
        result.current.toggleTag('tag-3') // Inspection (no photos have both)
      })

      expect(result.current.filteredPhotos).toEqual([])
    })
  })

  describe('Filtering Logic - OR Mode', () => {
    it('should filter photos with single tag (OR mode)', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos, { filterLogic: 'OR' }))

      act(() => {
        result.current.toggleTag('tag-1') // Roofing
      })

      // Should return photos with tag-1 (photo1 and photo3)
      expect(result.current.filteredPhotos).toHaveLength(2)
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-1')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-3')
    })

    it('should filter photos with multiple tags using OR logic', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos, { filterLogic: 'OR' }))

      act(() => {
        result.current.toggleTag('tag-1') // Roofing
        result.current.toggleTag('tag-2') // Repair
      })

      // Should return photos with ANY of the tags (photo1, photo2, photo3)
      expect(result.current.filteredPhotos).toHaveLength(3)
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-1')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-2')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-3')
    })

    it('should return all matching photos for OR logic with non-overlapping tags', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos, { filterLogic: 'OR' }))

      act(() => {
        result.current.toggleTag('tag-1') // Roofing (photo1, photo3)
        result.current.toggleTag('tag-3') // Inspection (photo4)
      })

      // Should return photos with either tag-1 or tag-3
      expect(result.current.filteredPhotos).toHaveLength(3)
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-1')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-3')
      expect(result.current.filteredPhotos.map(p => p.id)).toContain('photo-4')
    })
  })

  describe('Dynamic Filter Logic Change', () => {
    it('should allow changing filter logic from AND to OR', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      // Start with AND mode, select multiple tags
      act(() => {
        result.current.setFilterLogic('AND')
        result.current.toggleTag('tag-1')
        result.current.toggleTag('tag-2')
      })

      // AND mode: only photo3 has both tags
      expect(result.current.filteredPhotos).toHaveLength(1)

      // Switch to OR mode
      act(() => {
        result.current.setFilterLogic('OR')
      })

      // OR mode: photos 1, 2, and 3 have at least one of the tags
      expect(result.current.filteredPhotos).toHaveLength(3)
    })

    it('should allow changing filter logic from OR to AND', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos, { filterLogic: 'OR' }))

      // Start with OR mode, select multiple tags
      act(() => {
        result.current.toggleTag('tag-1')
        result.current.toggleTag('tag-2')
      })

      // OR mode: photos 1, 2, and 3 have at least one tag
      expect(result.current.filteredPhotos).toHaveLength(3)

      // Switch to AND mode
      act(() => {
        result.current.setFilterLogic('AND')
      })

      // AND mode: only photo3 has both tags
      expect(result.current.filteredPhotos).toHaveLength(1)
    })
  })

  describe('Photos Array Updates', () => {
    it('should update filtered results when photos array changes', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => useTagFiltering(photos),
        { initialProps: { photos: mockPhotos } }
      )

      // Apply filter
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.filteredPhotos).toHaveLength(2)

      // Update photos array (remove one photo with tag-1)
      const updatedPhotos = [mockPhoto2, mockPhoto3, mockPhoto4] // removed photo1
      rerender({ photos: updatedPhotos })

      // Should now only show photo3 (which has tag-1)
      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-3')
    })

    it('should maintain filter state when photos array changes', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => useTagFiltering(photos),
        { initialProps: { photos: mockPhotos } }
      )

      // Apply multiple filters
      act(() => {
        result.current.toggleTag('tag-1')
        result.current.toggleTag('tag-2')
      })

      expect(result.current.activeTagIds).toEqual(['tag-1', 'tag-2'])

      // Update photos array
      const updatedPhotos = [mockPhoto1, mockPhoto2]
      rerender({ photos: updatedPhotos })

      // Filter state should be maintained
      expect(result.current.activeTagIds).toEqual(['tag-1', 'tag-2'])
      expect(result.current.isFiltering).toBe(true)
    })

    it('should update available filter tags when photos change', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => useTagFiltering(photos),
        { initialProps: { photos: [mockPhoto1, mockPhoto2] } }
      )

      // Initially should have 2 unique tags
      expect(result.current.availableFilterTags).toHaveLength(2)

      // Add photo with new tag
      rerender({ photos: mockPhotos })

      // Should now have 3 unique tags
      expect(result.current.availableFilterTags).toHaveLength(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle photos with undefined or null tags', () => {
      const photoWithUndefinedTags = { ...mockPhoto1, tags: undefined }
      const photoWithNullTags = { ...mockPhoto2, tags: null as any }
      const photosWithBadTags = [photoWithUndefinedTags, photoWithNullTags, mockPhoto3]

      const { result } = renderHook(() => useTagFiltering(photosWithBadTags))

      expect(result.current.availableFilterTags).toHaveLength(2) // Only from photo3
      
      // Apply filter - should only return photos with valid tags
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.filteredPhotos).toHaveLength(1)
      expect(result.current.filteredPhotos[0].id).toBe('photo-3')
    })

    it('should handle photos with empty tags array', () => {
      const photoWithEmptyTags = { ...mockPhoto4, tags: [] } // Override to have empty tags
      const photosWithEmptyTags = [photoWithEmptyTags]
      const { result } = renderHook(() => useTagFiltering(photosWithEmptyTags))

      expect(result.current.availableFilterTags).toEqual([])

      // Apply any filter - should return no results
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.filteredPhotos).toEqual([])
    })

    it('should handle duplicate tag IDs across photos', () => {
      const photoWithDuplicateTag = { ...mockPhoto4, tags: [mockTag1] }
      const photosWithDuplicates = [mockPhoto1, photoWithDuplicateTag] // Both have tag-1

      const { result } = renderHook(() => useTagFiltering(photosWithDuplicates))

      // Should deduplicate tags in available filter tags
      expect(result.current.availableFilterTags).toHaveLength(1)
      expect(result.current.availableFilterTags[0].id).toBe('tag-1')

      // Filter should return both photos
      act(() => {
        result.current.toggleTag('tag-1')
      })

      expect(result.current.filteredPhotos).toHaveLength(2)
    })

    it('should handle invalid tag objects', () => {
      const invalidTag = { id: 'invalid', display_value: 'Invalid' } as Tag
      const photoWithInvalidTag = { ...mockPhoto1, tags: [invalidTag, mockTag1] }
      
      const { result } = renderHook(() => useTagFiltering([photoWithInvalidTag]))

      // Should handle invalid tags gracefully
      expect(result.current.availableFilterTags).toHaveLength(2)
    })
  })

  describe('Performance and Memoization', () => {
    it('should not recompute filtered photos if filters and photos unchanged', () => {
      const { result, rerender } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('tag-1')
      })

      const firstFilteredPhotos = result.current.filteredPhotos

      // Rerender without changing anything
      rerender()

      // Should be the same reference (memoized)
      expect(result.current.filteredPhotos).toBe(firstFilteredPhotos)
    })

    it('should recompute when filter state changes', () => {
      const { result } = renderHook(() => useTagFiltering(mockPhotos))

      act(() => {
        result.current.toggleTag('tag-1')
      })

      const firstFilteredPhotos = result.current.filteredPhotos

      act(() => {
        result.current.toggleTag('tag-2')
      })

      // Should be different after filter change
      expect(result.current.filteredPhotos).not.toBe(firstFilteredPhotos)
    })
  })
})