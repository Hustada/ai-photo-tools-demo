// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo } from 'react'
import type { Photo, Tag } from '../types'

export interface UseTagFilteringOptions {
  showArchivedPhotos?: boolean; // Whether to include archived photos in results
}

export interface UseTagFilteringReturn {
  // State
  activeTagIds: string[] // Keeping for backward compatibility
  activeTagDisplayValues: string[] // The actual display values being filtered
  filteredPhotos: Photo[]
  isFiltering: boolean
  availableFilterTags: Tag[]
  filterLogic: 'AND' | 'OR'
  
  // Actions
  toggleTag: (tagIdOrDisplayValue: string) => void
  clearAllFilters: () => void
  setFilterLogic: (logic: 'AND' | 'OR') => void
}

export const useTagFiltering = (
  photos: Photo[],
  options: UseTagFilteringOptions = {}
): UseTagFilteringReturn => {
  const { showArchivedPhotos = false } = options;
  const [activeTagDisplayValues, setActiveTagDisplayValues] = useState<string[]>([])
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
    if (activeTagDisplayValues.length === 0) {
      return photosToFilter;
    }

    // Apply tag filtering by display value
    return photosToFilter.filter(photo => {
      if (!photo.tags || !Array.isArray(photo.tags)) {
        return false
      }

      // Get all display values from the photo's tags (normalized to lowercase)
      const photoTagDisplayValues = photo.tags
        .filter(tag => tag && tag.display_value)
        .map(tag => tag.display_value.toLowerCase())

      // Normalize active display values to lowercase for comparison
      const normalizedActiveValues = activeTagDisplayValues.map(v => v.toLowerCase())

      if (filterLogic === 'AND') {
        // AND logic: photo must have ALL selected tags
        return normalizedActiveValues.every(activeValue => 
          photoTagDisplayValues.includes(activeValue)
        )
      } else {
        // OR logic: photo must have AT LEAST ONE selected tag
        return normalizedActiveValues.some(activeValue => 
          photoTagDisplayValues.includes(activeValue)
        )
      }
    })
  }, [photos, activeTagDisplayValues, filterLogic, showArchivedPhotos])

  // Derived state
  const isFiltering = useMemo(() => {
    return activeTagDisplayValues.length > 0
  }, [activeTagDisplayValues.length])

  // Create activeTagIds for backward compatibility (maps display values back to IDs)
  const activeTagIds = useMemo(() => {
    return availableFilterTags
      .filter(tag => activeTagDisplayValues.includes(tag.display_value))
      .map(tag => tag.id)
  }, [activeTagDisplayValues, availableFilterTags])

  // Actions
  const toggleTag = useCallback((tagIdOrDisplayValue: string) => {
    // First check if it's a display value directly
    let displayValue = tagIdOrDisplayValue;
    
    // If it looks like an ID (UUID format), try to find the corresponding display value
    const tag = availableFilterTags.find(t => t.id === tagIdOrDisplayValue);
    if (tag) {
      displayValue = tag.display_value;
    }
    
    console.log(`[useTagFiltering] Toggling filter for tag "${displayValue}"`)
    
    setActiveTagDisplayValues(prevActiveValues => {
      if (prevActiveValues.includes(displayValue)) {
        // Remove tag from active filters
        const newActiveValues = prevActiveValues.filter(v => v !== displayValue)
        console.log(`[useTagFiltering] Removed tag "${displayValue}", active filters:`, newActiveValues)
        return newActiveValues
      } else {
        // Add tag to active filters
        const newActiveValues = [...prevActiveValues, displayValue]
        console.log(`[useTagFiltering] Added tag "${displayValue}", active filters:`, newActiveValues)
        return newActiveValues
      }
    })
  }, [availableFilterTags])

  const clearAllFilters = useCallback(() => {
    console.log('[useTagFiltering] Clearing all filters')
    setActiveTagDisplayValues([])
  }, [])

  return {
    activeTagIds, // For backward compatibility
    activeTagDisplayValues,
    filteredPhotos,
    isFiltering,
    availableFilterTags,
    filterLogic,
    toggleTag,
    clearAllFilters,
    setFilterLogic,
  }
}