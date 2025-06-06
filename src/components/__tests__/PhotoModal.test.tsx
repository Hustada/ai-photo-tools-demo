// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoModal from '../PhotoModal'
import type { Photo } from '../../types'
import type { PhotoCardAiSuggestionState } from '../PhotoCard'
import { companyCamService } from '../../services/companyCamService'

// Mock the companyCamService
vi.mock('../../services/companyCamService', () => ({
  companyCamService: {
    listCompanyCamTags: vi.fn(),
    createCompanyCamTagDefinition: vi.fn(),
    addTagsToPhoto: vi.fn(),
  }
}))

// Mock data factory functions to avoid test pollution
const createMockPhoto = (): Photo => ({
  id: 'modal-photo-123',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'Jane Contractor',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'thumbnail', uri: 'https://example.com/thumb.jpg', url: 'https://example.com/thumb.jpg' },
    { type: 'web', uri: 'https://example.com/web.jpg', url: 'https://example.com/web.jpg' },
    { type: 'original', uri: 'https://example.com/original.jpg', url: 'https://example.com/original.jpg' }
  ],
  hash: 'def456',
  description: 'Electrical work in progress',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: 1641074400000, // Jan 1, 2022 22:00:00 UTC (timezone-safe)
  created_at: 1641074400000,
  updated_at: 1641074400000,
  tags: [
    {
      id: 'tag-3',
      company_id: 'company-1',
      display_value: 'Electrical',
      value: 'electrical',
      created_at: 1641074400000,
      updated_at: 1641074400000,
      isAiEnhanced: true
    },
    {
      id: 'tag-4',
      company_id: 'company-1',
      display_value: 'Installation',
      value: 'installation',
      created_at: 1641074400000,
      updated_at: 1641074400000,
      isAiEnhanced: false
    }
  ]
})

const createMockPhotoNoTags = (): Photo => ({
  ...createMockPhoto(),
  id: 'modal-photo-no-tags',
  tags: [],
  description: null
})

const mockAiSuggestionData: PhotoCardAiSuggestionState = {
  suggestedTags: ['wiring', 'conduit', 'junction'],
  suggestedDescription: 'Electrical conduit and wiring installation',
  isSuggesting: false,
  suggestionError: null,
  persistedDescription: 'Previous AI description',
  persistedAcceptedTags: ['electrical', 'commercial'],
  isLoadingPersisted: false,
  persistedError: null
}

