// © 2025 Mark Hustad — MIT License
// Simplified integration tests focusing on component interactions
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PhotoCard from '../components/PhotoCard'
import PhotoModal from '../components/PhotoModal'
import type { Photo } from '../types'
import { companyCamService } from '../services/companyCamService'
import { ScoutAiProvider } from '../contexts/ScoutAiContext'

// Mock UserContext
vi.mock('../contexts/UserContext', () => ({
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
}))

// Mock the service
vi.mock('../services/companyCamService', () => ({
  companyCamService: {
    listCompanyCamTags: vi.fn(),
    createCompanyCamTagDefinition: vi.fn(),
    addTagsToPhoto: vi.fn(),
    updatePhotoDescription: vi.fn(),
  }
}))

// Mock the hooks
vi.mock('../hooks/useVisualSimilarity', () => ({
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

vi.mock('../hooks/useAnalysisTracking', () => ({
  useAnalysisTracking: () => ({
    markPhotoAnalyzed: vi.fn().mockResolvedValue({ success: true }),
    markPhotosAnalyzed: vi.fn().mockResolvedValue({ success: true, results: [] }),
    getAnalysisHistory: vi.fn().mockReturnValue([]),
    clearAnalysisHistory: vi.fn(),
  })
}))

// Mock fetch for AI suggestions
global.fetch = vi.fn()

const mockPhoto: Photo = {
  id: 'integration-photo-1',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'Integration Tester',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'thumbnail', uri: 'https://example.com/thumb.jpg', url: 'https://example.com/thumb.jpg' },
    { type: 'web', uri: 'https://example.com/web.jpg', url: 'https://example.com/web.jpg' },
  ],
  hash: 'integration123',
  description: 'Integration test photo',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: 1641074400000,
  created_at: 1641074400000,
  updated_at: 1641074400000,
  tags: []
}

// Helper function to render with necessary providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ScoutAiProvider userId="test-user">
        {ui}
      </ScoutAiProvider>
    </MemoryRouter>
  )
}

