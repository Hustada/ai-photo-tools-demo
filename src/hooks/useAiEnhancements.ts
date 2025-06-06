// © 2025 Mark Hustad — MIT License
import { useState, useCallback } from 'react'
import { companyCamService } from '../services/companyCamService'
import type { Photo, CurrentUser, Tag } from '../types'
import type { PhotoCardAiSuggestionState } from '../components/PhotoCard'

// API response interfaces
interface AiSuggestionResponse {
  suggested_tags: string[]
  suggested_description: string
  checklist_triggers?: string[]
}

interface PersistedEnhancement {
  photo_id: string
  user_id: string
  ai_description?: string
  accepted_ai_tags: string[]
  created_at: string
  updated_at: string
  suggestion_source?: string
}

export interface UseAiEnhancementsOptions {
  onPhotoUpdate?: (photo: Photo) => void
  currentPhoto?: Photo
}

export interface UseAiEnhancementsReturn {
  // State
  aiSuggestionsCache: Record<string, PhotoCardAiSuggestionState>
  
  // Core functions
  fetchAiSuggestions: (photoId: string, photoUrl: string, projectId?: string) => Promise<void>
  saveAiDescription: (photoId: string, description: string) => Promise<void>
  addAiTag: (photoId: string, tagDisplayValue: string) => Promise<void>
  loadPersistedEnhancements: (photoId: string) => Promise<void>
  
  // Utility functions
  getAiDataForPhoto: (photoId: string) => PhotoCardAiSuggestionState | undefined
  clearCache: () => void
  clearPhotoCache: (photoId: string) => void
  
  // Integration helpers
  updatePhotoWithPersistedData: (photoId: string, photo: Photo) => Photo
}

