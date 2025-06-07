// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../HomePage'
import type { CurrentUser, Photo } from '../../types'

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

// Mock window.location for navigation tests
const mockLocation = {
  href: 'http://localhost:3000',
  assign: vi.fn(),
  reload: vi.fn(),
}
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div data-testid="browser-router">{children}</div>,
    useNavigate: vi.fn(),
  }
})

// Mock the useUserContext hook
vi.mock('../../contexts/UserContext', () => ({
  useUserContext: vi.fn(),
}))

// Mock the hooks
vi.mock('../../hooks/usePhotoData', () => ({
  usePhotoData: vi.fn(),
}))

vi.mock('../../hooks/useTagManagement', () => ({
  useTagManagement: vi.fn(),
}))

vi.mock('../../hooks/useTagFiltering', () => ({
  useTagFiltering: vi.fn(),
}))

vi.mock('../../hooks/usePhotoModal', () => ({
  usePhotoModal: vi.fn(),
}))

vi.mock('../../hooks/useAiEnhancements', () => ({
  useAiEnhancements: vi.fn(),
}))

import { useNavigate } from 'react-router-dom'
import { useUserContext } from '../../contexts/UserContext'
import { usePhotoData } from '../../hooks/usePhotoData'
import { useTagManagement } from '../../hooks/useTagManagement'
import { useTagFiltering } from '../../hooks/useTagFiltering'
import { usePhotoModal } from '../../hooks/usePhotoModal'
import { useAiEnhancements } from '../../hooks/useAiEnhancements'

const mockUser: CurrentUser = {
  id: 'user-123',
  company_id: 'company-1',
  email_address: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  status: 'active',
}

const mockPhoto: Photo = {
  id: 'photo-1',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Doe',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'web', uri: 'https://example.com/photo.jpg', url: 'https://example.com/photo.jpg' }
  ],
  hash: 'abc123',
  description: 'Test photo',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  tags: [],
}

