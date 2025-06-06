// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAiEnhancements } from '../useAiEnhancements'
import { companyCamService } from '../../services/companyCamService'
import type { Photo, Tag, CurrentUser } from '../../types'
import type { PhotoCardAiSuggestionState } from '../../components/PhotoCard'

// Mock companyCamService
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    createCompanyCamTagDefinition: vi.fn(),
    addTagsToPhoto: vi.fn(),
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

// Mock fetch for AI endpoints
global.fetch = vi.fn()

describe('useAiEnhancements', () => {
  const mockUser: CurrentUser = {
    id: 'user-123',
    company_id: 'company-456',
    email_address: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    status: 'active',
  }

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
    description: 'Original description',
    internal: false,
    photo_url: 'https://example.com/photo1.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    tags: [
      {
        id: 'tag-1',
        company_id: 'company-1',
        display_value: 'Existing Tag',
        value: 'existing tag',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
  }

  const mockAiSuggestionResponse = {
    suggested_tags: ['roofing', 'repair'],
    suggested_description: 'AI generated description',
    checklist_triggers: ['safety_check'],
  }

  const mockPersistedEnhancement = {
    photo_id: 'photo-1',
    user_id: 'user-123',
    ai_description: 'Saved AI description',
    accepted_ai_tags: ['saved-tag-1', 'saved-tag-2'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    suggestion_source: 'openai',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('test-api-key')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAiSuggestionResponse),
      text: () => Promise.resolve(''),
    } as Response)
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
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      expect(result.current.aiSuggestionsCache).toEqual({})
      expect(typeof result.current.fetchAiSuggestions).toBe('function')
      expect(typeof result.current.saveAiDescription).toBe('function')
      expect(typeof result.current.addAiTag).toBe('function')
      expect(typeof result.current.loadPersistedEnhancements).toBe('function')
      expect(typeof result.current.getAiDataForPhoto).toBe('function')
      expect(typeof result.current.clearCache).toBe('function')
      expect(typeof result.current.clearPhotoCache).toBe('function')
      expect(typeof result.current.updatePhotoWithPersistedData).toBe('function')
    })

    it('should return undefined for non-existent photo AI data', () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      expect(result.current.getAiDataForPhoto('non-existent')).toBeUndefined()
    })
  })

  describe('AI Suggestions Fetching', () => {
    it('should fetch AI suggestions successfully', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'https://example.com/photo1.jpg')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData).toBeDefined()
      expect(photoData?.suggestedTags).toEqual(['roofing', 'repair'])
      expect(photoData?.suggestedDescription).toBe('AI generated description')
      expect(photoData?.isSuggesting).toBe(false)
      expect(photoData?.suggestionError).toBeNull()

      expect(fetch).toHaveBeenCalledWith('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrl: 'https://example.com/photo1.jpg',
          userId: 'user-123',
          photoId: 'photo-1',
        }),
      })
    })

    it('should set loading state during AI suggestions fetch', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Start fetch without awaiting
      let fetchPromise: Promise<void>
      act(() => {
        fetchPromise = result.current.fetchAiSuggestions('photo-1', 'https://example.com/photo1.jpg')
      })

      // Check loading state
      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.isSuggesting).toBe(true)

      // Complete fetch
      await act(async () => {
        await fetchPromise
      })

      const finalData = result.current.getAiDataForPhoto('photo-1')
      expect(finalData?.isSuggesting).toBe(false)
    })

    it('should handle AI suggestions fetch error', async () => {
      const errorMessage = 'AI API failed'
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(errorMessage),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'https://example.com/photo1.jpg')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.suggestionError).toContain(errorMessage)
      expect(photoData?.isSuggesting).toBe(false)
      expect(photoData?.suggestedTags).toEqual([])
      expect(photoData?.suggestedDescription).toBe('')
    })

    it('should handle AI suggestions network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'https://example.com/photo1.jpg')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.suggestionError).toBe('Network error')
      expect(photoData?.isSuggesting).toBe(false)
    })

    it('should include projectId in API call when provided', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.fetchAiSuggestions(
          'photo-1', 
          'https://example.com/photo1.jpg', 
          'project-123'
        )
      })

      expect(fetch).toHaveBeenCalledWith('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrl: 'https://example.com/photo1.jpg',
          userId: 'user-123',
          photoId: 'photo-1',
          projectId: 'project-123',
        }),
      })
    })

    it('should filter out existing tags from suggestions', async () => {
      const responseWithExistingTag = {
        suggested_tags: ['roofing', 'existing tag', 'repair'], // 'existing tag' matches photo tag
        suggested_description: 'AI description',
        checklist_triggers: [],
      }
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseWithExistingTag),
      } as Response)

      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useAiEnhancements(mockUser, { onPhotoUpdate, currentPhoto: mockPhoto })
      )

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'https://example.com/photo1.jpg')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.suggestedTags).toEqual(['roofing', 'repair']) // 'existing tag' filtered out
    })
  })

  describe('Persisted Enhancements Loading', () => {
    it('should load persisted enhancements successfully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPersistedEnhancement),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.loadPersistedEnhancements('photo-1')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.persistedDescription).toBe('Saved AI description')
      expect(photoData?.persistedAcceptedTags).toEqual(['saved-tag-1', 'saved-tag-2'])
      expect(photoData?.isLoadingPersisted).toBe(false)
      expect(photoData?.persistedError).toBeNull()

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements?photoId=photo-1')
    })

    it('should set loading state during persisted enhancement fetch', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Start fetch without awaiting
      let fetchPromise: Promise<void>
      act(() => {
        fetchPromise = result.current.loadPersistedEnhancements('photo-1')
      })

      // Check loading state
      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.isLoadingPersisted).toBe(true)

      // Complete fetch
      await act(async () => {
        await fetchPromise
      })

      const finalData = result.current.getAiDataForPhoto('photo-1')
      expect(finalData?.isLoadingPersisted).toBe(false)
    })

    it('should handle 404 response for persisted enhancements gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.loadPersistedEnhancements('photo-1')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.persistedDescription).toBeUndefined()
      expect(photoData?.persistedAcceptedTags).toEqual([])
      expect(photoData?.isLoadingPersisted).toBe(false)
      expect(photoData?.persistedError).toBeNull()
    })

    it('should handle persisted enhancements fetch error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.loadPersistedEnhancements('photo-1')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.persistedError).toContain('500')
      expect(photoData?.isLoadingPersisted).toBe(false)
    })

    it('should update photo with persisted data when callback provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPersistedEnhancement),
      } as Response)

      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useAiEnhancements(mockUser, { onPhotoUpdate, currentPhoto: mockPhoto })
      )

      await act(async () => {
        await result.current.loadPersistedEnhancements('photo-1')
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo-1',
          description: 'Saved AI description',
          tags: expect.arrayContaining([
            expect.objectContaining({ display_value: 'Existing Tag' }),
            expect.objectContaining({ display_value: 'saved-tag-1', isAiEnhanced: true }),
            expect.objectContaining({ display_value: 'saved-tag-2', isAiEnhanced: true }),
          ]),
        })
      )
    })
  })

  describe('AI Description Saving', () => {
    it('should save AI description successfully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.saveAiDescription('photo-1', 'New AI description')
      })

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'photo-1',
          userId: 'user-123',
          aiDescription: 'New AI description',
        }),
      })

      // Should update persisted description in cache
      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.persistedDescription).toBe('New AI description')
    })

    it('should handle AI description save error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Save failed'),
      } as Response)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await expect(async () => {
        await act(async () => {
          await result.current.saveAiDescription('photo-1', 'New description')
        })
      }).rejects.toThrow('Failed to save AI description')
    })

    it('should update photo description when callback provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useAiEnhancements(mockUser, { onPhotoUpdate, currentPhoto: mockPhoto })
      )

      await act(async () => {
        await result.current.saveAiDescription('photo-1', 'Updated description')
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo-1',
          description: 'Updated description',
        })
      )
    })
  })

  describe('AI Tag Management', () => {
    it('should add AI tag successfully', async () => {
      // Mock API responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as Response) // For AI enhancement save

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.addAiTag('photo-1', 'New AI Tag')
      })

      // Should create CompanyCam tag
      expect(companyCamService.createCompanyCamTagDefinition).toHaveBeenCalledWith(
        'test-api-key',
        'New AI Tag'
      )

      // Should add tag to photo
      expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith(
        'test-api-key',
        'photo-1',
        ['new-tag-id']
      )

      // Should save to AI enhancements
      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'photo-1',
          userId: 'user-123',
          acceptedAiTags: ['New AI Tag'],
        }),
      })
    })

    it('should handle AI tag addition error', async () => {
      vi.mocked(companyCamService.createCompanyCamTagDefinition).mockRejectedValue(
        new Error('Tag creation failed')
      )

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await expect(async () => {
        await act(async () => {
          await result.current.addAiTag('photo-1', 'Failed Tag')
        })
      }).rejects.toThrow('Tag creation failed')
    })

    it('should handle missing API key for tag operations', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await expect(async () => {
        await act(async () => {
          await result.current.addAiTag('photo-1', 'Test Tag')
        })
      }).rejects.toThrow('API key not found')
    })

    it('should update photo with new AI tag when callback provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const onPhotoUpdate = vi.fn()
      const { result } = renderHook(() => 
        useAiEnhancements(mockUser, { onPhotoUpdate, currentPhoto: mockPhoto })
      )

      await act(async () => {
        await result.current.addAiTag('photo-1', 'New AI Tag')
      })

      expect(onPhotoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'photo-1',
          tags: expect.arrayContaining([
            expect.objectContaining({ display_value: 'Existing Tag' }),
            expect.objectContaining({ display_value: 'New AI Tag', isAiEnhanced: true }),
          ]),
        })
      )
    })
  })

  describe('Cache Management', () => {
    it('should clear entire cache', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Add some data to cache
      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'url1')
        await result.current.fetchAiSuggestions('photo-2', 'url2')
      })

      expect(Object.keys(result.current.aiSuggestionsCache)).toHaveLength(2)

      act(() => {
        result.current.clearCache()
      })

      expect(result.current.aiSuggestionsCache).toEqual({})
    })

    it('should clear specific photo cache', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Add data for two photos
      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'url1')
        await result.current.fetchAiSuggestions('photo-2', 'url2')
      })

      expect(Object.keys(result.current.aiSuggestionsCache)).toHaveLength(2)

      act(() => {
        result.current.clearPhotoCache('photo-1')
      })

      expect(result.current.aiSuggestionsCache['photo-1']).toBeUndefined()
      expect(result.current.aiSuggestionsCache['photo-2']).toBeDefined()
    })

    it('should handle clearing non-existent photo cache gracefully', () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      expect(() => {
        act(() => {
          result.current.clearPhotoCache('non-existent')
        })
      }).not.toThrow()
    })
  })

  describe('Photo Update Integration', () => {
    it('should update photo with persisted data correctly', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Mock fetch response first
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPersistedEnhancement),
      } as Response)

      // Load persisted data and wait for it to complete
      await act(async () => {
        await result.current.loadPersistedEnhancements('photo-1')
      })

      const updatedPhoto = result.current.updatePhotoWithPersistedData('photo-1', mockPhoto)

      expect(updatedPhoto.description).toBe('Saved AI description')
      expect(updatedPhoto.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ display_value: 'Existing Tag' }),
          expect.objectContaining({ display_value: 'saved-tag-1', isAiEnhanced: true }),
          expect.objectContaining({ display_value: 'saved-tag-2', isAiEnhanced: true }),
        ])
      )
    })

    it('should return original photo when no persisted data exists', () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      const updatedPhoto = result.current.updatePhotoWithPersistedData('photo-1', mockPhoto)

      expect(updatedPhoto).toEqual(mockPhoto)
    })
  })

  describe('Error Handling', () => {
    it('should handle concurrent operations correctly', async () => {
      const { result } = renderHook(() => useAiEnhancements(mockUser))

      // Start multiple operations concurrently
      const promises = [
        result.current.fetchAiSuggestions('photo-1', 'url'),
        result.current.loadPersistedEnhancements('photo-1'),
        result.current.saveAiDescription('photo-1', 'description'),
      ]

      await act(async () => {
        await Promise.allSettled(promises)
      })

      // Should not crash and should have some state
      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData).toBeDefined()
    })

    it('should maintain separate error states for different operations', async () => {
      // Mock different errors for different endpoints
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Suggestions failed'),
        } as Response) // suggestions
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Not found'),
        } as Response) // persisted data

      const { result } = renderHook(() => useAiEnhancements(mockUser))

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'url')
        await result.current.loadPersistedEnhancements('photo-1')
      })

      const photoData = result.current.getAiDataForPhoto('photo-1')
      expect(photoData?.suggestionError).toContain('Suggestions failed')
      expect(photoData?.persistedError).toBeNull() // 404 is handled gracefully
    })
  })

  describe('Integration with UserContext', () => {
    it('should handle missing user gracefully', () => {
      const { result } = renderHook(() => useAiEnhancements(null))

      expect(() => {
        result.current.fetchAiSuggestions('photo-1', 'url')
      }).not.toThrow()

      // Should not make API calls without user
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should use user ID in API calls', async () => {
      const customUser = { ...mockUser, id: 'custom-user-id' }
      const { result } = renderHook(() => useAiEnhancements(customUser))

      await act(async () => {
        await result.current.fetchAiSuggestions('photo-1', 'url')
      })

      expect(fetch).toHaveBeenCalledWith('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrl: 'url',
          userId: 'custom-user-id',
          photoId: 'photo-1',
        }),
      })
    })
  })
})