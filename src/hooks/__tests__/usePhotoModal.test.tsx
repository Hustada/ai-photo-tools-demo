// © 2025 Mark Hustad — MIT License
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePhotoModal } from '../usePhotoModal'
import type { Photo } from '../../types'

describe('usePhotoModal', () => {
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
    tags: [],
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
    tags: [],
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
    description: 'Test photo 3',
    internal: false,
    photo_url: 'https://example.com/photo3.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [],
  }

  const mockPhotos = [mockPhoto1, mockPhoto2, mockPhoto3]

  describe('Initial State', () => {
    it('should have correct initial state with empty photos array', () => {
      const { result } = renderHook(() => usePhotoModal([]))

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.canNavigatePrevious).toBe(false)
      expect(result.current.currentIndex).toBe(-1)
      expect(result.current.totalPhotos).toBe(0)
    })

    it('should have correct initial state with photos array', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.canNavigatePrevious).toBe(false)
      expect(result.current.currentIndex).toBe(-1)
      expect(result.current.totalPhotos).toBe(3)
    })

    it('should provide all required functions', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      expect(typeof result.current.openModal).toBe('function')
      expect(typeof result.current.closeModal).toBe('function')
      expect(typeof result.current.showNextPhoto).toBe('function')
      expect(typeof result.current.showPreviousPhoto).toBe('function')
    })
  })

  describe('Opening Modal', () => {
    it('should open modal with first photo', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      act(() => {
        result.current.openModal(mockPhoto1)
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.selectedPhoto).toEqual(mockPhoto1)
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.canNavigateNext).toBe(true)
      expect(result.current.canNavigatePrevious).toBe(false)
    })

    it('should open modal with middle photo', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      act(() => {
        result.current.openModal(mockPhoto2)
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.selectedPhoto).toEqual(mockPhoto2)
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.currentIndex).toBe(1)
      expect(result.current.canNavigateNext).toBe(true)
      expect(result.current.canNavigatePrevious).toBe(true)
    })

    it('should open modal with last photo', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      act(() => {
        result.current.openModal(mockPhoto3)
      })

      expect(result.current.selectedPhotoIndex).toBe(2)
      expect(result.current.selectedPhoto).toEqual(mockPhoto3)
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.currentIndex).toBe(2)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.canNavigatePrevious).toBe(true)
    })

    it('should handle photo not found in array', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))
      
      const notFoundPhoto: Photo = { ...mockPhoto1, id: 'not-found' }

      act(() => {
        result.current.openModal(notFoundPhoto)
      })

      // Should not open modal if photo not found
      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
    })

    it('should handle opening modal with empty photos array', () => {
      const { result } = renderHook(() => usePhotoModal([]))

      act(() => {
        result.current.openModal(mockPhoto1)
      })

      // Should not open modal if photos array is empty
      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
    })

    it('should handle single photo array', () => {
      const { result } = renderHook(() => usePhotoModal([mockPhoto1]))

      act(() => {
        result.current.openModal(mockPhoto1)
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.selectedPhoto).toEqual(mockPhoto1)
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.totalPhotos).toBe(1)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.canNavigatePrevious).toBe(false)
    })
  })

  describe('Closing Modal', () => {
    it('should close modal and reset state', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal first
      act(() => {
        result.current.openModal(mockPhoto2)
      })

      expect(result.current.isModalOpen).toBe(true)

      // Close modal
      act(() => {
        result.current.closeModal()
      })

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.currentIndex).toBe(-1)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.canNavigatePrevious).toBe(false)
    })

    it('should handle closing already closed modal', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Modal should already be closed
      expect(result.current.isModalOpen).toBe(false)

      // Closing again should not cause issues
      act(() => {
        result.current.closeModal()
      })

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
    })
  })

  describe('Navigation - Next Photo', () => {
    it('should navigate to next photo when possible', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal with first photo
      act(() => {
        result.current.openModal(mockPhoto1)
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.canNavigateNext).toBe(true)

      // Navigate to next
      act(() => {
        result.current.showNextPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.selectedPhoto).toEqual(mockPhoto2)
      expect(result.current.currentIndex).toBe(1)
      expect(result.current.canNavigateNext).toBe(true)
      expect(result.current.canNavigatePrevious).toBe(true)
    })

    it('should not navigate beyond last photo', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal with last photo
      act(() => {
        result.current.openModal(mockPhoto3)
      })

      expect(result.current.selectedPhotoIndex).toBe(2)
      expect(result.current.canNavigateNext).toBe(false)

      // Try to navigate next (should not change)
      act(() => {
        result.current.showNextPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(2)
      expect(result.current.selectedPhoto).toEqual(mockPhoto3)
      expect(result.current.canNavigateNext).toBe(false)
    })

    it('should not navigate when modal is closed', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Modal is closed by default
      expect(result.current.isModalOpen).toBe(false)

      // Try to navigate next (should not change anything)
      act(() => {
        result.current.showNextPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
    })

    it('should navigate through all photos sequentially', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Start with first photo
      act(() => {
        result.current.openModal(mockPhoto1)
      })

      // Navigate to second photo
      act(() => {
        result.current.showNextPhoto()
      })
      expect(result.current.selectedPhoto).toEqual(mockPhoto2)

      // Navigate to third photo
      act(() => {
        result.current.showNextPhoto()
      })
      expect(result.current.selectedPhoto).toEqual(mockPhoto3)
      expect(result.current.canNavigateNext).toBe(false)
    })
  })

  describe('Navigation - Previous Photo', () => {
    it('should navigate to previous photo when possible', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal with middle photo
      act(() => {
        result.current.openModal(mockPhoto2)
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.canNavigatePrevious).toBe(true)

      // Navigate to previous
      act(() => {
        result.current.showPreviousPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.selectedPhoto).toEqual(mockPhoto1)
      expect(result.current.currentIndex).toBe(0)
      expect(result.current.canNavigateNext).toBe(true)
      expect(result.current.canNavigatePrevious).toBe(false)
    })

    it('should not navigate before first photo', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal with first photo
      act(() => {
        result.current.openModal(mockPhoto1)
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.canNavigatePrevious).toBe(false)

      // Try to navigate previous (should not change)
      act(() => {
        result.current.showPreviousPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.selectedPhoto).toEqual(mockPhoto1)
      expect(result.current.canNavigatePrevious).toBe(false)
    })

    it('should not navigate when modal is closed', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Modal is closed by default
      expect(result.current.isModalOpen).toBe(false)

      // Try to navigate previous (should not change anything)
      act(() => {
        result.current.showPreviousPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
    })

    it('should navigate backwards through all photos sequentially', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Start with last photo
      act(() => {
        result.current.openModal(mockPhoto3)
      })

      // Navigate to second photo
      act(() => {
        result.current.showPreviousPhoto()
      })
      expect(result.current.selectedPhoto).toEqual(mockPhoto2)

      // Navigate to first photo
      act(() => {
        result.current.showPreviousPhoto()
      })
      expect(result.current.selectedPhoto).toEqual(mockPhoto1)
      expect(result.current.canNavigatePrevious).toBe(false)
    })
  })

  describe('Photos Array Updates', () => {
    it('should handle photos array changing while modal is open', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => usePhotoModal(photos),
        { initialProps: { photos: mockPhotos } }
      )

      // Open modal with second photo
      act(() => {
        result.current.openModal(mockPhoto2)
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.totalPhotos).toBe(3)

      // Update photos array (remove first photo)
      const updatedPhotos = [mockPhoto2, mockPhoto3]
      rerender({ photos: updatedPhotos })

      // Modal should still be open, but now showing whatever photo is at index 1
      // In the new array [mockPhoto2, mockPhoto3], index 1 = mockPhoto3
      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.selectedPhoto).toEqual(mockPhoto3)
      expect(result.current.totalPhotos).toBe(2)
      expect(result.current.selectedPhotoIndex).toBe(1)
    })

    it('should close modal when selected photo index becomes out of bounds', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => usePhotoModal(photos),
        { initialProps: { photos: mockPhotos } }
      )

      // Open modal with last photo (index 2)
      act(() => {
        result.current.openModal(mockPhoto3)
      })

      expect(result.current.selectedPhotoIndex).toBe(2)
      expect(result.current.isModalOpen).toBe(true)

      // Update photos array to have only 2 photos (index 2 no longer exists)
      const updatedPhotos = [mockPhoto1, mockPhoto2]
      rerender({ photos: updatedPhotos })

      // Modal should be closed since index 2 is now out of bounds
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.selectedPhoto).toBeNull()
    })

    it('should handle empty photos array while modal is open', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => usePhotoModal(photos),
        { initialProps: { photos: mockPhotos } }
      )

      // Open modal
      act(() => {
        result.current.openModal(mockPhoto1)
      })

      expect(result.current.isModalOpen).toBe(true)

      // Update to empty array
      rerender({ photos: [] })

      // Modal should be closed
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.selectedPhotoIndex).toBeNull()
      expect(result.current.totalPhotos).toBe(0)
    })

    it('should handle photos array becoming longer while modal is open', () => {
      const { result, rerender } = renderHook(
        ({ photos }) => usePhotoModal(photos),
        { initialProps: { photos: [mockPhoto1, mockPhoto2] } }
      )

      // Open modal with last photo in short array
      act(() => {
        result.current.openModal(mockPhoto2)
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.canNavigateNext).toBe(false)
      expect(result.current.totalPhotos).toBe(2)

      // Extend the array
      rerender({ photos: mockPhotos })

      // Should now be able to navigate next
      expect(result.current.canNavigateNext).toBe(true)
      expect(result.current.totalPhotos).toBe(3)
      expect(result.current.selectedPhotoIndex).toBe(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle photos with duplicate IDs', () => {
      const duplicatePhoto = { ...mockPhoto1, description: 'Duplicate' }
      const photosWithDuplicates = [mockPhoto1, duplicatePhoto, mockPhoto2]
      
      const { result } = renderHook(() => usePhotoModal(photosWithDuplicates))

      act(() => {
        result.current.openModal(mockPhoto1)
      })

      // Should select the first occurrence
      expect(result.current.selectedPhotoIndex).toBe(0)
      expect(result.current.selectedPhoto?.description).toBe('Test photo 1')
    })

    it('should maintain correct state after multiple operations', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Open modal
      act(() => {
        result.current.openModal(mockPhoto1)
      })

      // Navigate forward twice (in separate act calls)
      act(() => {
        result.current.showNextPhoto()
      })

      act(() => {
        result.current.showNextPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(2)

      // Navigate backward once
      act(() => {
        result.current.showPreviousPhoto()
      })

      expect(result.current.selectedPhotoIndex).toBe(1)
      expect(result.current.selectedPhoto).toEqual(mockPhoto2)

      // Close and reopen with different photo
      act(() => {
        result.current.closeModal()
      })

      act(() => {
        result.current.openModal(mockPhoto3)
      })

      expect(result.current.selectedPhotoIndex).toBe(2)
      expect(result.current.selectedPhoto).toEqual(mockPhoto3)
    })
  })

  describe('Derived State Consistency', () => {
    it('should maintain consistent derived state', () => {
      const { result } = renderHook(() => usePhotoModal(mockPhotos))

      // Test all combinations of state
      const testCases = [
        { photo: mockPhoto1, expectedIndex: 0, expectedCanNext: true, expectedCanPrev: false },
        { photo: mockPhoto2, expectedIndex: 1, expectedCanNext: true, expectedCanPrev: true },
        { photo: mockPhoto3, expectedIndex: 2, expectedCanNext: false, expectedCanPrev: true },
      ]

      testCases.forEach(({ photo, expectedIndex, expectedCanNext, expectedCanPrev }) => {
        act(() => {
          result.current.openModal(photo)
        })

        expect(result.current.selectedPhotoIndex).toBe(expectedIndex)
        expect(result.current.currentIndex).toBe(expectedIndex)
        expect(result.current.canNavigateNext).toBe(expectedCanNext)
        expect(result.current.canNavigatePrevious).toBe(expectedCanPrev)
        expect(result.current.totalPhotos).toBe(3)
        expect(result.current.isModalOpen).toBe(true)
        expect(result.current.selectedPhoto).toEqual(photo)
      })
    })
  })
})