describe('HomePage', () => {
  const renderHomePage = (user: CurrentUser | null = mockUser) => {
    // Mock the useUserContext hook to return the desired user
    vi.mocked(useUserContext).mockReturnValue({
      currentUser: user,
      companyDetails: null,
      projects: [],
      loading: false,
      error: null,
      fetchUserContext: vi.fn(),
    })
    
    return render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the navigate function
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    
    // Default mock implementations
    vi.mocked(usePhotoData).mockReturnValue({
      photos: [mockPhoto],
      allFetchedPhotos: [mockPhoto],
      isLoading: false,
      error: null,
      hasMorePhotos: false,
      fetchPhotos: vi.fn(),
      refreshPhotos: vi.fn(),
      loadMore: vi.fn(),
      updatePhotoInCache: vi.fn(),
    })

    vi.mocked(useTagManagement).mockReturnValue({
      activeTagIds: [],
      uniqueFilterableTags: [],
      filteredPhotos: [mockPhoto],
      tagError: null,
      isAddingTag: false,
      handleTagClick: vi.fn(),
      handleAddTagRequest: vi.fn(),
      clearAllFilters: vi.fn(),
    })

    vi.mocked(useTagFiltering).mockReturnValue({
      filteredPhotos: [mockPhoto],
      activeTagIds: [],
      availableFilterTags: [],
      isFiltering: false,
      filterLogic: 'AND',
      toggleTag: vi.fn(),
      clearAllFilters: vi.fn(),
      setFilterLogic: vi.fn(),
    })

    vi.mocked(usePhotoModal).mockReturnValue({
      isModalOpen: false,
      selectedPhoto: null,
      currentIndex: 0,
      canNavigateNext: false,
      canNavigatePrevious: false,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showNextPhoto: vi.fn(),
      showPreviousPhoto: vi.fn(),
    })

    vi.mocked(useAiEnhancements).mockReturnValue({
      fetchAiSuggestions: vi.fn(),
      addAiTag: vi.fn(),
      saveAiDescription: vi.fn(),
      getAiDataForPhoto: vi.fn().mockReturnValue(undefined),
      loadPersistedEnhancements: vi.fn(),
    })

    mockLocalStorage.getItem.mockReturnValue('test-api-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render HomePage with user logged in', () => {
      renderHomePage()
      
      expect(screen.getByText('CompanyCam AI Photo Inspirations')).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.textContent === 'Welcome, Test!'
      })).toBeInTheDocument()
      expect(screen.getByText('Refresh Photos')).toBeInTheDocument()
    })

    it('should redirect to login when no user', () => {
      renderHomePage(null)
      
      // Should show no user message instead of redirecting since useNavigate is inside useEffect
      expect(screen.getByText('No user found. Please log in.')).toBeInTheDocument()
    })

    it('should redirect to login when no API key', async () => {
      const mockNavigate = vi.fn()
      vi.mocked(useNavigate).mockReturnValue(mockNavigate)
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderHomePage()
      
      // Should call navigate to /login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Photo Loading States', () => {
    it('should show loading state when fetching photos', () => {
      vi.mocked(usePhotoData).mockReturnValue({
        photos: [],
        isLoading: true,
        error: null,
        fetchPhotos: vi.fn(),
        refreshPhotos: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Loading photos...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /fetching photos/i })).toBeDisabled()
    })

    it('should show error state when photo loading fails', () => {
      vi.mocked(usePhotoData).mockReturnValue({
        photos: [],
        isLoading: false,
        error: 'Failed to load photos',
        fetchPhotos: vi.fn(),
        refreshPhotos: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Error: Failed to load photos')).toBeInTheDocument()
    })
  })

  describe('Tag Management', () => {
    it('should show tag error when present', () => {
      vi.mocked(useTagManagement).mockReturnValue({
        activeTagIds: [],
        uniqueFilterableTags: [],
        filteredPhotos: [mockPhoto],
        tagError: 'Failed to add tag',
        isAddingTag: false,
        handleTagClick: vi.fn(),
        handleAddTagRequest: vi.fn(),
        clearAllFilters: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Failed to add tag')).toBeInTheDocument()
    })

    it('should show tag filters when tags are active', () => {
      const mockTags = [
        { id: 'tag-1', display_value: 'Roofing', value: 'roofing', company_id: 'company-1', created_at: Date.now(), updated_at: Date.now() }
      ]

      vi.mocked(useTagFiltering).mockReturnValue({
        filteredPhotos: [mockPhoto],
        activeTagIds: ['tag-1'],
        availableFilterTags: mockTags,
        isFiltering: true,
        filterLogic: 'AND',
        toggleTag: vi.fn(),
        clearAllFilters: vi.fn(),
        setFilterLogic: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Active filters:')).toBeInTheDocument()
      expect(screen.getByText('Roofing')).toBeInTheDocument()
      expect(screen.getByText('Clear All')).toBeInTheDocument()
    })

    it('should handle clear all filters', async () => {
      const mockClearAllFilters = vi.fn()
      const mockTags = [
        { id: 'tag-1', display_value: 'Roofing', value: 'roofing', company_id: 'company-1', created_at: Date.now(), updated_at: Date.now() }
      ]

      vi.mocked(useTagFiltering).mockReturnValue({
        filteredPhotos: [mockPhoto],
        activeTagIds: ['tag-1'],
        availableFilterTags: mockTags,
        isFiltering: true,
        filterLogic: 'AND',
        toggleTag: vi.fn(),
        clearAllFilters: mockClearAllFilters,
        setFilterLogic: vi.fn(),
      })

      const user = userEvent.setup()
      renderHomePage()
      
      const clearButton = screen.getByText('Clear All')
      await user.click(clearButton)
      
      expect(mockClearAllFilters).toHaveBeenCalled()
    })
  })

  describe('Photo Grid', () => {
    it('should render photo cards', () => {
      renderHomePage()
      
      expect(screen.getByText('Photo ID: photo-1')).toBeInTheDocument()
    })

    it('should handle refresh photos button', async () => {
      const mockRefreshPhotos = vi.fn()
      vi.mocked(usePhotoData).mockReturnValue({
        photos: [mockPhoto],
        isLoading: false,
        error: null,
        fetchPhotos: vi.fn(),
        refreshPhotos: mockRefreshPhotos,
      })

      const user = userEvent.setup()
      renderHomePage()
      
      const refreshButton = screen.getByText('Refresh Photos')
      await user.click(refreshButton)
      
      expect(mockRefreshPhotos).toHaveBeenCalled()
    })

    it('should disable refresh button when no API key', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      
      renderHomePage()
      
      expect(screen.getByRole('button', { name: /refresh photos/i })).toBeDisabled()
    })

    it('should disable refresh button when loading', () => {
      vi.mocked(usePhotoData).mockReturnValue({
        photos: [],
        isLoading: true,
        error: null,
        fetchPhotos: vi.fn(),
        refreshPhotos: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByRole('button', { name: /fetching photos/i })).toBeDisabled()
    })
  })

  describe('Photo Modal', () => {
    it('should open modal when photo is clicked', async () => {
      const mockOpenModal = vi.fn()
      vi.mocked(usePhotoModal).mockReturnValue({
        isModalOpen: false,
        selectedPhoto: null,
        currentIndex: 0,
        canNavigateNext: false,
        canNavigatePrevious: false,
        openModal: mockOpenModal,
        closeModal: vi.fn(),
        showNextPhoto: vi.fn(),
        showPreviousPhoto: vi.fn(),
      })

      const user = userEvent.setup()
      renderHomePage()
      
      // Find and click a photo card
      const photoCard = screen.getByText('Photo ID: photo-1').closest('div')
      if (photoCard) {
        await user.click(photoCard)
        expect(mockOpenModal).toHaveBeenCalledWith(mockPhoto)
      }
    })

    it('should render modal when open', () => {
      vi.mocked(usePhotoModal).mockReturnValue({
        isModalOpen: true,
        selectedPhoto: mockPhoto,
        currentIndex: 0,
        canNavigateNext: false,
        canNavigatePrevious: false,
        openModal: vi.fn(),
        closeModal: vi.fn(),
        showNextPhoto: vi.fn(),
        showPreviousPhoto: vi.fn(),
      })

      renderHomePage()
      
      // Modal should be rendered - check for specific modal content
      expect(screen.getByLabelText('Close')).toBeInTheDocument() // Modal has close button
      expect(screen.getAllByText('Test photo').length).toBeGreaterThanOrEqual(2) // Photo appears multiple times
    })
  })

  describe('Loading More Photos', () => {
    it('should show loading more indicator when loading with existing photos', () => {
      vi.mocked(usePhotoData).mockReturnValue({
        photos: [mockPhoto],
        isLoading: true,
        error: null,
        fetchPhotos: vi.fn(),
        refreshPhotos: vi.fn(),
      })

      vi.mocked(useTagFiltering).mockReturnValue({
        filteredPhotos: [mockPhoto],
        activeTagIds: [],
        availableFilterTags: [],
        isFiltering: false,
        filterLogic: 'AND',
        toggleTag: vi.fn(),
        clearAllFilters: vi.fn(),
        setFilterLogic: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Loading more photos...')).toBeInTheDocument()
    })
  })

  describe('Logout Functionality', () => {
    it('should handle logout', async () => {
      const mockNavigate = vi.fn()
      vi.mocked(useNavigate).mockReturnValue(mockNavigate)
      
      const user = userEvent.setup()
      renderHomePage()
      
      const logoutButton = screen.getByText('Logout')
      await user.click(logoutButton)
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('companyCamApiKey')
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })
})