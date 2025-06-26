// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo } from 'react'
import type { Photo, Tag } from '../types'

export type FilterLogic = 'AND' | 'OR'

export interface UseTagFilteringOptions {
  filterLogic?: FilterLogic
}

export interface UseTagFilteringReturn {
  // State
  activeTagIds: string[]
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  filterLogic: FilterLogic
  
  // Actions
  toggleTag: (tagId: string) => void
  clearAllFilters: () => void
  setFilterLogic: (logic: FilterLogic) => void
}

export const useTagFiltering = (
  photos: Photo[],
  options: UseTagFilteringOptions = {}
): UseTagFilteringReturn => {
  const { filterLogic: initialFilterLogic = 'AND' } = options
  
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [filterLogic, setFilterLogic] = useState<FilterLogic>(initialFilterLogic)

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

      if (filterLogic === 'AND') {
        // AND logic: photo must have ALL selected tags (by display value)
        return activeTagIds.every(activeTagId => 
          photoTagDisplayValues.includes(activeTagId.toLowerCase())
        )
      } else {
        // OR logic: photo must have AT LEAST ONE selected tag (by display value)
        return activeTagIds.some(activeTagId => 
          photoTagDisplayValues.includes(activeTagId.toLowerCase())
        )
      }
    })
  }, [photos, activeTagIds, filterLogic])

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

  const setFilterLogicCallback = useCallback((logic: FilterLogic) => {
    console.log(`[useTagFiltering] Changing filter logic to ${logic}`)
    setFilterLogic(logic)
  }, [])

  return {
    activeTagIds,
    filteredPhotos,
    isFiltering,
    availableFilterTags,
    filterLogic,
    toggleTag,
    clearAllFilters,
    setFilterLogic: setFilterLogicCallback,
  }
}