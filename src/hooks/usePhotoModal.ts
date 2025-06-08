// © 2025 Mark Hustad — MIT License
import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Photo } from '../types'

export interface UsePhotoModalReturn {
  // Core state
  selectedPhotoIndex: number | null
  selectedPhoto: Photo | null
  isModalOpen: boolean
  
  // Actions
  openModal: (photo: Photo) => void
  closeModal: () => void
  showNextPhoto: () => void
  showPreviousPhoto: () => void
  
  // Derived state for modal
  canNavigateNext: boolean
  canNavigatePrevious: boolean
  currentIndex: number
  totalPhotos: number
}

export const usePhotoModal = (photos: Photo[]): UsePhotoModalReturn => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  // Handle photos array changes while modal is open
  useEffect(() => {
    if (selectedPhotoIndex !== null && photos.length > 0) {
      // Get the currently selected photo
      const currentPhoto = photos[selectedPhotoIndex]
      
      if (!currentPhoto) {
        // Index is now out of bounds, close modal
        setSelectedPhotoIndex(null)
        return
      }

      // If we have a valid photo at the current index, we need to check
      // if it's the same photo we originally selected (by ID)
      // This handles cases where array order changed
      
      // For now, keep the simple approach: if the index exists, use it
      // The more complex logic of tracking photo by ID across array changes
      // would require storing the original photo ID, which we'll skip for this implementation
    } else if (selectedPhotoIndex !== null && photos.length === 0) {
      // Photos array became empty, close modal
      setSelectedPhotoIndex(null)
    }
  }, [photos, selectedPhotoIndex])

  // Derived state
  const selectedPhoto = useMemo(() => {
    if (selectedPhotoIndex !== null && photos[selectedPhotoIndex]) {
      return photos[selectedPhotoIndex]
    }
    return null
  }, [photos, selectedPhotoIndex])

  const isModalOpen = useMemo(() => {
    return selectedPhotoIndex !== null && selectedPhoto !== null
  }, [selectedPhotoIndex, selectedPhoto])

  const canNavigateNext = useMemo(() => {
    return selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1
  }, [selectedPhotoIndex, photos.length])

  const canNavigatePrevious = useMemo(() => {
    return selectedPhotoIndex !== null && selectedPhotoIndex > 0
  }, [selectedPhotoIndex])

  const currentIndex = useMemo(() => {
    return selectedPhotoIndex ?? -1
  }, [selectedPhotoIndex])

  const totalPhotos = useMemo(() => {
    return photos.length
  }, [photos.length])

  // Actions
  const openModal = useCallback((photo: Photo) => {
    console.log(`[usePhotoModal] Opening modal for photo ${photo.id}`)
    
    if (photos.length === 0) {
      console.warn('[usePhotoModal] Cannot open modal: photos array is empty')
      return
    }

    const index = photos.findIndex(p => p.id === photo.id)
    if (index !== -1) {
      setSelectedPhotoIndex(index)
      console.log(`[usePhotoModal] Modal opened with photo at index ${index}`)
    } else {
      console.warn('[usePhotoModal] Clicked photo not found in currently displayed photos')
      setSelectedPhotoIndex(null)
    }
  }, [photos])

  const closeModal = useCallback(() => {
    console.log('[usePhotoModal] Closing modal')
    setSelectedPhotoIndex(null)
  }, [])

  const showNextPhoto = useCallback(() => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1
      console.log(`[usePhotoModal] Navigating to next photo (index ${newIndex})`)
      setSelectedPhotoIndex(newIndex)
    } else {
      console.log('[usePhotoModal] Cannot navigate to next photo - at end or modal closed')
    }
  }, [selectedPhotoIndex, photos.length])

  const showPreviousPhoto = useCallback(() => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1
      console.log(`[usePhotoModal] Navigating to previous photo (index ${newIndex})`)
      setSelectedPhotoIndex(newIndex)
    } else {
      console.log('[usePhotoModal] Cannot navigate to previous photo - at beginning or modal closed')
    }
  }, [selectedPhotoIndex])

  return {
    selectedPhotoIndex,
    selectedPhoto,
    isModalOpen,
    openModal,
    closeModal,
    showNextPhoto,
    showPreviousPhoto,
    canNavigateNext,
    canNavigatePrevious,
    currentIndex,
    totalPhotos,
  }
}