// © 2025 Mark Hustad — MIT License
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PhotoCard, { type PhotoCardAiSuggestionState } from '../PhotoCard'
import { UserContextProvider } from '../../contexts/UserContext'
import { ScoutAiProvider } from '../../contexts/ScoutAiContext'
import type { Photo, Tag } from '../../types'

// Mock IntersectionObserver for LazyImage
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});

// Mock Image constructor for LazyImage
Object.defineProperty(global, 'Image', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation(() => ({
    onload: null,
    onerror: null,
    src: '',
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0
  }))
});

// Mock imageUtils for LazyImage
vi.mock('../../utils/imageUtils', () => ({
  createPlaceholderDataUrl: vi.fn().mockReturnValue('data:image/png;base64,placeholder'),
  detectImageFormatSupport: vi.fn().mockReturnValue({ webp: true, avif: false }),
  getOptimizedImageUrl: vi.fn().mockImplementation((url) => url),
  preloadImage: vi.fn(),
  isInViewport: vi.fn().mockReturnValue(true)
}));

// Mock UserContext
vi.mock('../../contexts/UserContext', async () => {
  const actual = await vi.importActual('../../contexts/UserContext')
  return {
    ...actual,
    useUserContext: vi.fn(() => ({
      userSettings: {
        retentionPolicy: {
          archiveRetentionDays: 30,
          deletionGraceDays: 7,
          notificationDaysBefore: 3,
          enabled: true,
        },
        deletionNotifications: [],
      },
    })),
  }
})

// Mock localStorage for API key
const mockLocalStorage = {
  getItem: vi.fn((key: string) => {
    if (key === 'companyCamApiKey' || key === 'companycam_api_key') {
      return 'test-api-key';
    }
    if (key === 'archivedPhotos') {
      return '[]';
    }
    return null;
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock companyCamService needed by UserContext
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'user-1',
      email_address: 'test@example.com',
      status: 'active',
      company_id: 'company-1'
    }),
    getCompanyDetails: vi.fn().mockResolvedValue({
      id: 'company-1',
      name: 'Test Company'
    }),
    getProjects: vi.fn().mockResolvedValue([])
  }
}))

// Mock hooks needed by ScoutAiContext
vi.mock('../../hooks/useVisualSimilarity', () => ({
  useVisualSimilarity: () => ({
    state: {
      isAnalyzing: false,
      progress: 0,
      error: null,
      similarityGroups: [],
      filteredGroups: [],
      allGroups: [],
      similarityMatrix: new Map()
    },
    analyzeSimilarity: vi.fn(),
    getSimilarityScore: vi.fn(),
    getGroupForPhoto: vi.fn(),
    getAllGroups: vi.fn(),
    getFilteredGroups: vi.fn(),
    clearAnalysis: vi.fn(),
    cancelAnalysis: vi.fn()
  })
}))

vi.mock('../../hooks/useAnalysisTracking', () => ({
  useAnalysisTracking: () => ({
    markPhotoAnalyzed: vi.fn().mockResolvedValue({ success: true }),
    markPhotosAnalyzed: vi.fn().mockResolvedValue({ success: true, results: [] }),
    getAnalysisHistory: vi.fn().mockReturnValue([]),
    clearAnalysisHistory: vi.fn(),
  })
}))

// Mock data
const mockPhoto: Photo = {
  id: 'test-photo-123',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Contractor',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'thumbnail', uri: 'https://example.com/thumb.jpg', url: 'https://example.com/thumb.jpg' },
    { type: 'web', uri: 'https://example.com/web.jpg', url: 'https://example.com/web.jpg' },
    { type: 'original', uri: 'https://example.com/original.jpg', url: 'https://example.com/original.jpg' }
  ],
  hash: 'abc123',
  description: 'Roofing work in progress on residential home',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: 1640995200000,
  created_at: 1640995200000,
  updated_at: 1640995200000,
  tags: [
    {
      id: 'tag-1',
      company_id: 'company-1',
      display_value: 'Roofing',
      value: 'roofing',
      created_at: 1640995200000,
      updated_at: 1640995200000,
      isAiEnhanced: false
    },
    {
      id: 'tag-2',
      company_id: 'company-1',
      display_value: 'Progress',
      value: 'progress',
      created_at: 1640995200000,
      updated_at: 1640995200000,
      isAiEnhanced: true
    }
  ]
}

