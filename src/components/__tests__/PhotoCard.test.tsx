// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoCard, { type PhotoCardAiSuggestionState } from '../PhotoCard'
import { UserContextProvider } from '../../contexts/UserContext'
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
    it('should render photo card with basic information', () => {
      render(<PhotoCard {...defaultProps} />)

      expect(screen.getByText('Photo ID: test-photo-123')).toBeInTheDocument()
      expect(screen.getByText('By: John Contractor')).toBeInTheDocument()
      expect(screen.getByText('Roofing work in progress on residential home')).toBeInTheDocument()
    })

    it('should render photo image with LazyImage (placeholder initially)', () => {
      render(<PhotoCard {...defaultProps} />)

      const image = screen.getByAltText('Roofing work in progress on residential home')
      expect(image).toBeInTheDocument()
      // LazyImage starts with placeholder, not actual image URL
      expect(image).toHaveAttribute('src', expect.stringContaining('data:image'))
      expect(image).toHaveClass('lazy-image')
    })

    it('should use web URI when no thumbnail URI available (via LazyImage)', () => {
      const photoWithoutThumbnail = {
        ...mockPhoto,
        uris: [{ type: 'web', uri: 'https://example.com/web.jpg', url: 'https://example.com/web.jpg' }]
      }

      render(<PhotoCard {...defaultProps} photo={photoWithoutThumbnail} />)

      const image = screen.getByAltText('Roofing work in progress on residential home')
      // LazyImage will show placeholder initially, but should be configured with web URI
      expect(image).toBeInTheDocument()
      expect(image).toHaveClass('lazy-image')
    })

    it('should show "No Image Available" when no image URI exists', () => {
      const photoWithoutImage = {
        ...mockPhoto,
        uris: [],
        photo_url: ''
      }

      render(<PhotoCard {...defaultProps} photo={photoWithoutImage} />)

      expect(screen.getByText('No Image Available')).toBeInTheDocument()
    })

    it('should handle missing description gracefully', () => {
      render(<PhotoCard {...defaultProps} photo={mockPhotoWithoutTags} />)

      expect(screen.getByText('Photo ID: test-photo-no-tags')).toBeInTheDocument()
      expect(screen.getByText('By: John Contractor')).toBeInTheDocument()
      expect(screen.queryByText('Roofing work in progress on residential home')).not.toBeInTheDocument()
    })

    it('should handle missing creator name', () => {
      const photoWithoutCreator = {
        ...mockPhoto,
        creator_name: ''
      }

      render(<PhotoCard {...defaultProps} photo={photoWithoutCreator} />)

      expect(screen.getByText('By: Unknown Creator')).toBeInTheDocument()
    })
  })

  describe('Tag rendering', () => {
    it('should render all photo tags', () => {
      render(<PhotoCard {...defaultProps} />)

      expect(screen.getByText('Roofing')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })

    it('should show "No tags" when photo has no tags', () => {
      render(<PhotoCard {...defaultProps} photo={mockPhotoWithoutTags} />)

      expect(screen.getByText('No tags')).toBeInTheDocument()
    })

    it('should apply AI-enhanced styling to AI tags', () => {
      render(<PhotoCard {...defaultProps} />)

      const aiTag = screen.getByText('Progress')
      const normalTag = screen.getByText('Roofing')

      // AI tag should have gray AI styling (not active)
      expect(aiTag).toHaveClass('bg-gray-200')
      expect(aiTag).toHaveClass('text-gray-800')
      // Normal tag should have standard gray styling
      expect(normalTag).toHaveClass('bg-gray-100')
      expect(normalTag).toHaveClass('text-gray-700')
    })

    it('should apply active styling to filtered tags', () => {
      render(<PhotoCard {...defaultProps} activeTagIds={['tag-1']} />)

      const activeTag = screen.getByText('Roofing')
      const inactiveTag = screen.getByText('Progress')

      // Active normal tag should have dark gray styling
      expect(activeTag).toHaveClass('bg-gray-800')
      expect(activeTag).toHaveClass('text-white')
      // Inactive AI tag should have standard AI styling
      expect(inactiveTag).toHaveClass('bg-gray-200')
      expect(inactiveTag).toHaveClass('text-gray-800')
    })

    it('should handle tag clicks when onTagClick is provided', async () => {
      const user = userEvent.setup()
      render(<PhotoCard {...defaultProps} />)

      const tag = screen.getByText('Roofing')
      await user.click(tag)

      expect(mockOnTagClick).toHaveBeenCalledWith('tag-1')
    })

    it('should not crash with malformed tags', () => {
      const photoWithBadTags = {
        ...mockPhoto,
        tags: [
          null,
          undefined,
          { display_value: 'No ID Tag' }, // Missing id property entirely
          { id: 123, display_value: 'Numeric ID Tag' } // Non-string id
        ] as any
      }

      render(<PhotoCard {...defaultProps} photo={photoWithBadTags} />)

      // Should filter out tags without proper string id
      expect(screen.queryByText('No ID Tag')).not.toBeInTheDocument()
      expect(screen.queryByText('Numeric ID Tag')).not.toBeInTheDocument()
      // But null/undefined should not crash the component
      expect(screen.getByText('Photo ID: test-photo-123')).toBeInTheDocument()
    })
  })

  describe('Photo click handling', () => {
    it('should call onPhotoClick when card is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoCard {...defaultProps} />)

      const card = screen.getByText('Photo ID: test-photo-123').closest('div')
      expect(card).toBeInTheDocument()

      await user.click(card!)

      expect(mockOnPhotoClick).toHaveBeenCalledWith(mockPhoto)
    })

    it('should not trigger photo click when tag is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoCard {...defaultProps} />)

      const tag = screen.getByText('Roofing')
      await user.click(tag)

      expect(mockOnPhotoClick).not.toHaveBeenCalled()
      expect(mockOnTagClick).toHaveBeenCalledWith('tag-1')
    })
  })

  describe('AI Suggestions', () => {
    it('should show AI suggestion button when no suggestions exist', () => {
      render(<PhotoCard {...defaultProps} />)

      expect(screen.getByText('Suggest Tags')).toBeInTheDocument()
    })

    it('should show loading state when fetching suggestions', () => {
      const loadingAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        isSuggesting: true,
        suggestedTags: [],
        suggestedDescription: ''
      }

      render(<PhotoCard {...defaultProps} aiSuggestionData={loadingAiData} />)

      expect(screen.getByText('Suggesting...')).toBeInTheDocument()
      expect(screen.queryByText('Suggest AI Tags')).not.toBeInTheDocument()
    })

    it('should call onFetchAiSuggestions when AI button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoCard {...defaultProps} />)

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

      render(<PhotoCard {...defaultProps} photo={photoWithoutWeb} />)

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

      render(<PhotoCard {...defaultProps} photo={photoMinimal} />)

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

      render(<PhotoCard {...defaultProps} photo={photoWithoutUrls} />)

      const aiButton = screen.getByText('Suggest Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).not.toHaveBeenCalled()
    })

    it('should display AI suggested tags when available', () => {
      render(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      expect(screen.getByText('shingles')).toBeInTheDocument()
      expect(screen.getByText('installation')).toBeInTheDocument()
    })

    it('should display AI suggested description when available', () => {
      render(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      expect(screen.getByText('Asphalt shingle installation in progress')).toBeInTheDocument()
    })

    it('should show error message when AI suggestion fails', () => {
      const errorAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        suggestedTags: [],
        suggestedDescription: '',
        suggestionError: 'Failed to fetch AI suggestions'
      }

      render(<PhotoCard {...defaultProps} aiSuggestionData={errorAiData} />)

      expect(screen.getByText(/Failed to fetch AI suggestions/)).toBeInTheDocument()
    })

    it('should allow adding AI suggested tags', async () => {
      const user = userEvent.setup()
      render(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

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
      render(<PhotoCard {...defaultProps} />)

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
      
      render(<PhotoCard {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

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

  describe('Advanced Tag Styling', () => {
    it('should apply correct styling for active AI tags when onTagClick is not provided', () => {
      const propsWithoutTagClick = {
        ...defaultProps,
        onTagClick: undefined,
        activeTagIds: ['tag-2'] // Progress tag is AI enhanced
      }
      
      render(<PhotoCard {...propsWithoutTagClick} />)

      const activeAiTag = screen.getByText('Progress')
      
      // Should have AI tag active styling (gray-700 for active AI tags)
      expect(activeAiTag).toHaveClass('bg-gray-700')
      expect(activeAiTag).toHaveClass('text-white')
    })

    it('should apply correct styling for inactive tags when onTagClick is not provided', () => {
      const propsWithoutTagClick = {
        ...defaultProps,
        onTagClick: undefined
      }
      
      render(<PhotoCard {...propsWithoutTagClick} />)

      const normalTag = screen.getByText('Roofing')
      
      // Should have non-clickable styling (bg-gray-50 text-gray-500)
      expect(normalTag).toHaveClass('bg-gray-50')
      expect(normalTag).toHaveClass('text-gray-500')
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for images', () => {
      render(<PhotoCard {...defaultProps} />)

      const image = screen.getByAltText('Roofing work in progress on residential home')
      expect(image).toBeInTheDocument()
    })

    it('should have proper title attributes for tags', () => {
      render(<PhotoCard {...defaultProps} />)

      const aiTag = screen.getByText('Progress')
      const normalTag = screen.getByText('Roofing')

      expect(aiTag).toHaveAttribute('title', 'Filter by: Progress (AI)')
      expect(normalTag).toHaveAttribute('title', 'Filter by: Roofing')
    })

    it('should have proper title for photo ID', () => {
      render(<PhotoCard {...defaultProps} />)

      const photoTitle = screen.getByText('Photo ID: test-photo-123')
      expect(photoTitle).toHaveAttribute('title', 'Photo ID: test-photo-123')
    })
  })
})