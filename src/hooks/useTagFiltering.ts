// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo } from 'react'
import type { Photo, Tag } from '../types'

export interface UseTagFilteringOptions {
  // Future options can be added here if needed
}

export interface UseTagFilteringReturn {
  // State
  activeTagIds: string[]
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  
  // Actions
  toggleTag: (tagId: string) => void
  clearAllFilters: () => void
}

export const useTagFiltering = (
  photos: Photo[],
  options: UseTagFilteringOptions = {}
): UseTagFilteringReturn => {
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])

  // Compute available filter tags from all photos (deduplicated by display_value)
  const availableFilterTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    
    photos.forEach(photo => {
      if (photo.tags && Array.isArray(photo.tags)) {
        photo.tags.forEach(tag => {
          if (tag && tag.id && typeof tag.id === 'string' && tag.display_value) {
            // Use display_value as the key to deduplicate tags with the same visible text
            const key = tag.display_value.toLowerCase()
            // Only add if we haven't seen this display_value before
            if (!tagMap.has(key)) {
              tagMap.set(key, tag)
            }
          }
        })
      }
    })
    
    return Array.from(tagMap.values())
  }, [photos])

  // Apply filtering logic to photos
  const filteredPhotos = useMemo(() => {
    if (activeTagIds.length === 0) {
      return photos
    }

    return photos.filter(photo => {
      if (!photo.tags || !Array.isArray(photo.tags)) {
        return false
      }

      const photoTagDisplayValues = photo.tags
        .filter(tag => tag && tag.display_value)
        .map(tag => tag.display_value.toLowerCase())

      // OR logic: photo must have AT LEAST ONE selected tag (by display value)
      return activeTagIds.some(activeTagId => 
        photoTagDisplayValues.includes(activeTagId.toLowerCase())
      )
    })
  }, [photos, activeTagIds])

  // Derived state
  const isFiltering = useMemo(() => {
    return activeTagIds.length > 0
  }, [activeTagIds.length])

  // Actions
  const toggleTag = useCallback((tagId: string) => {
    console.log(`[useTagFiltering] Toggling filter for tag ${tagId}`)
    
    // Find the tag to get its display value
    const targetTag = availableFilterTags.find(tag => tag.id === tagId)
    if (!targetTag) {
      console.warn(`[useTagFiltering] Tag with id ${tagId} not found in available filter tags`)
      return
    }
    
    const displayValue = targetTag.display_value.toLowerCase()
    
    setActiveTagIds(prevActiveTagIds => {
      if (prevActiveTagIds.includes(displayValue)) {
        // Remove tag from active filters
        const newActiveTagIds = prevActiveTagIds.filter(id => id !== displayValue)
        console.log(`[useTagFiltering] Removed tag "${targetTag.display_value}", active filters:`, newActiveTagIds)
        return newActiveTagIds
      } else {
        // Add tag to active filters
        const newActiveTagIds = [...prevActiveTagIds, displayValue]
        console.log(`[useTagFiltering] Added tag "${targetTag.display_value}", active filters:`, newActiveTagIds)
        return newActiveTagIds
      }
    })
  }, [availableFilterTags])

  const clearAllFilters = useCallback(() => {
    console.log('[useTagFiltering] Clearing all filters')
    setActiveTagIds([])
  }, [])

  return {
    activeTagIds,
    filteredPhotos,
    isFiltering,
    availableFilterTags,
    toggleTag,
    clearAllFilters,
  }
}