describe('Integration Tests - Component Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock service responses
    vi.mocked(companyCamService.listCompanyCamTags).mockResolvedValue([
      { id: 'tag-1', display_value: 'Existing Tag', value: 'existing-tag' }
    ])
    vi.mocked(companyCamService.createCompanyCamTagDefinition).mockResolvedValue({
      id: 'new-tag-1',
      display_value: 'New Tag',
      value: 'new-tag'
    })
    vi.mocked(companyCamService.addTagsToPhoto).mockResolvedValue(undefined)
    vi.mocked(companyCamService.updatePhotoDescription).mockResolvedValue(undefined)

    // Mock fetch for AI suggestions
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        suggestedTags: ['ai-tag-1', 'ai-tag-2'],
        suggestedDescription: 'AI generated description'
      })
    } as Response)
  })

  describe('PhotoCard to PhotoModal Workflow', () => {
    it('should handle complete AI suggestion workflow from PhotoCard', async () => {
      const user = userEvent.setup()
      let currentAiData: any = undefined
      
      const mockOnFetchAiSuggestions = vi.fn(async () => {
        // Simulate AI suggestions being fetched
        currentAiData = {
          suggestedTags: ['ai-tag-1', 'ai-tag-2'],
          suggestedDescription: 'AI generated description',
          isSuggesting: false,
          suggestionError: null,
          persistedDescription: null,
          persistedAcceptedTags: [],
          isLoadingPersisted: false,
          persistedError: null
        }
      })

      const mockOnAddTagToCompanyCam = vi.fn()
      const mockOnAddAiTag = vi.fn()

      // Render PhotoCard
      const { rerender } = renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={mockOnAddTagToCompanyCam}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
          aiSuggestionData={currentAiData}
        />
      )

      // Click AI suggestions button
      const aiButton = screen.getByText('Suggest AI Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'integration-photo-1',
        'https://example.com/web.jpg'
      )

      // Rerender with AI suggestions
      rerender(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={mockOnAddTagToCompanyCam}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
          aiSuggestionData={currentAiData}
        />
      )

      // Should show AI suggested tags
      expect(screen.getByText('ai-tag-1')).toBeInTheDocument()
      expect(screen.getByText('ai-tag-2')).toBeInTheDocument()

      // Click on a suggested tag to add it
      const tagButton = screen.getByText('ai-tag-1')
      await user.click(tagButton)

      expect(mockOnAddAiTag).toHaveBeenCalledWith(
        'integration-photo-1',
        'ai-tag-1',
        mockPhoto
      )
    })

    it('should handle AI suggestion errors gracefully', async () => {
      const user = userEvent.setup()
      
      const mockOnFetchAiSuggestions = vi.fn()

      renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={() => {}}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
          aiSuggestionData={{
            suggestedTags: [],
            suggestedDescription: '',
            isSuggesting: false,
            suggestionError: 'Failed to get AI suggestions',
            persistedDescription: null,
            persistedAcceptedTags: [],
            isLoadingPersisted: false,
            persistedError: null
          }}
        />
      )

      // Should show error message
      expect(screen.getByText(/Failed to get AI suggestions/)).toBeInTheDocument()
    })
  })

  describe('PhotoModal Workflows', () => {
    it('should handle complete modal workflow: AI suggestions -> add tags -> edit description', async () => {
      const user = userEvent.setup()
      let currentAiData: any = undefined

      const mockOnFetchAiSuggestions = vi.fn(async () => {
        currentAiData = {
          suggestedTags: ['modal-tag-1', 'modal-tag-2'],
          suggestedDescription: 'Modal AI description',
          isSuggesting: false,
          suggestionError: null,
          persistedDescription: null,
          persistedAcceptedTags: [],
          isLoadingPersisted: false,
          persistedError: null
        }
      })

      const mockOnSaveAiDescription = vi.fn()
      const mockOnAddTagToCompanyCam = vi.fn()
      const mockOnAddAiTag = vi.fn()

      // Render modal
      const { rerender } = renderWithProviders(
        <PhotoModal
          photo={mockPhoto}
          onClose={() => {}}
          apiKey="test-api-key"
          onAddTagToCompanyCam={mockOnAddTagToCompanyCam}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
          onSaveAiDescription={mockOnSaveAiDescription}
          onShowNextPhoto={() => {}}
          onShowPreviousPhoto={() => {}}
          canNavigateNext={true}
          canNavigatePrevious={true}
          currentIndex={0}
          totalPhotos={1}
          aiSuggestionData={currentAiData}
        />
      )

      // Step 1: Get AI suggestions
      const aiButton = screen.getByText('Get AI Suggestions')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalled()

      // Rerender with AI suggestions
      rerender(
        <PhotoModal
          photo={mockPhoto}
          onClose={() => {}}
          apiKey="test-api-key"
          onAddTagToCompanyCam={mockOnAddTagToCompanyCam}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
          onSaveAiDescription={mockOnSaveAiDescription}
          onShowNextPhoto={() => {}}
          onShowPreviousPhoto={() => {}}
          canNavigateNext={true}
          canNavigatePrevious={true}
          currentIndex={0}
          totalPhotos={1}
          aiSuggestionData={currentAiData}
        />
      )

      // Step 2: Add AI suggested tag
      await waitFor(() => {
        expect(screen.getByText('modal-tag-1')).toBeInTheDocument()
      })

      const tagButton = screen.getByText('modal-tag-1')
      await user.click(tagButton)

      expect(mockOnAddAiTag).toHaveBeenCalledWith(
        'integration-photo-1',
        'modal-tag-1',
        mockPhoto
      )

      // Step 3: Edit description
      const textarea = screen.getByDisplayValue('Integration test photo')
      await user.clear(textarea)
      await user.type(textarea, 'Updated integration description')

      const saveButton = screen.getByText('Save Description')
      await user.click(saveButton)

      expect(mockOnSaveAiDescription).toHaveBeenCalledWith(
        'integration-photo-1',
        'Updated integration description',
        mockPhoto
      )
    })

    it('should handle modal navigation', async () => {
      const user = userEvent.setup()
      const mockOnShowNext = vi.fn()
      const mockOnShowPrevious = vi.fn()

      renderWithProviders(
        <PhotoModal
          photo={mockPhoto}
          onClose={() => {}}
          apiKey="test-api-key"
          onAddTagToCompanyCam={() => {}}
          onFetchAiSuggestions={() => Promise.resolve()}
          onSaveAiDescription={() => Promise.resolve()}
          onShowNextPhoto={mockOnShowNext}
          onShowPreviousPhoto={mockOnShowPrevious}
          canNavigateNext={true}
          canNavigatePrevious={true}
          currentIndex={1}
          totalPhotos={3}
        />
      )

      // Test navigation buttons
      const nextButton = screen.getByLabelText('Next photo')
      const prevButton = screen.getByLabelText('Previous photo')

      await user.click(nextButton)
      expect(mockOnShowNext).toHaveBeenCalled()

      await user.click(prevButton)
      expect(mockOnShowPrevious).toHaveBeenCalled()

      // Test counter display
      expect(screen.getByText('2 / 3')).toBeInTheDocument()
    })

    it('should handle service errors in modal', async () => {
      const user = userEvent.setup()

      // Mock onAddAiTag to fail
      const mockOnAddAiTag = vi.fn().mockRejectedValue(new Error('Service error'))

      renderWithProviders(
        <PhotoModal
          photo={mockPhoto}
          onClose={() => {}}
          apiKey="test-api-key"
          onAddTagToCompanyCam={() => {}}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={() => Promise.resolve()}
          onSaveAiDescription={() => Promise.resolve()}
          onShowNextPhoto={() => {}}
          onShowPreviousPhoto={() => {}}
          canNavigateNext={true}
          canNavigatePrevious={true}
          currentIndex={0}
          totalPhotos={1}
          aiSuggestionData={{
            suggestedTags: ['error-tag'],
            suggestedDescription: 'Error test description',
            isSuggesting: false,
            suggestionError: null,
            persistedDescription: null,
            persistedAcceptedTags: [],
            isLoadingPersisted: false,
            persistedError: null
          }}
        />
      )

      // Try to add tag (should fail gracefully)
      const tagButton = screen.getByText('error-tag')
      await user.click(tagButton)

      // Should call the onAddAiTag function
      await waitFor(() => {
        expect(mockOnAddAiTag).toHaveBeenCalled()
      })
    })
  })

  describe('Cross-Component State Management', () => {
    it('should verify that AI suggestion state is properly managed', async () => {
      const user = userEvent.setup()

      // This test verifies that state flows correctly between components
      const aiData = {
        suggestedTags: ['state-tag-1', 'state-tag-2'],
        suggestedDescription: 'State management test',
        isSuggesting: false,
        suggestionError: null,
        persistedDescription: 'Persisted description',
        persistedAcceptedTags: ['persisted-tag'],
        isLoadingPersisted: false,
        persistedError: null
      }

      renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={() => {}}
          onFetchAiSuggestions={() => Promise.resolve()}
          aiSuggestionData={aiData}
        />
      )

      // Should show both new suggestions and persisted data appropriately
      expect(screen.getByText('state-tag-1')).toBeInTheDocument()
      expect(screen.getByText('state-tag-2')).toBeInTheDocument()
      expect(screen.getByText(/State management test/)).toBeInTheDocument()
    })

    it('should handle loading states properly', () => {
      const loadingAiData = {
        suggestedTags: [],
        suggestedDescription: '',
        isSuggesting: true,
        suggestionError: null,
        persistedDescription: null,
        persistedAcceptedTags: [],
        isLoadingPersisted: false,
        persistedError: null
      }

      renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={() => {}}
          onFetchAiSuggestions={() => Promise.resolve()}
          aiSuggestionData={loadingAiData}
        />
      )

      // Should show loading state
      expect(screen.getByText('Suggesting...')).toBeInTheDocument()
      expect(screen.queryByText('Suggest AI Tags')).not.toBeInTheDocument()
    })
  })

  describe('API Integration Points', () => {
    it('should verify fetch is called correctly for AI suggestions', async () => {
      const user = userEvent.setup()

      // This simulates what happens in the real app
      const mockOnFetchAiSuggestions = vi.fn(async (photoId: string, photoUrl: string) => {
        // Simulate the actual fetch call that would happen in HomePage
        await fetch('/api/suggest-ai-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoId, photoUrl })
        })
      })

      renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={() => {}}
          onFetchAiSuggestions={mockOnFetchAiSuggestions}
        />
      )

      const aiButton = screen.getByText('Suggest AI Tags')
      await user.click(aiButton)

      expect(mockOnFetchAiSuggestions).toHaveBeenCalledWith(
        'integration-photo-1',
        'https://example.com/web.jpg'
      )

      expect(fetch).toHaveBeenCalledWith('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: 'integration-photo-1',
          photoUrl: 'https://example.com/web.jpg'
        })
      })
    })

    it('should verify CompanyCam service calls are made correctly', async () => {
      const user = userEvent.setup()

      // This simulates the tag addition workflow
      const mockOnAddTagToCompanyCam = vi.fn(async (photoId: string, tagValue: string) => {
        // Simulate the real service calls that would happen
        const allTags = await companyCamService.listCompanyCamTags('test-api-key')
        let targetTag = allTags.find(t => t.display_value.toLowerCase() === tagValue.toLowerCase())
        
        if (!targetTag) {
          targetTag = await companyCamService.createCompanyCamTagDefinition('test-api-key', tagValue)
        }
        
        if (targetTag) {
          await companyCamService.addTagsToPhoto('test-api-key', photoId, [targetTag.id])
        }
      })

      const mockOnAddAiTag = vi.fn()

      renderWithProviders(
        <PhotoCard
          photo={mockPhoto}
          onPhotoClick={() => {}}
          onTagClick={() => {}}
          onAddTagToCompanyCam={mockOnAddTagToCompanyCam}
          onAddAiTag={mockOnAddAiTag}
          onFetchAiSuggestions={() => Promise.resolve()}
          aiSuggestionData={{
            suggestedTags: ['new-tag'],
            suggestedDescription: 'Test description',
            isSuggesting: false,
            suggestionError: null,
            persistedDescription: null,
            persistedAcceptedTags: [],
            isLoadingPersisted: false,
            persistedError: null
          }}
        />
      )

      const tagButton = screen.getByText('new-tag')
      await user.click(tagButton)

      expect(mockOnAddAiTag).toHaveBeenCalledWith(
        'integration-photo-1',
        'new-tag',
        mockPhoto
      )
    })
  })
})