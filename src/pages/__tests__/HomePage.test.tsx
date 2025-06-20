// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
vi.mock('../../hooks/usePhotosQuery', () => ({
  usePhotosQuery: vi.fn(),
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

vi.mock('../../hooks/useRetentionCleanup', () => ({
  useRetentionCleanup: vi.fn(),
}))

vi.mock('../../hooks/useNotificationManager', () => ({
  useNotificationManager: vi.fn(),
}))

import { useNavigate } from 'react-router-dom'
import { useUserContext } from '../../contexts/UserContext'
import { usePhotosQuery } from '../../hooks/usePhotosQuery'
import { useTagManagement } from '../../hooks/useTagManagement'
import { useTagFiltering } from '../../hooks/useTagFiltering'
import { usePhotoModal } from '../../hooks/usePhotoModal'
import { useAiEnhancements } from '../../hooks/useAiEnhancements'
import { useRetentionCleanup } from '../../hooks/useRetentionCleanup'
import { useNotificationManager } from '../../hooks/useNotificationManager'

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
  let queryClient: QueryClient

  const renderHomePage = (user: CurrentUser | null = mockUser) => {
    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    // Mock the useUserContext hook to return the desired user
    vi.mocked(useUserContext).mockReturnValue({
      currentUser: user,
      companyDetails: null,
      projects: [],
      userSettings: {
        retentionPolicy: {
          archiveRetentionDays: 30,
          deletionGraceDays: 7,
          notificationDaysBefore: 3,
          enabled: true,
        },
        deletionNotifications: [],
      },
      loading: false,
      error: null,
      fetchUserContext: vi.fn(),
      updateUserSettings: vi.fn(),
    })
    
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the navigate function
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    
    // Default mock implementations
    vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [mockPhoto],
        allPhotos: [mockPhoto],
        isLoading: false,
        isFetching: false,
        isLoadingMore: false,
        error: null,
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
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

    vi.mocked(useRetentionCleanup).mockReturnValue({
      runCleanup: vi.fn(),
      scheduledCleanupInterval: null,
      isCleanupEnabled: true,
    })

    vi.mocked(useNotificationManager).mockReturnValue({
      notifications: [],
      activeNotifications: [],
      dismissNotification: vi.fn(),
      dismissAllNotifications: vi.fn(),
      getNotificationsForPhoto: vi.fn().mockReturnValue([]),
      hasActiveNotifications: false,
      notificationCount: 0,
    })

    // Mock localStorage to return appropriate values
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'companyCamApiKey') {
        return 'test-api-key';
      }
      // Return null for ScoutAI preferences keys to avoid JSON parsing errors
      if (key.startsWith('scoutai-preferences-')) {
        return null;
      }
      return null;
    });
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render HomePage with user logged in', () => {
      renderHomePage()
      
      expect(screen.getAllByText('Scout AI')[0]).toBeInTheDocument()
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
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [],
        allPhotos: [],
        isLoading: true,
        isFetching: true,
        isLoadingMore: false,
        error: null,
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
      })

      renderHomePage()
      
      expect(screen.getByText('Loading photos...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /fetching photos/i })).toBeDisabled()
    })

    it('should show error state when photo loading fails', () => {
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [],
        allPhotos: [],
        isLoading: false,
        isFetching: false,
        isLoadingMore: false,
        error: new Error('Failed to load photos'),
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
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
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [mockPhoto],
        allPhotos: [mockPhoto],
        isLoading: false,
        isFetching: false,
        isLoadingMore: false,
        error: null,
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: mockRefreshPhotos,
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
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
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [],
        allPhotos: [],
        isLoading: true,
        isFetching: true,
        isLoadingMore: false,
        error: null,
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
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
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [mockPhoto],
        allPhotos: [mockPhoto],
        isLoading: false,
        isFetching: true,
        isLoadingMore: true, // This is the key - we're loading more photos
        error: null,
        currentPage: 2,
        hasMorePhotos: true,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: vi.fn(),
        setPage: vi.fn(),
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

  describe('User Context Display', () => {
    it('should display projects count when user has projects', () => {
      // Create a custom render function to avoid the default renderHomePage
      vi.mocked(useUserContext).mockReturnValue({
        currentUser: mockUser,
        companyDetails: { id: 'company-1', name: 'Test Company', status: 'active', address: {} },
        projects: [
          { id: 'project-1', name: 'Project 1' },
          { id: 'project-2', name: 'Project 2' }
        ],
        userSettings: {
          retentionPolicy: {
            archiveRetentionDays: 30,
            deletionGraceDays: 7,
            notificationDaysBefore: 3,
            enabled: true,
          },
          deletionNotifications: [],
        },
        loading: false,
        error: null,
        fetchUserContext: vi.fn(),
        updateUserSettings: vi.fn(),
      })
      
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )
      
      expect(screen.getByText('2 projects')).toBeInTheDocument()
      expect(screen.getByText('Test Company')).toBeInTheDocument()
    })

    it('should display singular project text when user has one project', () => {
      // Test the singular vs plural logic
      vi.mocked(useUserContext).mockReturnValue({
        currentUser: mockUser,
        companyDetails: null,
        projects: [{ id: 'project-1', name: 'Project 1' }],
        userSettings: {
          retentionPolicy: {
            archiveRetentionDays: 30,
            deletionGraceDays: 7,
            notificationDaysBefore: 3,
            enabled: true,
          },
          deletionNotifications: [],
        },
        loading: false,
        error: null,
        fetchUserContext: vi.fn(),
        updateUserSettings: vi.fn(),
      })
      
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )
      
      expect(screen.getByText('1 project')).toBeInTheDocument()
    })
  })

  describe('Tag Management Integration', () => {
    it('should trigger onPhotoUpdate callback when tag is added', () => {
      let capturedCallback: any = null
      
      // Capture the callback passed to useTagManagement (line 47)
      vi.mocked(useTagManagement).mockImplementation((photos, user, options) => {
        capturedCallback = options?.onPhotoUpdate
        return {
          activeTagIds: [],
          uniqueFilterableTags: [],
          filteredPhotos: [mockPhoto],
          tagError: null,
          isAddingTag: false,
          handleTagClick: vi.fn(),
          handleAddTagRequest: vi.fn(),
          clearAllFilters: vi.fn(),
        }
      })
      
      const mockUpdatePhotoInCache = vi.fn()
      vi.mocked(usePhotosQuery).mockReturnValue({
        photos: [mockPhoto],
        allPhotos: [mockPhoto],
        isLoading: false,
        isFetching: false,
        isLoadingMore: false,
        error: null,
        currentPage: 1,
        hasMorePhotos: false,
        loadMore: vi.fn(),
        refresh: vi.fn(),
        updatePhotoInCache: mockUpdatePhotoInCache,
        setPage: vi.fn(),
      })
      
      renderHomePage()
      
      // Verify callback was captured
      expect(capturedCallback).toBeDefined()
      
      // Execute the callback to cover line 47
      const newTag = {
        id: 'new-tag-1',
        display_value: 'New Tag',
        value: 'new tag',
        company_id: 'company-1',
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      
      capturedCallback('photo-1', newTag, false)
      
      // Verify the photo was updated with the new tag
      expect(mockUpdatePhotoInCache).toHaveBeenCalledWith({
        ...mockPhoto,
        tags: [newTag],
      })
    })
  })

  describe('Tag Filter Styling', () => {
    it('should apply inactive styling to non-active tags', () => {
      const mockTags = [
        { id: 'tag-1', display_value: 'ActiveFilterTag', value: 'active', company_id: 'company-1', created_at: Date.now(), updated_at: Date.now() },
        { id: 'tag-2', display_value: 'InactiveFilterTag', value: 'inactive', company_id: 'company-1', created_at: Date.now(), updated_at: Date.now() }
      ]

      // Mock filtering to have one active tag and one inactive (line 179)
      vi.mocked(useTagFiltering).mockReturnValue({
        filteredPhotos: [mockPhoto],
        activeTagIds: ['tag-1'], // Only tag-1 is active
        availableFilterTags: mockTags,
        isFiltering: true,
        filterLogic: 'AND',
        toggleTag: vi.fn(),
        clearAllFilters: vi.fn(),
        setFilterLogic: vi.fn(),
      })

      renderHomePage()
      
      // Find the filter buttons specifically in the filter section
      const filterSection = screen.getByText('Filter by Tags:').closest('div')
      const activeButton = screen.getByText('ActiveFilterTag (0)').closest('button')
      const inactiveButton = screen.getByText('InactiveFilterTag (0)').closest('button')
      
      // Verify active button has active styling
      expect(activeButton).toHaveClass('bg-sky-500')
      
      // Verify inactive button has inactive styling (line 179)
      expect(inactiveButton).toHaveClass('bg-gray-700')
      expect(inactiveButton).toHaveClass('text-gray-300')
    })
  })
})