const mockPhotoWithoutTags: Photo = {
  ...mockPhoto,
  id: 'test-photo-no-tags',
  tags: [],
  description: null
}

const mockAiSuggestionData: PhotoCardAiSuggestionState = {
  suggestedTags: ['shingles', 'installation'],
  suggestedDescription: 'Asphalt shingle installation in progress',
  isSuggesting: false,
  suggestionError: null,
  persistedDescription: 'Previous AI description',
  persistedAcceptedTags: ['roofing', 'residential'],
  isLoadingPersisted: false,
  persistedError: null
}

// Helper function to render with necessary providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ScoutAiProvider userId="test-user">
        <UserContextProvider>
          {ui}
        </UserContextProvider>
      </ScoutAiProvider>
    </MemoryRouter>
  )
}

describe('PhotoCard', () => {
  const mockOnPhotoClick = vi.fn()
  const mockOnTagClick = vi.fn()
  const mockOnAddTagToCompanyCam = vi.fn()
  const mockOnAddAiTag = vi.fn()
  const mockOnFetchAiSuggestions = vi.fn()

  const defaultProps = {
    photo: mockPhoto,
    onPhotoClick: mockOnPhotoClick,
    onTagClick: mockOnTagClick,
    onAddTagToCompanyCam: mockOnAddTagToCompanyCam,
    onAddAiTag: mockOnAddAiTag,
    onFetchAiSuggestions: mockOnFetchAiSuggestions
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render photo card with basic information', async () => {
      const { container } = renderWithProviders(<PhotoCard {...defaultProps} />)
      
      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByText('John Contractor')).toBeInTheDocument()
      })
      
      expect(screen.getByText('John Contractor')).toBeInTheDocument()
      expect(screen.getByText('Roofing work in progress on residential home')).toBeInTheDocument()
    })

    it('should render photo image', async () => {
      renderWithProviders(<PhotoCard {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByAltText('Roofing work in progress on residential home')).toBeInTheDocument()
      })

      const image = screen.getByAltText('Roofing work in progress on residential home')
      expect(image).toBeInTheDocument()
    })

    it('should show "No Image Available" when no image URI exists', () => {
      const photoWithoutImage = {
        ...mockPhoto,
        uris: [],
        photo_url: ''
      }

      renderWithProviders(<PhotoCard {...defaultProps} photo={photoWithoutImage} />)

      expect(screen.getByText('No Image Available')).toBeInTheDocument()
    })

    it('should handle missing description gracefully', async () => {
      renderWithProviders(<PhotoCard {...defaultProps} photo={mockPhotoWithoutTags} />)

      await waitFor(() => {
        expect(screen.getByText('John Contractor')).toBeInTheDocument()
      })
      expect(screen.getByText('John Contractor')).toBeInTheDocument()
      expect(screen.queryByText('Roofing work in progress on residential home')).not.toBeInTheDocument()
    })

    it('should handle missing creator name', async () => {
      const photoWithoutCreator = {
        ...mockPhoto,
        creator_name: ''
      }

      renderWithProviders(<PhotoCard {...defaultProps} photo={photoWithoutCreator} />)

      await waitFor(() => {
        expect(screen.getByText('Unknown Creator')).toBeInTheDocument()
      })
      expect(screen.getByText('Unknown Creator')).toBeInTheDocument()
    })
  })

  describe('Tag rendering', () => {
    it('should render all photo tags', () => {
      renderWithProviders(<PhotoCard {...defaultProps} />)

      expect(screen.getByText('Roofing')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })

    it('should show "No tags" when photo has no tags', () => {
      renderWithProviders(<PhotoCard {...defaultProps} photo={mockPhotoWithoutTags} />)

      expect(screen.getByText('No tags')).toBeInTheDocument()
    })



    it('should handle tag clicks when onTagClick is provided', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} />)

      const tag = screen.getByText('Roofing')
      await user.click(tag)

      expect(mockOnTagClick).toHaveBeenCalledWith('tag-1')
    })

  })

  describe('Photo click handling', () => {
    it('should call onPhotoClick when card is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} />)

      // Click on the image to trigger photo click
      const image = screen.getByAltText('Roofing work in progress on residential home')
      await user.click(image)

      expect(mockOnPhotoClick).toHaveBeenCalledWith(mockPhoto)
    })

    it('should not trigger photo click when tag is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} />)

      const tag = screen.getByText('Roofing')
      await user.click(tag)

      expect(mockOnPhotoClick).not.toHaveBeenCalled()
      expect(mockOnTagClick).toHaveBeenCalledWith('tag-1')
    })
  })

  describe('AI Suggestions', () => {
    it('should show AI suggestion button when no suggestions exist', () => {
      renderWithProviders(<PhotoCard {...defaultProps} />)

      expect(screen.getByText('Suggest Tags')).toBeInTheDocument()
    })

    it('should show loading state when fetching suggestions', async () => {
      const loadingAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        isSuggesting: true,
        suggestedTags: [],
        suggestedDescription: ''
      }

      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={loadingAiData} />)

      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      })
      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      expect(screen.queryByText('Suggest Tags')).not.toBeInTheDocument()
    })

    it('should call onFetchAiSuggestions when AI button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'test-photo-123',
        'https://example.com/web.jpg'
      )
    })

    it('should use original URI if web URI is not available', async () => {
      const user = userEvent.setup()
      const photoWithoutWeb = {
        ...mockPhoto,
        uris: [
          { type: 'thumbnail', uri: 'https://example.com/thumb.jpg', url: 'https://example.com/thumb.jpg' },
          { type: 'original', uri: 'https://example.com/original.jpg', url: 'https://example.com/original.jpg' }
        ]
      }

      renderWithProviders(<PhotoCard {...defaultProps} photo={photoWithoutWeb} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'test-photo-123',
        'https://example.com/original.jpg'
      )
    })

    it('should use photo_url as final fallback for AI suggestions', async () => {
      const user = userEvent.setup()
      const photoMinimal = {
        ...mockPhoto,
        uris: []
      }

      renderWithProviders(<PhotoCard {...defaultProps} photo={photoMinimal} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'test-photo-123',
        'https://example.com/photo.jpg'
      )
    })

    it('should not call onFetchAiSuggestions when no suitable URL is found', async () => {
      const user = userEvent.setup()
      const photoWithoutUrls = {
        ...mockPhoto,
        uris: [],
        photo_url: ''
      }

      renderWithProviders(<PhotoCard {...defaultProps} photo={photoWithoutUrls} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).not.toHaveBeenCalled()
    })

    it('should display AI suggested tags when available', () => {
      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      expect(screen.getByText('shingles')).toBeInTheDocument()
      expect(screen.getByText('installation')).toBeInTheDocument()
    })

    it('should display AI suggested description when available', () => {
      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      expect(screen.getByText('Asphalt shingle installation in progress')).toBeInTheDocument()
    })

    it('should show error message when AI suggestion fails', () => {
      const errorAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        suggestedTags: [],
        suggestedDescription: '',
        suggestionError: 'Failed to fetch AI suggestions'
      }

      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={errorAiData} />)

      expect(screen.getByText(/Failed to fetch AI suggestions/)).toBeInTheDocument()
    })

    it('should allow adding AI suggested tags', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('shingles') // Get the first suggested tag button
      await user.click(tagButton)

      expect(mockOnAddAiTag).toHaveBeenCalledWith(
        'test-photo-123',
        'shingles',
        mockPhoto
      )
    })

    it('should not trigger photo click when AI suggestion button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<PhotoCard {...defaultProps} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnPhotoClick).not.toHaveBeenCalled()
    })
  })

  describe('AI Tag Error Handling', () => {
    it('should handle AI tag addition errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockOnAddAiTag.mockRejectedValue(new Error('Failed to add tag'))
      
      renderWithProviders(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('shingles')
      await user.click(tagButton)

      expect(mockOnAddAiTag).toHaveBeenCalledWith(
        'test-photo-123',
        'shingles',
        mockPhoto
      )
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "[PhotoCard] Error calling onAddAiTag for tag 'shingles':",
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })
  })

})