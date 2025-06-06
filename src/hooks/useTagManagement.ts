// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo } from 'react'
import { companyCamService } from '../services/companyCamService'
import type { Photo, CurrentUser, Tag } from '../types'

export interface UseTagManagementOptions {
  onPhotoUpdate?: (photoId: string, newTag: Tag, isFromAiSuggestion: boolean) => void
}

export interface UseTagManagementReturn {
  // State
  activeTagIds: string[]
  uniqueFilterableTags: Tag[]
  filteredPhotos: Photo[]
  tagError: string | null
  isAddingTag: boolean
  
  // Actions
  handleTagClick: (tagId: string) => void
  handleAddTagRequest: (photoId: string, tagDisplayValue: string, isAiEnhanced?: boolean) => Promise<void>
  clearAllFilters: () => void
}

export const useTagManagement = (
  photos: Photo[],
  currentUser: CurrentUser | null,
  options?: UseTagManagementOptions
): UseTagManagementReturn => {
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [tagError, setTagError] = useState<string | null>(null)
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false)

  // Compute unique filterable tags from all photos
  const uniqueFilterableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    
    photos.forEach(photo => {
      if (photo.tags && Array.isArray(photo.tags)) {
        photo.tags.forEach(tag => {
          if (tag && tag.id) {
            tagMap.set(tag.id, tag)
          }
        })
      }
    })
    
    return Array.from(tagMap.values())
  }, [photos])

  // Filter photos based on active tag IDs using AND logic
  const filteredPhotos = useMemo(() => {
    if (activeTagIds.length === 0) {
      return photos
    }

    return photos.filter(photo => {
      if (!photo.tags || !Array.isArray(photo.tags)) {
        return false
      }

      const photoTagIds = photo.tags.map(tag => tag.id)
      
      // AND logic: photo must have ALL selected tags
      return activeTagIds.every(activeTagId => 
        photoTagIds.includes(activeTagId)
      )
    })
  }, [photos, activeTagIds])

  // Toggle tag selection for filtering
  const handleTagClick = useCallback((tagId: string) => {
    setActiveTagIds(prevActiveTagIds => {
      if (prevActiveTagIds.includes(tagId)) {
        // Remove tag from active filters
        return prevActiveTagIds.filter(id => id !== tagId)
      } else {
        // Add tag to active filters
        return [...prevActiveTagIds, tagId]
      }
    })
  }, [])

  // Clear all active filters
  const clearAllFilters = useCallback(() => {
    setActiveTagIds([])
  }, [])

  // Main function to add tags to photos
  const handleAddTagRequest = useCallback(async (
    photoId: string, 
    tagDisplayValue: string, 
    isAiEnhanced: boolean = false
  ) => {
    const apiKey = localStorage.getItem('companyCamApiKey')
    if (!apiKey) {
      setTagError('API key not found. Please check your API key settings.')
      return
    }

    setIsAddingTag(true)
    setTagError(null)

    try {
      console.log(`[useTagManagement] Adding tag "${tagDisplayValue}" to photo ${photoId}`)

      // 1. Get all existing CompanyCam tags
      const allCompanyCamTags = await companyCamService.listCompanyCamTags(apiKey)
      console.log(`[useTagManagement] Found ${allCompanyCamTags.length} existing CompanyCam tags`)

      // 2. Check if tag already exists (case-insensitive)
      let targetTag = allCompanyCamTags.find((tag: Tag) => 
        tag.display_value.toLowerCase() === tagDisplayValue.toLowerCase()
      )

      // 3. Create tag if it doesn't exist
      if (!targetTag) {
        console.log(`[useTagManagement] Creating new tag definition: "${tagDisplayValue}"`)
        targetTag = await companyCamService.createCompanyCamTagDefinition(apiKey, tagDisplayValue)
        console.log(`[useTagManagement] Created new tag:`, targetTag)
      } else {
        console.log(`[useTagManagement] Using existing tag:`, targetTag)
      }

      // 4. Add tag to photo
      await companyCamService.addTagsToPhoto(apiKey, photoId, [targetTag.id])
      console.log(`[useTagManagement] Added tag to photo ${photoId}`)

      // 5. Create enhanced tag object with AI flag
      const enhancedTag: Tag = {
        ...targetTag,
        isAiEnhanced,
      }

      // 6. Persist AI tag acceptance if this is an AI-enhanced tag
      if (isAiEnhanced && currentUser) {
        try {
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
            console.warn(`[useTagManagement] Failed to persist AI tag acceptance: ${response.status} ${errorText}`)
            // Don't throw here - the tag was already added to CompanyCam successfully
          } else {
            console.log(`[useTagManagement] Persisted AI tag acceptance for "${tagDisplayValue}"`)
          }
        } catch (persistError: any) {
          console.warn(`[useTagManagement] Error persisting AI tag acceptance:`, persistError)
          // Don't throw here - the tag was already added to CompanyCam successfully
        }
      }

      // 7. Notify parent component of the update
      if (options?.onPhotoUpdate) {
        options.onPhotoUpdate(photoId, enhancedTag, isAiEnhanced)
      }

      console.log(`[useTagManagement] Successfully added tag "${tagDisplayValue}" to photo ${photoId}`)

    } catch (error: any) {
      console.error(`[useTagManagement] Error adding tag "${tagDisplayValue}" to photo ${photoId}:`, error)
      setTagError(`Failed to add tag "${tagDisplayValue}". ${error.message || 'Unknown error'}`)
    } finally {
      setIsAddingTag(false)
    }
  }, [currentUser, options?.onPhotoUpdate])

  return {
    activeTagIds,
    uniqueFilterableTags,
    filteredPhotos,
    tagError,
    isAddingTag,
    handleTagClick,
    handleAddTagRequest,
    clearAllFilters,
  }
}