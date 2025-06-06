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

  // Compute available filter tags from all photos (deduplicated)
  const availableFilterTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    
    photos.forEach(photo => {
      if (photo.tags && Array.isArray(photo.tags)) {
        photo.tags.forEach(tag => {
          if (tag && tag.id && typeof tag.id === 'string') {
            tagMap.set(tag.id, tag)
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
  }, [photos, activeTagIds, filterLogic])

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
        console.log(`[useTagFiltering] Removed tag ${tagId}, active filters:`, newActiveTagIds)
        return newActiveTagIds
      } else {
        // Add tag to active filters
        const newActiveTagIds = [...prevActiveTagIds, tagId]
        console.log(`[useTagFiltering] Added tag ${tagId}, active filters:`, newActiveTagIds)
        return newActiveTagIds
      }
    })
  }, [])

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