export const useAiEnhancements = (
  currentUser: CurrentUser | null,
  options?: UseAiEnhancementsOptions
): UseAiEnhancementsReturn => {
  const [aiSuggestionsCache, setAiSuggestionsCache] = useState<Record<string, PhotoCardAiSuggestionState>>({})

  // Initialize cache entry for a photo
  const initializeCacheEntry = useCallback((photoId: string): PhotoCardAiSuggestionState => {
    return {
      suggestedTags: [],
      suggestedDescription: '',
      isSuggesting: false,
      suggestionError: null,
      persistedDescription: undefined,
      persistedAcceptedTags: [],
      isLoadingPersisted: false,
      persistedError: null,
    }
  }, [])

  // Update cache for a specific photo
  const updatePhotoCache = useCallback((photoId: string, updates: Partial<PhotoCardAiSuggestionState>) => {
    setAiSuggestionsCache(prevCache => ({
      ...prevCache,
      [photoId]: {
        ...(prevCache[photoId] || initializeCacheEntry(photoId)),
        ...updates,
      },
    }))
  }, [initializeCacheEntry])

  const fetchAiSuggestions = useCallback(async (photoId: string, photoUrl: string, projectId?: string) => {
    if (!currentUser) {
      console.warn('[useAiEnhancements] No current user available for AI suggestions')
      return
    }

    console.log(`[useAiEnhancements] Fetching AI suggestions for photo ${photoId}`)
    
    // Set loading state
    updatePhotoCache(photoId, { isSuggesting: true, suggestionError: null })

    try {
      const payload: any = {
        photoUrl,
        userId: currentUser.id,
        photoId,
      }

      if (projectId) {
        payload.projectId = projectId
      }

      const response = await fetch('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI suggestion request failed: ${response.status} ${errorText}`)
      }

      const aiResponse: AiSuggestionResponse = await response.json()
      console.log(`[useAiEnhancements] AI suggestions received for ${photoId}:`, aiResponse)

      // Filter out existing tags if current photo is provided
      let filteredTags = aiResponse.suggested_tags || []
      if (options?.currentPhoto?.tags) {
        const existingTagValues = options.currentPhoto.tags.map(tag => tag.value.toLowerCase())
        filteredTags = filteredTags.filter(tag => 
          !existingTagValues.includes(tag.toLowerCase())
        )
      }

      updatePhotoCache(photoId, {
        suggestedTags: filteredTags,
        suggestedDescription: aiResponse.suggested_description || '',
        isSuggesting: false,
        suggestionError: null,
      })

    } catch (error: any) {
      console.error(`[useAiEnhancements] Error fetching AI suggestions for ${photoId}:`, error)
      updatePhotoCache(photoId, {
        suggestedTags: [],
        suggestedDescription: '',
        isSuggesting: false,
        suggestionError: error.message || 'Failed to fetch AI suggestions',
      })
    }
  }, [currentUser, options?.currentPhoto, updatePhotoCache])

  const loadPersistedEnhancements = useCallback(async (photoId: string) => {
    console.log(`[useAiEnhancements] Loading persisted enhancements for photo ${photoId}`)
    
    // Set loading state
    updatePhotoCache(photoId, { isLoadingPersisted: true, persistedError: null })

    try {
      const response = await fetch(`/api/ai-enhancements?photoId=${photoId}`)

      if (response.status === 404) {
        console.log(`[useAiEnhancements] No persisted AI enhancements for ${photoId} (404)`)
        updatePhotoCache(photoId, {
          persistedDescription: undefined,
          persistedAcceptedTags: [],
          isLoadingPersisted: false,
          persistedError: null,
        })
        return
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to load persisted enhancements: ${response.status} ${errorText}`)
      }

      const persistedData: PersistedEnhancement = await response.json()
      console.log(`[useAiEnhancements] Persisted data loaded for ${photoId}:`, persistedData)

      updatePhotoCache(photoId, {
        persistedDescription: persistedData.ai_description,
        persistedAcceptedTags: persistedData.accepted_ai_tags || [],
        isLoadingPersisted: false,
        persistedError: null,
      })

      // Update photo if callback provided
      if (options?.onPhotoUpdate && options?.currentPhoto?.id === photoId) {
        const updatedPhoto = updatePhotoWithPersistedDataInternal(persistedData, options.currentPhoto)
        options.onPhotoUpdate(updatedPhoto)
      }

    } catch (error: any) {
      console.error(`[useAiEnhancements] Error loading persisted enhancements for ${photoId}:`, error)
      updatePhotoCache(photoId, {
        isLoadingPersisted: false,
        persistedError: error.message || 'Failed to load persisted enhancements',
      })
    }
  }, [options?.onPhotoUpdate, options?.currentPhoto, updatePhotoCache])

  const saveAiDescription = useCallback(async (photoId: string, description: string) => {
    if (!currentUser) {
      throw new Error('User not available for saving AI description')
    }

    console.log(`[useAiEnhancements] Saving AI description for photo ${photoId}`)

    try {
      const response = await fetch('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          userId: currentUser.id,
          aiDescription: description,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to save AI description: ${response.status} ${errorText}`)
      }

      console.log(`[useAiEnhancements] AI description saved for ${photoId}`)

      // Update cache with saved description
      updatePhotoCache(photoId, {
        persistedDescription: description,
      })

      // Update photo if callback provided
      if (options?.onPhotoUpdate && options?.currentPhoto?.id === photoId) {
        const updatedPhoto = { ...options.currentPhoto, description }
        options.onPhotoUpdate(updatedPhoto)
      }

    } catch (error: any) {
      console.error(`[useAiEnhancements] Error saving AI description for ${photoId}:`, error)
      throw new Error('Failed to save AI description')
    }
  }, [currentUser, options?.onPhotoUpdate, options?.currentPhoto, updatePhotoCache])

  const addAiTag = useCallback(async (photoId: string, tagDisplayValue: string) => {
    if (!currentUser) {
      throw new Error('User not available for adding AI tag')
    }

    const apiKey = localStorage.getItem('companyCamApiKey')
    if (!apiKey) {
      throw new Error('API key not found')
    }

    console.log(`[useAiEnhancements] Adding AI tag "${tagDisplayValue}" to photo ${photoId}`)

    try {
      // 1. Create CompanyCam tag definition
      const newTag = await companyCamService.createCompanyCamTagDefinition(apiKey, tagDisplayValue)
      console.log(`[useAiEnhancements] Created CompanyCam tag:`, newTag)

      // 2. Add tag to photo
      await companyCamService.addTagsToPhoto(apiKey, photoId, [newTag.id])
      console.log(`[useAiEnhancements] Added tag to photo ${photoId}`)

      // 3. Save to AI enhancements
      const response = await fetch('/api/ai-enhancements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          userId: currentUser.id,
          acceptedAiTags: [tagDisplayValue],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`[useAiEnhancements] Failed to save AI tag to enhancements: ${response.status} ${errorText}`)
        // Don't throw here - the tag was already added to CompanyCam
      }

      console.log(`[useAiEnhancements] AI tag "${tagDisplayValue}" successfully added`)

      // Update photo if callback provided
      if (options?.onPhotoUpdate && options?.currentPhoto?.id === photoId) {
        const newAiTag: Tag = {
          id: newTag.id,
          company_id: newTag.company_id,
          display_value: tagDisplayValue,
          value: tagDisplayValue.toLowerCase(),
          created_at: Date.now(),
          updated_at: Date.now(),
          isAiEnhanced: true,
        }

        const updatedPhoto = {
          ...options.currentPhoto,
          tags: [...(options.currentPhoto.tags || []), newAiTag],
        }
        options.onPhotoUpdate(updatedPhoto)
      }

    } catch (error: any) {
      console.error(`[useAiEnhancements] Error adding AI tag "${tagDisplayValue}" to ${photoId}:`, error)
      throw error
    }
  }, [currentUser, options?.onPhotoUpdate, options?.currentPhoto])

  const getAiDataForPhoto = useCallback((photoId: string) => {
    return aiSuggestionsCache[photoId]
  }, [aiSuggestionsCache])

  const clearCache = useCallback(() => {
    console.log('[useAiEnhancements] Clearing entire AI suggestions cache')
    setAiSuggestionsCache({})
  }, [])

  const clearPhotoCache = useCallback((photoId: string) => {
    console.log(`[useAiEnhancements] Clearing AI cache for photo ${photoId}`)
    setAiSuggestionsCache(prevCache => {
      const newCache = { ...prevCache }
      delete newCache[photoId]
      return newCache
    })
  }, [])

  // Helper function for updating photo with persisted data
  const updatePhotoWithPersistedDataInternal = useCallback((persistedData: PersistedEnhancement, photo: Photo): Photo => {
    let updatedPhoto = { ...photo }
    let updatedTags = [...(photo.tags || [])]

    // Update description
    if (persistedData.ai_description) {
      updatedPhoto.description = persistedData.ai_description
    }

    // Add AI tags
    if (persistedData.accepted_ai_tags && persistedData.accepted_ai_tags.length > 0) {
      persistedData.accepted_ai_tags.forEach(aiTagValue => {
        const aiTagValueLower = aiTagValue.toLowerCase()
        const matchingExistingTag = updatedTags.find(t => 
          t.display_value.toLowerCase() === aiTagValueLower
        )

        if (matchingExistingTag) {
          matchingExistingTag.isAiEnhanced = true
        } else {
          updatedTags.push({
            display_value: aiTagValue,
            isAiEnhanced: true,
            id: `ai_${photo.id}_${aiTagValue.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`,
            company_id: 'AI_TAG',
            value: aiTagValue.toLowerCase(),
            created_at: Date.now(),
            updated_at: Date.now(),
          })
        }
      })
    }

    updatedPhoto.tags = updatedTags
    return updatedPhoto
  }, [])

  const updatePhotoWithPersistedData = useCallback((photoId: string, photo: Photo): Photo => {
    const photoCache = aiSuggestionsCache[photoId]
    if (!photoCache?.persistedDescription && (!photoCache?.persistedAcceptedTags || photoCache.persistedAcceptedTags.length === 0)) {
      return photo
    }

    const mockPersistedData: PersistedEnhancement = {
      photo_id: photoId,
      user_id: currentUser?.id || '',
      ai_description: photoCache.persistedDescription,
      accepted_ai_tags: photoCache.persistedAcceptedTags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return updatePhotoWithPersistedDataInternal(mockPersistedData, photo)
  }, [aiSuggestionsCache, currentUser?.id, updatePhotoWithPersistedDataInternal])

  return {
    aiSuggestionsCache,
    fetchAiSuggestions,
    saveAiDescription,
    addAiTag,
    loadPersistedEnhancements,
    getAiDataForPhoto,
    clearCache,
    clearPhotoCache,
    updatePhotoWithPersistedData,
  }
}