// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo } from 'react'
import type { Photo, Tag } from '../types'

export interface UseTagFilteringOptions {
  showArchivedPhotos?: boolean; // Whether to include archived photos in results
}

export interface UseTagFilteringReturn {
  // State
  activeTagIds: string[]
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  filterLogic: 'AND' | 'OR'
  
  // Actions
  toggleTag: (tagId: string) => void
  clearAllFilters: () => void
  setFilterLogic: (logic: 'AND' | 'OR') => void
}

export const useTagFiltering = (
  photos: Photo[],
  options: UseTagFilteringOptions = {}
): UseTagFilteringReturn => {
  const { showArchivedPhotos = false } = options;
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('OR')

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
    // First filter out archived photos unless showArchivedPhotos is true
    let photosToFilter = photos;
    if (!showArchivedPhotos) {
      photosToFilter = photos.filter(photo => photo.archive_state !== 'archived');
    }

    // If no tag filters are active, return all non-archived photos
    if (activeTagIds.length === 0) {
      return photosToFilter;
    }

    // Apply tag filtering
    return photosToFilter.filter(photo => {
      if (!photo.tags || !Array.isArray(photo.tags)) {
        return false
      }

      const photoTagIds = photo.tags
        .filter(tag => tag && tag.id)
        .map(tag => tag.id)

      if (filterLogic === 'AND') {
        // AND logic: photo must have ALL selected tags
        return activeTagIds.every(activeTagId => 
          photoTagIds.includes(activeTagId)
        )
      } else {
        // OR logic: photo must have AT LEAST ONE selected tag
        return activeTagIds.some(activeTagId => 
          photoTagIds.includes(activeTagId)
        )
      }
    })
  }, [photos, activeTagIds, filterLogic, showArchivedPhotos])

  // Derived state
  const isFiltering = useMemo(() => {
    return activeTagIds.length > 0
  }, [activeTagIds.length])

  // Actions
  const toggleTag = useCallback((tagId: string) => {
    console.log(`[useTagFiltering] Toggling filter for tag ${tagId}`)
    
    setActiveTagIds(prevActiveTagIds => {
      if (prevActiveTagIds.includes(tagId)) {
        // Remove tag from active filters
        const newActiveTagIds = prevActiveTagIds.filter(id => id !== tagId)
        console.log(`[useTagFiltering] Removed tag "${tagId}", active filters:`, newActiveTagIds)
        return newActiveTagIds
      } else {
        // Add tag to active filters
        const newActiveTagIds = [...prevActiveTagIds, tagId]
        console.log(`[useTagFiltering] Added tag "${tagId}", active filters:`, newActiveTagIds)
        return newActiveTagIds
      }
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    console.log('[useTagFiltering] Clearing all filters')
    setActiveTagIds([])
  }, [])

  return {
    activeTagIds,
    filteredPhotos,
    isFiltering,
    availableFilterTags,
    filterLogic,
    toggleTag,
    clearAllFilters,
    setFilterLogic,
  }
}