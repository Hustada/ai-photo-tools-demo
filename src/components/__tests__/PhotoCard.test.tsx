// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoCard, { type PhotoCardAiSuggestionState } from '../PhotoCard'
import type { Photo, Tag } from '../../types'

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

    it('should render photo image with correct src', () => {
      render(<PhotoCard {...defaultProps} />)

      const image = screen.getByAltText('Roofing work in progress on residential home')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('should fallback to photo_url when no thumbnail URI available', () => {
      const photoWithoutThumbnail = {
        ...mockPhoto,
        uris: [{ type: 'web', uri: 'https://example.com/web.jpg', url: 'https://example.com/web.jpg' }]
      }

      render(<PhotoCard {...defaultProps} photo={photoWithoutThumbnail} />)

      const image = screen.getByAltText('Roofing work in progress on residential home')
      expect(image).toHaveAttribute('src', 'https://example.com/photo.jpg')
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

      // AI tag should have teal styling
      expect(aiTag).toHaveClass('bg-teal-600')
      // Normal tag should have gray styling
      expect(normalTag).toHaveClass('bg-gray-600')
    })

    it('should apply active styling to filtered tags', () => {
      render(<PhotoCard {...defaultProps} activeTagIds={['tag-1']} />)

      const activeTag = screen.getByText('Roofing')
      const inactiveTag = screen.getByText('Progress')

      // Active tag should have blue styling
      expect(activeTag).toHaveClass('bg-blue-500')
      // Inactive AI tag should still have teal styling
      expect(inactiveTag).toHaveClass('bg-teal-600')
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

      expect(screen.getByText('Suggest AI Tags')).toBeInTheDocument()
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

      const aiButton = screen.getByText('Suggest AI Tags')
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

      const aiButton = screen.getByText('Suggest AI Tags')
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

      const aiButton = screen.getByText('Suggest AI Tags')
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

      const aiButton = screen.getByText('Suggest AI Tags')
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

      const aiButton = screen.getByText('Suggest AI Tags')
      await user.click(aiButton)

      expect(mockOnPhotoClick).not.toHaveBeenCalled()
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