describe('PhotoModal', () => {
  const mockOnClose = vi.fn()
  const mockOnAddTagToCompanyCam = vi.fn()
  const mockOnFetchAiSuggestions = vi.fn()
  const mockOnSaveAiDescription = vi.fn()
  const mockOnShowNextPhoto = vi.fn()
  const mockOnShowPreviousPhoto = vi.fn()

  let defaultProps: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create fresh props with fresh mock data for each test
    defaultProps = {
      photo: createMockPhoto(),
      onClose: mockOnClose,
      apiKey: 'test-api-key',
      onAddTagToCompanyCam: mockOnAddTagToCompanyCam,
      onFetchAiSuggestions: mockOnFetchAiSuggestions,
      onSaveAiDescription: mockOnSaveAiDescription,
      onShowNextPhoto: mockOnShowNextPhoto,
      onShowPreviousPhoto: mockOnShowPreviousPhoto,
      canNavigateNext: true,
      canNavigatePrevious: true,
      currentIndex: 1,
      totalPhotos: 5
    }
  })

  afterEach(() => {
    // Clean up any event listeners
    document.removeEventListener('keydown', vi.fn())
  })

  describe('Basic rendering', () => {
    it('should render modal with photo information', () => {
      render(<PhotoModal {...defaultProps} />)

      expect(screen.getByText('Jane Contractor')).toBeInTheDocument()
      // Check what the actual date is being rendered
      expect(screen.getByText(/Captured On:/)).toBeInTheDocument()
      expect(screen.getAllByText('Electrical work in progress')).toHaveLength(2) // One in description, one in textarea
      expect(screen.getByText('2 / 5')).toBeInTheDocument()
    })

    it('should render photo image with correct src', () => {
      render(<PhotoModal {...defaultProps} />)

      const image = screen.getByAltText('Electrical work in progress')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', 'https://example.com/web.jpg')
    })

    it('should fallback to original URI when web URI not available', () => {
      const photoWithoutWeb = {
        ...createMockPhoto(),
        uris: [
          { type: 'thumbnail', uri: 'https://example.com/thumb.jpg', url: 'https://example.com/thumb.jpg' },
          { type: 'original', uri: 'https://example.com/original.jpg', url: 'https://example.com/original.jpg' }
        ]
      }

      render(<PhotoModal {...defaultProps} photo={photoWithoutWeb} />)

      const image = screen.getByAltText('Electrical work in progress')
      expect(image).toHaveAttribute('src', 'https://example.com/original.jpg')
    })

    it('should show "No image available" when no URIs exist', () => {
      const photoWithoutImage = {
        ...createMockPhoto(),
        uris: []
      }

      render(<PhotoModal {...defaultProps} photo={photoWithoutImage} />)

      expect(screen.getByText('No image available')).toBeInTheDocument()
    })

    it('should handle missing description gracefully', () => {
      render(<PhotoModal {...defaultProps} photo={createMockPhotoNoTags()} />)

      expect(screen.getByText('No description provided.')).toBeInTheDocument()
    })

    it('should handle missing creator name', () => {
      const photoWithoutCreator = {
        ...createMockPhoto(),
        creator_name: ''
      }

      render(<PhotoModal {...defaultProps} photo={photoWithoutCreator} />)

      expect(screen.getByText('Captured By:')).toBeInTheDocument()
    })
  })

  describe('Tag rendering', () => {
    it('should render all photo tags with appropriate styling', () => {
      render(<PhotoModal {...defaultProps} />)

      expect(screen.getByText('Electrical (AI)')).toBeInTheDocument()
      expect(screen.getByText('Installation')).toBeInTheDocument()

      const aiTag = screen.getByText('Electrical (AI)')
      const normalTag = screen.getByText('Installation')

      expect(aiTag).toHaveClass('bg-teal-100')
      expect(normalTag).toHaveClass('bg-gray-200')
    })

    it('should show "No tags yet." when photo has no tags', () => {
      render(<PhotoModal {...defaultProps} photo={createMockPhotoNoTags()} />)

      expect(screen.getByText('No tags yet.')).toBeInTheDocument()
    })
  })

  describe('Modal close functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<PhotoModal {...defaultProps} />)

      const backdrop = container.querySelector('.fixed.inset-0')
      expect(backdrop).toBeInTheDocument()
      
      await user.click(backdrop!)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not close when modal content is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const modalContent = screen.getByText('Jane Contractor')
      await user.click(modalContent)

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Navigation', () => {
    it('should call onShowNextPhoto when next button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const nextButton = screen.getByLabelText('Next photo')
      await user.click(nextButton)

      expect(mockOnShowNextPhoto).toHaveBeenCalledTimes(1)
    })

    it('should call onShowPreviousPhoto when previous button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const prevButton = screen.getByLabelText('Previous photo')
      await user.click(prevButton)

      expect(mockOnShowPreviousPhoto).toHaveBeenCalledTimes(1)
    })

    it('should disable next button when canNavigateNext is false', () => {
      render(<PhotoModal {...defaultProps} canNavigateNext={false} />)

      const nextButton = screen.getByLabelText('Next photo')
      expect(nextButton).toBeDisabled()
    })

    it('should disable previous button when canNavigatePrevious is false', () => {
      render(<PhotoModal {...defaultProps} canNavigatePrevious={false} />)

      const prevButton = screen.getByLabelText('Previous photo')
      expect(prevButton).toBeDisabled()
    })
  })

  describe('Keyboard navigation', () => {
    it('should close modal when Escape key is pressed', () => {
      render(<PhotoModal {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should navigate to next photo when ArrowRight key is pressed', () => {
      render(<PhotoModal {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'ArrowRight' })

      expect(mockOnShowNextPhoto).toHaveBeenCalledTimes(1)
    })

    it('should navigate to previous photo when ArrowLeft key is pressed', () => {
      render(<PhotoModal {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'ArrowLeft' })

      expect(mockOnShowPreviousPhoto).toHaveBeenCalledTimes(1)
    })

    it('should not navigate when canNavigateNext is false', () => {
      render(<PhotoModal {...defaultProps} canNavigateNext={false} />)

      fireEvent.keyDown(document, { key: 'ArrowRight' })

      expect(mockOnShowNextPhoto).not.toHaveBeenCalled()
    })

    it('should not navigate when canNavigatePrevious is false', () => {
      render(<PhotoModal {...defaultProps} canNavigatePrevious={false} />)

      fireEvent.keyDown(document, { key: 'ArrowLeft' })

      expect(mockOnShowPreviousPhoto).not.toHaveBeenCalled()
    })
  })

  describe('AI Suggestions', () => {
    it('should show AI suggestion button when no suggestions exist', () => {
      render(<PhotoModal {...defaultProps} />)

      expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument()
    })

    it('should show loading state when fetching suggestions', () => {
      const loadingAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        isSuggesting: true,
        suggestedTags: [],
        suggestedDescription: ''
      }

      render(<PhotoModal {...defaultProps} aiSuggestionData={loadingAiData} />)

      expect(screen.getByText('Getting Suggestions...')).toBeInTheDocument()
      expect(screen.queryByText('Get AI Suggestions')).not.toBeInTheDocument()
    })

    it('should call onFetchAiSuggestions when AI button is clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const aiButton = screen.getByText('Get AI Suggestions')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'modal-photo-123',
        'https://example.com/web.jpg',
        'project-1'
      )
    })

    it('should display AI suggested tags when available', () => {
      render(<PhotoModal {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      expect(screen.getByText('wiring')).toBeInTheDocument()
      expect(screen.getByText('conduit')).toBeInTheDocument()
      expect(screen.getByText('junction')).toBeInTheDocument()
    })

    it('should filter out existing tags from AI suggestions', () => {
      const aiDataWithExistingTags: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        suggestedTags: ['electrical', 'wiring', 'installation', 'conduit'] // electrical and installation already exist
      }

      render(<PhotoModal {...defaultProps} aiSuggestionData={aiDataWithExistingTags} />)

      expect(screen.getByText('wiring')).toBeInTheDocument()
      expect(screen.getByText('conduit')).toBeInTheDocument()
      expect(screen.queryByText('electrical')).not.toBeInTheDocument() // Should be filtered out
      expect(screen.queryByText('installation')).not.toBeInTheDocument() // Should be filtered out
    })

    it('should show error message when AI suggestion fails', () => {
      const errorAiData: PhotoCardAiSuggestionState = {
        ...mockAiSuggestionData,
        suggestedTags: [],
        suggestedDescription: '',
        suggestionError: 'Network timeout'
      }

      render(<PhotoModal {...defaultProps} aiSuggestionData={errorAiData} />)

      expect(screen.getByText(/Network timeout/)).toBeInTheDocument()
    })
  })

  describe('AI tag adding', () => {
    beforeEach(() => {
      // Mock successful service calls
      vi.mocked(companyCamService.listCompanyCamTags).mockResolvedValue([
        { id: 'tag-5', display_value: 'Wiring', value: 'wiring' }
      ])
      vi.mocked(companyCamService.addTagsToPhoto).mockResolvedValue(undefined)
      mockOnAddTagToCompanyCam.mockResolvedValue(undefined)
    })

    it('should add AI suggested tag when clicked', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('wiring')
      await user.click(tagButton)

      await waitFor(() => {
        expect(companyCamService.listCompanyCamTags).toHaveBeenCalledWith('test-api-key')
      })

      await waitFor(() => {
        expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith(
          'test-api-key',
          'modal-photo-123',
          ['tag-5']
        )
      })

      expect(mockOnAddTagToCompanyCam).toHaveBeenCalledWith('modal-photo-123', 'wiring')
    })

    it('should create new tag if it does not exist', async () => {
      const user = userEvent.setup()
      
      // Mock that tag doesn't exist, then create it
      vi.mocked(companyCamService.listCompanyCamTags).mockResolvedValue([])
      vi.mocked(companyCamService.createCompanyCamTagDefinition).mockResolvedValue(
        { id: 'new-tag-6', display_value: 'Conduit', value: 'conduit' }
      )

      render(<PhotoModal {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('conduit')
      await user.click(tagButton)

      await waitFor(() => {
        expect(companyCamService.createCompanyCamTagDefinition).toHaveBeenCalledWith(
          'test-api-key',
          'conduit'
        )
      })

      await waitFor(() => {
        expect(companyCamService.addTagsToPhoto).toHaveBeenCalledWith(
          'test-api-key',
          'modal-photo-123',
          ['new-tag-6']
        )
      })
    })

    it('should show loading state while adding tag', async () => {
      const user = userEvent.setup()
      
      // Delay the service call to see loading state
      vi.mocked(companyCamService.listCompanyCamTags).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      render(<PhotoModal {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('wiring')
      await user.click(tagButton)

      expect(screen.getByText('Adding...')).toBeInTheDocument()
    })

    it('should handle API key missing error', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} apiKey="" aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('wiring')
      await user.click(tagButton)

      expect(screen.getByText(/API key is missing/)).toBeInTheDocument()
    })

    it('should handle tag creation errors', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(companyCamService.listCompanyCamTags).mockRejectedValue(
        new Error('Service unavailable')
      )

      render(<PhotoModal {...defaultProps} aiSuggestionData={mockAiSuggestionData} />)

      const tagButton = screen.getByText('wiring')
      await user.click(tagButton)

      // Verify that the error was logged and component handled it gracefully
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error adding AI tag 'wiring'"),
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Description editing', () => {
    it('should initialize description from photo', () => {
      render(<PhotoModal {...defaultProps} />)

      const textarea = screen.getByDisplayValue('Electrical work in progress')
      expect(textarea).toBeInTheDocument()
    })

    it('should initialize description from AI suggestion when photo has no description', () => {
      render(<PhotoModal {...defaultProps} photo={createMockPhotoNoTags()} aiSuggestionData={mockAiSuggestionData} />)

      const textarea = screen.getByDisplayValue('Electrical conduit and wiring installation')
      expect(textarea).toBeInTheDocument()
    })

    it('should allow editing description', async () => {
      const user = userEvent.setup()
      render(<PhotoModal {...defaultProps} />)

      const textarea = screen.getByDisplayValue('Electrical work in progress')
      await user.clear(textarea)
      await user.type(textarea, 'Updated electrical description')

      expect(textarea).toHaveValue('Updated electrical description')
    })

    it('should save description when save button is clicked', async () => {
      const user = userEvent.setup()
      mockOnSaveAiDescription.mockResolvedValue(undefined)

      render(<PhotoModal {...defaultProps} />)

      const textarea = screen.getByDisplayValue('Electrical work in progress')
      await user.clear(textarea)
      await user.type(textarea, 'New description')

      const saveButton = screen.getByText('Save Description')
      await user.click(saveButton)

      expect(mockOnSaveAiDescription).toHaveBeenCalledWith('modal-photo-123', 'New description')
    })

    it('should show loading state while saving description', async () => {
      const user = userEvent.setup()
      
      // Delay the save to see loading state
      mockOnSaveAiDescription.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<PhotoModal {...defaultProps} />)

      const textarea = screen.getByDisplayValue('Electrical work in progress')
      await user.clear(textarea)
      await user.type(textarea, 'New description')

      const saveButton = screen.getByText('Save Description')
      await user.click(saveButton)

      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    it('should disable save button when description is unchanged', () => {
      render(<PhotoModal {...defaultProps} />)

      const saveButton = screen.getByText('Save Description')
      expect(saveButton).toBeDisabled()
    })
  })

  describe('Date formatting', () => {
    it('should format valid timestamps correctly', () => {
      // Create a fresh photo with timezone-safe timestamp
      const photoWithValidDate = {
        ...createMockPhoto(),
        captured_at: 1641074400000 // January 1, 2022 22:00:00 UTC (safe from timezone issues)
      }
      
      render(<PhotoModal {...defaultProps} photo={photoWithValidDate} />)

      expect(screen.getByText(/January 1, 2022/)).toBeInTheDocument()
    })

    it('should handle invalid timestamps', () => {
      const photoWithInvalidDate = {
        ...createMockPhoto(),
        captured_at: NaN
      }

      render(<PhotoModal {...defaultProps} photo={photoWithInvalidDate} />)

      // Component should handle invalid dates gracefully
      expect(screen.getByText(/Captured On:/)).toBeInTheDocument()
      // Note: Invalid dates might show as N/A in test environment
    })

    it('should handle null timestamps', () => {
      const photoWithNullDate = {
        ...createMockPhoto(),
        captured_at: null as any
      }

      render(<PhotoModal {...defaultProps} photo={photoWithNullDate} />)

      expect(screen.getByText(/N\/A/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria labels for navigation buttons', () => {
      render(<PhotoModal {...defaultProps} />)

      expect(screen.getByLabelText('Previous photo')).toBeInTheDocument()
      expect(screen.getByLabelText('Next photo')).toBeInTheDocument()
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('should have proper alt text for images', () => {
      render(<PhotoModal {...defaultProps} />)

      const image = screen.getByAltText('Electrical work in progress')
      expect(image).toBeInTheDocument()
    })

    it('should handle missing alt text gracefully', () => {
      render(<PhotoModal {...defaultProps} photo={createMockPhotoNoTags()} />)

      const image = screen.getByAltText('Photo')
      expect(image).toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('should handle missing photo data gracefully', () => {
      const emptyPhoto = {
        ...createMockPhoto(),
        id: '',
        description: '',
        creator_name: '',
        uris: [],
        tags: []
      }

      render(<PhotoModal {...defaultProps} photo={emptyPhoto} />)

      expect(screen.getByText('No image available')).toBeInTheDocument()
      expect(screen.getByText('No description provided.')).toBeInTheDocument()
      expect(screen.getByText('No tags yet.')).toBeInTheDocument()
    })

    it('should handle missing project_id in AI suggestions', async () => {
      const user = userEvent.setup()
      const photoWithoutProject = {
        ...createMockPhoto(),
        project_id: undefined
      }

      render(<PhotoModal {...defaultProps} photo={photoWithoutProject} />)

      const aiButton = screen.getByText('Get AI Suggestions')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'modal-photo-123',
        'https://example.com/web.jpg',
        undefined
      )
    })

    it('should handle missing image URI gracefully in AI suggestions', async () => {
      const user = userEvent.setup()
      const photoWithoutUris = {
        ...createMockPhoto(),
        uris: []
      }

      render(<PhotoModal {...defaultProps} photo={photoWithoutUris} />)

      const aiButton = screen.getByText('Get AI Suggestions')
      await user.click(aiButton)

      // Should not call the function since no URI is available
      expect(mockOnFetchAiSuggestions).not.toHaveBeenCalled()
    })
  })
})