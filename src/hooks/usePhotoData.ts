// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useRef, useEffect } from 'react'
import { companyCamService } from '../services/companyCamService'
import type { Photo, Tag } from '../types'

// Local type for API enhancement response
interface ApiPhotoEnhancement {
  photo_id: string
  user_id: string
  ai_description?: string
  accepted_ai_tags: string[]
  created_at: string
  updated_at: string
  suggestion_source?: string
}

export interface UsePhotoDataReturn {
  // State
  photos: Photo[]
  allFetchedPhotos: Photo[]
  isLoading: boolean
  error: string | null
  currentPage: number
  hasMorePhotos: boolean
  
  // Actions
  fetchPhotos: (page: number) => Promise<void>
  loadMore: () => Promise<void>
  refreshPhotos: () => Promise<void>
  applyFilters: (tagIds: string[]) => void
  updatePhotoInCache: (photo: Photo) => void
}

export const usePhotoData = (): UsePhotoDataReturn => {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [allFetchedPhotos, setAllFetchedPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [hasMorePhotos, setHasMorePhotos] = useState<boolean>(true)
  
  // Keep track of applied filters for re-filtering after updates
  const activeFiltersRef = useRef<string[]>([])

  const fetchPhotos = useCallback(async (pageToFetch: number) => {
    console.log(`[usePhotoData] fetchPhotos called for page: ${pageToFetch}`)
    
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey')
    if (!apiKeyFromStorage) {
      setError('Please enter an API Key.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Fetch basic photos
      const fetchedBasicPhotos: Photo[] = await companyCamService.getPhotos(
        apiKeyFromStorage, 
        pageToFetch, 
        20
      )

      console.log(`[usePhotoData] Fetched ${fetchedBasicPhotos.length} basic photos for page ${pageToFetch}`)

      // 2. Process each photo with tags and AI enhancements
      const photosWithDetailsPromises = fetchedBasicPhotos.map(async (basicPhoto) => {
        try {
          // Fetch CompanyCam tags
          const companyCamTags = await companyCamService.getPhotoTags(apiKeyFromStorage, basicPhoto.id)
          
          let processedPhoto: Photo = {
            ...basicPhoto,
            tags: companyCamTags.map(tag => ({
              ...tag,
              id: tag.id.toString(),
              isAiEnhanced: false,
            })),
          }

          let finalDescription = processedPhoto.description
          let finalTags = [...processedPhoto.tags]

          // 3. Fetch AI enhancements
          try {
            const response = await fetch(`/api/ai-enhancements?photoId=${basicPhoto.id}`)
            
            if (response.ok) {
              const persistedAiData: ApiPhotoEnhancement = await response.json()
              console.log(`[usePhotoData] Persisted AI data for ${basicPhoto.id}:`, persistedAiData)

              // Apply AI description
              if (persistedAiData.ai_description) {
                finalDescription = persistedAiData.ai_description
              }

              // Apply AI tags
              if (persistedAiData.accepted_ai_tags && persistedAiData.accepted_ai_tags.length > 0) {
                const persistedAiDisplayValues = persistedAiData.accepted_ai_tags
                  .map(tagValue => tagValue.trim())
                  .filter(Boolean)

                persistedAiDisplayValues.forEach(aiTagValue => {
                  const aiTagValueLower = aiTagValue.toLowerCase()
                  const matchingExistingTag = finalTags.find(t => 
                    t.display_value.toLowerCase() === aiTagValueLower
                  )

                  if (matchingExistingTag) {
                    matchingExistingTag.isAiEnhanced = true
                  } else {
                    finalTags.push({
                      display_value: aiTagValue,
                      isAiEnhanced: true,
                      id: `ai_${basicPhoto.id}_${aiTagValue.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`,
                      company_id: 'AI_TAG',
                      value: aiTagValue,
                      created_at: Date.now(),
                      updated_at: Date.now(),
                    })
                  }
                })
              }
            } else if (response.status === 404) {
              console.log(`[usePhotoData] No persisted AI enhancements for ${basicPhoto.id} (404)`)
            } else {
              const errorText = await response.text()
              console.error(`[usePhotoData] Error fetching persisted AI for ${basicPhoto.id}: ${response.status} ${errorText}`)
            }
          } catch (aiErr: any) {
            console.error(`[usePhotoData] Network error fetching persisted AI for ${basicPhoto.id}:`, aiErr)
          }

          return {
            ...processedPhoto,
            description: finalDescription,
            tags: finalTags,
          }
        } catch (tagErr: any) {
          console.error(`[usePhotoData] Error processing photo ${basicPhoto.id}:`, tagErr)
          throw tagErr
        }
      })

      const fullyProcessedPhotos = await Promise.all(photosWithDetailsPromises)
      console.log('[usePhotoData] Fully processed photos:', fullyProcessedPhotos)

      // 4. Update state
      setAllFetchedPhotos(prevAllPhotos => {
        if (pageToFetch === 1) {
          return fullyProcessedPhotos
        }
        // For pagination, avoid duplicates
        const existingPhotoIds = new Set(prevAllPhotos.map(p => p.id))
        const newUniquePhotos = fullyProcessedPhotos.filter(p => !existingPhotoIds.has(p.id))
        return [...prevAllPhotos, ...newUniquePhotos]
      })

      setCurrentPage(pageToFetch)
      setHasMorePhotos(fetchedBasicPhotos.length === 20)
      
    } catch (err: any) {
      console.error('[usePhotoData] Error in fetchPhotos:', err)
      setError(err.message || 'Failed to fetch photos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update photos when allFetchedPhotos changes and no filters are applied
  useEffect(() => {
    if (activeFiltersRef.current.length === 0) {
      setPhotos(allFetchedPhotos)
    } else {
      // Re-apply current filters
      const filtered = allFetchedPhotos.filter(photo =>
        activeFiltersRef.current.every(filterTagId =>
          photo.tags?.some(photoTag => photoTag.id === filterTagId)
        )
      )
      setPhotos(filtered)
    }
  }, [allFetchedPhotos])

  const loadMore = useCallback(async () => {
    if (!hasMorePhotos || isLoading) return
    await fetchPhotos(currentPage + 1)
  }, [currentPage, hasMorePhotos, isLoading, fetchPhotos])

  const refreshPhotos = useCallback(async () => {
    await fetchPhotos(1)
  }, [fetchPhotos])

  const applyFilters = useCallback((tagIds: string[]) => {
    activeFiltersRef.current = tagIds
    
    if (tagIds.length === 0) {
      setPhotos(allFetchedPhotos)
      return
    }

    const filtered = allFetchedPhotos.filter(photo =>
      tagIds.every(filterTagId =>
        photo.tags?.some(photoTag => photoTag.id === filterTagId)
      )
    )
    setPhotos(filtered)
  }, [allFetchedPhotos])

  const updatePhotoInCache = useCallback((updatedPhoto: Photo) => {
    setAllFetchedPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === updatedPhoto.id ? updatedPhoto : photo
      )
    )
    
    // Re-apply current filters
    const currentFilters = activeFiltersRef.current
    if (currentFilters.length === 0) {
      setPhotos(prevPhotos => 
        prevPhotos.map(photo => 
          photo.id === updatedPhoto.id ? updatedPhoto : photo
        )
      )
    } else {
      // Will be handled by next effect cycle when allFetchedPhotos updates
      const filtered = allFetchedPhotos.map(photo => 
        photo.id === updatedPhoto.id ? updatedPhoto : photo
      ).filter(photo =>
        currentFilters.every(filterTagId =>
          photo.tags?.some(photoTag => photoTag.id === filterTagId)
        )
      )
      setPhotos(filtered)
    }
  }, [allFetchedPhotos])

  return {
    photos,
    allFetchedPhotos,
    isLoading,
    error,
    currentPage,
    hasMorePhotos,
    fetchPhotos,
    loadMore,
    refreshPhotos,
    applyFilters,
    updatePhotoInCache,
  }
}