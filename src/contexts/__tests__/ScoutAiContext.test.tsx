// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScoutAiProvider, useScoutAi } from '../ScoutAiContext';
import type { Photo } from '../../types';
import type { ScoutAiSuggestion, UserCurationPreferences } from '../../types/scoutai';

// Mock the utility functions
vi.mock('../../utils/photoSimilarity', () => ({
  groupSimilarPhotos: vi.fn(),
  calculatePhotoSimilarityAsync: vi.fn(),
}));

vi.mock('../../utils/curationLogic', () => ({
  generateCurationRecommendation: vi.fn(),
  generateScoutAiMessage: vi.fn(),
}));

vi.mock('../../utils/photoActions', () => ({
  applyCurationActions: vi.fn(),
  createActionsFromRecommendation: vi.fn(),
  archivePhoto: vi.fn(),
  restorePhoto: vi.fn(),
}));

vi.mock('../../hooks/useAnalysisTracking', () => ({
  useAnalysisTracking: () => ({
    markPhotoAnalyzed: vi.fn().mockResolvedValue({ success: true }),
    markPhotosAnalyzed: vi.fn().mockResolvedValue({ success: true, results: [] }),
    getAnalysisHistory: vi.fn().mockReturnValue([]),
    clearAnalysisHistory: vi.fn(),
  })
}));

// Create a reusable mock implementation
const createMockVisualSimilarity = (similarityGroups: any[] = []) => ({
  state: {
    isAnalyzing: false,
    progress: 0,
    error: null,
    similarityGroups,
    filteredGroups: similarityGroups,
    allGroups: similarityGroups,
    similarityMatrix: new Map()
  },
  analyzeSimilarity: vi.fn().mockResolvedValue(similarityGroups),
  getSimilarityScore: vi.fn(),
  getGroupForPhoto: vi.fn(),
  getAllGroups: vi.fn().mockReturnValue(similarityGroups),
  getFilteredGroups: vi.fn().mockReturnValue(similarityGroups),
  clearAnalysis: vi.fn(),
  cancelAnalysis: vi.fn()
});

vi.mock('../../hooks/useVisualSimilarity', () => ({
  useVisualSimilarity: vi.fn(() => createMockVisualSimilarity())
}));

// Mock photos for testing
const createMockPhoto = (id: string, overrides: Partial<Photo> = {}): Photo => ({
  id,
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Doe',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [{ latitude: 40.7128, longitude: -74.0060 }],
  uris: [{ type: 'original', uri: `https://example.com/${id}.jpg`, url: `https://example.com/${id}.jpg` }],
  hash: `hash-${id}`,
  description: `Photo ${id}`,
  internal: false,
  photo_url: `https://example.com/${id}.jpg`,
  captured_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  archive_state: 'active',
  ...overrides
});

const mockPhotos: Photo[] = [
  createMockPhoto('photo-1'),
  createMockPhoto('photo-2'),
  createMockPhoto('photo-3')
];

// Test component to access context
const TestComponent: React.FC<{ onContextReady?: (context: any) => void }> = ({ onContextReady }) => {
  const context = useScoutAi();
  const mockOnPhotoUpdate = vi.fn();
  
  React.useEffect(() => {
    if (onContextReady) {
      onContextReady(context);
    }
  }, [context, onContextReady]);
  
  return (
    <div>
      <div data-testid="suggestions-count">{context.suggestions.length}</div>
      <div data-testid="is-analyzing">{context.isAnalyzing ? 'analyzing' : 'idle'}</div>
      <div data-testid="error">{context.error || 'no-error'}</div>
      <button 
        data-testid="analyze-button"
        onClick={() => context.analyzeSimilarPhotos(mockPhotos)}
      >
        Analyze Photos
      </button>
      <button
        data-testid="accept-suggestion"
        onClick={() => context.acceptSuggestion('suggestion-1', mockPhotos, mockOnPhotoUpdate)}
      >
        Accept Suggestion
      </button>
      <button
        data-testid="reject-suggestion"
        onClick={() => context.rejectSuggestion('suggestion-1')}
      >
        Reject Suggestion
      </button>
      <button
        data-testid="dismiss-suggestion"
        onClick={() => context.dismissSuggestion('suggestion-1')}
      >
        Dismiss Suggestion
      </button>
      <button
        data-testid="archive-photo"
        onClick={() => context.archivePhoto('photo-1', 'Test archive', mockPhotos, mockOnPhotoUpdate)}
      >
        Archive Photo
      </button>
      <button
        data-testid="restore-photo"
        onClick={() => context.restorePhoto('photo-1', mockPhotos, mockOnPhotoUpdate)}
      >
        Restore Photo
      </button>
    </div>
  );
};

const renderWithContext = (userId: string = 'test-user') => {
  return render(
    <MemoryRouter>
      <ScoutAiProvider userId={userId}>
        <TestComponent />
      </ScoutAiProvider>
    </MemoryRouter>
  );
};

describe('ScoutAiContext', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the useVisualSimilarity mock to default behavior
    const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
    vi.mocked(useVisualSimilarity).mockReturnValue(createMockVisualSimilarity());
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  describe('Provider initialization', () => {
    it('should provide context with initial state', () => {
      renderWithContext();
      
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('is-analyzing')).toHaveTextContent('idle');
      expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    });

    it('should load user preferences from localStorage on mount', () => {
      const mockPreferences: UserCurationPreferences = {
        userId: 'test-user',
        preferredGroupTypes: { retry_shots: true },
        qualityThreshold: 0.7,
        detailLevel: 'detailed',
        acceptanceRate: { photo_curation: 0.8 },
        learningData: {
          acceptedRecommendations: [],
          rejectedRecommendations: [],
          preferredKeepCriteria: []
        }
      };

      vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify(mockPreferences));
      
      renderWithContext();
      
      expect(window.localStorage.getItem).toHaveBeenCalledWith('scoutai-preferences-test-user');
    });

    it('should handle missing localStorage preferences gracefully', () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);
      
      renderWithContext();
      
      // Should not crash and should render with default state
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
    });
  });

  describe('analyzeSimilarPhotos', () => {
    it('should set analyzing state during photo analysis', async () => {
      const { groupSimilarPhotos } = await import('../../utils/photoSimilarity');
      vi.mocked(groupSimilarPhotos).mockResolvedValue([]);

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      act(() => {
        analyzeButton.click();
      });

      expect(screen.getByTestId('is-analyzing')).toHaveTextContent('analyzing');
      
      await waitFor(() => {
        expect(screen.getByTestId('is-analyzing')).toHaveTextContent('idle');
      });
    });

    it('should generate suggestions when similar photos are found', async () => {
      const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
      const { generateCurationRecommendation, generateScoutAiMessage } = await import('../../utils/curationLogic');
      
      const mockGroup = {
        id: 'group-1',
        photos: mockPhotos,
        similarity: {
          visualSimilarity: 0.8,
          contentSimilarity: 0.9,
          temporalProximity: 0.95,
          spatialProximity: 0.98,
          semanticSimilarity: 0.7,
          overallSimilarity: 0.85
        },
        groupType: 'retry_shots' as const,
        confidence: 0.9
      };

      const mockRecommendation = {
        group: mockGroup,
        keep: [mockPhotos[0]],
        archive: [mockPhotos[1]],
        rationale: 'Test rationale',
        estimatedTimeSaved: 2.5,
        confidence: 0.9
      };

      // Mock visual similarity hook to return similarity groups
      const mockVisualSimilarity = createMockVisualSimilarity([mockGroup]);
      mockVisualSimilarity.analyzeSimilarity.mockResolvedValue([mockGroup]);
      vi.mocked(useVisualSimilarity).mockReturnValue(mockVisualSimilarity);
      vi.mocked(generateCurationRecommendation).mockReturnValue(mockRecommendation);
      vi.mocked(generateScoutAiMessage).mockReturnValue('Test message');

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      await act(async () => {
        analyzeButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1');
      });

      expect(generateCurationRecommendation).toHaveBeenCalledWith(mockGroup);
      expect(generateScoutAiMessage).toHaveBeenCalled();
    });

    it('should handle errors during analysis gracefully', async () => {
      const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
      const mockVisualSimilarity = createMockVisualSimilarity();
      mockVisualSimilarity.analyzeSimilarity.mockRejectedValue(new Error('Analysis failed'));
      vi.mocked(useVisualSimilarity).mockReturnValue(mockVisualSimilarity);

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      await act(async () => {
        analyzeButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Analysis failed');
        expect(screen.getByTestId('is-analyzing')).toHaveTextContent('idle');
      });
    });

    it('should generate a message when no similar photos found', async () => {
      const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
      
      // Mock visual similarity to return no groups
      const mockVisualSimilarity = createMockVisualSimilarity([]);
      mockVisualSimilarity.analyzeSimilarity.mockResolvedValue([]);
      vi.mocked(useVisualSimilarity).mockReturnValue(mockVisualSimilarity);

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      await act(async () => {
        analyzeButton.click();
      });

      await waitFor(() => {
        // Expect 1 suggestion - the debug message when no similar photos found
        expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1');
        expect(screen.getByTestId('is-analyzing')).toHaveTextContent('idle');
      }, { timeout: 3000 });
    });
  });

  describe('suggestion management', () => {
    it('should handle accepting suggestions', async () => {
      renderWithContext();
      
      const acceptButton = screen.getByTestId('accept-suggestion');
      
      await act(async () => {
        acceptButton.click();
      });

      // Should not crash - actual suggestion management tested in integration
      expect(acceptButton).toBeInTheDocument();
    });

    it('should handle rejecting suggestions', async () => {
      renderWithContext();
      
      const rejectButton = screen.getByTestId('reject-suggestion');
      
      await act(async () => {
        rejectButton.click();
      });

      // Should not crash - actual suggestion management tested in integration
      expect(rejectButton).toBeInTheDocument();
    });

    it('should handle dismissing suggestions', () => {
      renderWithContext();
      
      const dismissButton = screen.getByTestId('dismiss-suggestion');
      
      act(() => {
        dismissButton.click();
      });

      // Should not crash - actual suggestion management tested in integration
      expect(dismissButton).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should throw error when useScoutAi used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useScoutAi must be used within a ScoutAiProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('user preferences', () => {
    it('should update user preferences and persist to localStorage', async () => {
      // Create a test component that can call updateUserPreferences
      const PreferencesTestComponent: React.FC = () => {
        const context = useScoutAi();
        
        const handleUpdatePreferences = async () => {
          const newPreferences: Partial<UserCurationPreferences> = {
            qualityThreshold: 0.8,
            detailLevel: 'brief'
          };
          await context.updateUserPreferences(newPreferences);
        };
        
        return (
          <button data-testid="update-preferences" onClick={handleUpdatePreferences}>
            Update Preferences
          </button>
        );
      };

      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <PreferencesTestComponent />
          </ScoutAiProvider>
        </MemoryRouter>
      );
      
      const updateButton = screen.getByTestId('update-preferences');
      
      await act(async () => {
        updateButton.click();
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'scoutai-preferences-test-user',
        expect.stringContaining('"qualityThreshold":0.8')
      );
    });
  });

  describe('photo actions', () => {
    let contextValue: any;

    beforeEach(async () => {
      // Reset all mocks before each test
      vi.clearAllMocks();
      
      // Mock localStorage to return valid user preferences
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === 'scoutai-preferences-test-user') {
          return JSON.stringify({
            userId: 'test-user',
            preferredGroupTypes: { retry_shots: true },
            qualityThreshold: 0.7,
            detailLevel: 'detailed',
            acceptanceRate: { photo_curation: 0.8 },
            learningData: {
              acceptedRecommendations: [],
              rejectedRecommendations: [],
              preferredKeepCriteria: []
            }
          });
        }
        return null;
      });
      
      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { contextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(contextValue).toBeDefined();
        expect(contextValue.userPreferences).toBeDefined();
      });
    });

    it('should accept suggestions with photo actions', async () => {
      const { applyCurationActions, createActionsFromRecommendation } = await import('../../utils/photoActions');
      const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
      const { generateCurationRecommendation, generateScoutAiMessage } = await import('../../utils/curationLogic');
      
      const mockGroup = {
        id: 'group-1',
        photos: mockPhotos.slice(0, 2),
        similarity: { visualSimilarity: 0.8, contentSimilarity: 0.9, temporalProximity: 0.95, spatialProximity: 0.98, semanticSimilarity: 0.7, overallSimilarity: 0.85 },
        groupType: 'retry_shots' as const,
        confidence: 0.9
      };

      const mockRecommendation = {
        group: mockGroup,
        keep: [mockPhotos[0]],
        archive: [mockPhotos[1]],
        rationale: 'Test rationale',
        estimatedTimeSaved: 2,
        confidence: 0.9
      };

      const mockActions = [
        { type: 'keep', photoId: 'photo-1', reason: 'Keep this one' },
        { type: 'archive', photoId: 'photo-2', reason: 'Archive this one' }
      ];

      const mockResult = {
        success: true,
        appliedActions: mockActions,
        failedActions: [],
        updatedPhotos: [mockPhotos[0], mockPhotos[1]]
      };

      // Set up all mocks BEFORE creating a new component
      const freshMockVisualSimilarity = createMockVisualSimilarity([mockGroup]);
      freshMockVisualSimilarity.analyzeSimilarity.mockResolvedValue([mockGroup]);
      vi.mocked(useVisualSimilarity).mockReturnValue(freshMockVisualSimilarity);
      vi.mocked(generateCurationRecommendation).mockReturnValue(mockRecommendation);
      vi.mocked(generateScoutAiMessage).mockReturnValue('Test message');
      vi.mocked(createActionsFromRecommendation).mockReturnValue(mockActions);
      vi.mocked(applyCurationActions).mockResolvedValue(mockResult);

      // Create a fresh component with the new mocks
      let freshContextValue: any;
      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { freshContextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(freshContextValue).toBeDefined();
        expect(freshContextValue.userPreferences).toBeDefined();
      });

      // Generate the suggestion first
      await act(async () => {
        await freshContextValue.analyzeSimilarPhotos(mockPhotos);
      });

      // Wait for suggestion to be added
      await waitFor(() => {
        expect(freshContextValue.suggestions).toHaveLength(1);
      });

      const suggestionId = freshContextValue.suggestions[0].id;
      const mockOnPhotoUpdate = vi.fn();

      await act(async () => {
        const result = await freshContextValue.acceptSuggestion(suggestionId, mockPhotos, mockOnPhotoUpdate);
        expect(result).toEqual(mockResult);
      });

      expect(createActionsFromRecommendation).toHaveBeenCalled();
      expect(applyCurationActions).toHaveBeenCalledWith(mockActions, mockPhotos, mockOnPhotoUpdate);
    });

    it('should handle accept suggestion errors', async () => {
      await act(async () => {
        await expect(
          contextValue.acceptSuggestion('nonexistent', mockPhotos, vi.fn())
        ).rejects.toThrow('Suggestion not found: nonexistent');
      });
    });

    it('should archive photos', async () => {
      const { archivePhoto } = await import('../../utils/photoActions');
      vi.mocked(archivePhoto).mockResolvedValue(undefined);

      const mockOnPhotoUpdate = vi.fn();

      await act(async () => {
        await contextValue.archivePhoto('photo-1', 'Test reason', mockPhotos, mockOnPhotoUpdate);
      });

      expect(archivePhoto).toHaveBeenCalledWith('photo-1', 'Test reason', mockPhotos, mockOnPhotoUpdate);
    });

    it('should restore photos', async () => {
      const { restorePhoto } = await import('../../utils/photoActions');
      vi.mocked(restorePhoto).mockResolvedValue(undefined);

      const mockOnPhotoUpdate = vi.fn();

      await act(async () => {
        await contextValue.restorePhoto('photo-1', mockPhotos, mockOnPhotoUpdate);
      });

      expect(restorePhoto).toHaveBeenCalledWith('photo-1', mockPhotos, mockOnPhotoUpdate);
    });

    it('should apply curation actions directly', async () => {
      const { applyCurationActions } = await import('../../utils/photoActions');
      
      const mockActions = [{ type: 'archive', photoId: 'photo-1', reason: 'Test' }];
      const mockResult = { success: true, appliedActions: mockActions, failedActions: [], updatedPhotos: [] };

      vi.mocked(applyCurationActions).mockResolvedValue(mockResult);

      const mockOnPhotoUpdate = vi.fn();

      await act(async () => {
        const result = await contextValue.applyCurationActions(mockActions, mockPhotos, mockOnPhotoUpdate);
        expect(result).toEqual(mockResult);
      });

      expect(applyCurationActions).toHaveBeenCalledWith(mockActions, mockPhotos, mockOnPhotoUpdate);
    });
  });

  describe('suggestion generation', () => {
    let contextValue: any;

    beforeEach(async () => {
      // Reset all mocks before each test
      vi.clearAllMocks();
      
      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { contextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(contextValue).toBeDefined();
      });
    });

    it('should generate suggestions from similarity groups', async () => {
      const { generateCurationRecommendation, generateScoutAiMessage } = await import('../../utils/curationLogic');
      
      const mockGroup = {
        id: 'group-1',
        photos: mockPhotos,
        similarity: { visualSimilarity: 0.8, contentSimilarity: 0.9, temporalProximity: 0.95, spatialProximity: 0.98, semanticSimilarity: 0.7, overallSimilarity: 0.85 },
        groupType: 'retry_shots' as const,
        confidence: 0.9
      };

      const mockRecommendation = {
        group: mockGroup,
        keep: [mockPhotos[0]],
        archive: [mockPhotos[1], mockPhotos[2]],
        rationale: 'Test rationale',
        estimatedTimeSaved: 2,
        confidence: 0.9
      };

      vi.mocked(generateCurationRecommendation).mockReturnValue(mockRecommendation);
      vi.mocked(generateScoutAiMessage).mockReturnValue('Generated message');

      const result = contextValue.generateSuggestion([mockGroup]);

      expect(result).toMatchObject({
        type: 'photo_curation',
        message: 'Generated message',
        recommendations: [mockRecommendation],
        confidence: 'high',
        actionable: true,
        status: 'pending'
      });
    });

    it('should set medium confidence for lower confidence recommendations', async () => {
      const { generateCurationRecommendation, generateScoutAiMessage } = await import('../../utils/curationLogic');
      
      const mockGroup = {
        id: 'group-1',
        photos: mockPhotos,
        similarity: { visualSimilarity: 0.8, contentSimilarity: 0.9, temporalProximity: 0.95, spatialProximity: 0.98, semanticSimilarity: 0.7, overallSimilarity: 0.85 },
        groupType: 'retry_shots' as const,
        confidence: 0.5
      };

      const lowConfidenceRecommendation = {
        group: mockGroup,
        keep: [mockPhotos[0]],
        archive: [mockPhotos[1]],
        rationale: 'Test rationale',
        estimatedTimeSaved: 2,
        confidence: 0.5
      };

      vi.mocked(generateCurationRecommendation).mockReturnValue(lowConfidenceRecommendation);
      vi.mocked(generateScoutAiMessage).mockReturnValue('Generated message');

      const result = contextValue.generateSuggestion([mockGroup]);

      expect(result.confidence).toBe('medium');
    });
  });

  describe('error handling with photo actions', () => {
    let contextValue: any;

    beforeEach(async () => {
      // Reset all mocks before each test
      vi.clearAllMocks();
      
      // Mock localStorage to return valid user preferences
      vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
        if (key === 'scoutai-preferences-test-user') {
          return JSON.stringify({
            userId: 'test-user',
            preferredGroupTypes: { retry_shots: true },
            qualityThreshold: 0.7,
            detailLevel: 'detailed',
            acceptanceRate: { photo_curation: 0.8 },
            learningData: {
              acceptedRecommendations: [],
              rejectedRecommendations: [],
              preferredKeepCriteria: []
            }
          });
        }
        return null;
      });
      
      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { contextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(contextValue).toBeDefined();
        expect(contextValue.userPreferences).toBeDefined();
      });
    });

    it('should handle partial failures in photo actions', async () => {
      const { applyCurationActions, createActionsFromRecommendation } = await import('../../utils/photoActions');
      const { useVisualSimilarity } = await import('../../hooks/useVisualSimilarity');
      const { generateCurationRecommendation, generateScoutAiMessage } = await import('../../utils/curationLogic');

      const mockGroup = {
        id: 'group-1',
        photos: mockPhotos.slice(0, 2),
        similarity: { visualSimilarity: 0.8, contentSimilarity: 0.9, temporalProximity: 0.95, spatialProximity: 0.98, semanticSimilarity: 0.7, overallSimilarity: 0.85 },
        groupType: 'retry_shots' as const,
        confidence: 0.9
      };

      const mockRecommendation = {
        group: mockGroup,
        keep: [mockPhotos[0]],
        archive: [mockPhotos[1]],
        rationale: 'Test rationale',
        estimatedTimeSaved: 2,
        confidence: 0.9
      };

      const mockActions = [
        { type: 'keep', photoId: 'photo-1', reason: 'Keep this one' },
        { type: 'archive', photoId: 'nonexistent', reason: 'Archive this one' }
      ];

      const mockResult = {
        success: false,
        appliedActions: [mockActions[0]],
        failedActions: [mockActions[1]],
        updatedPhotos: [mockPhotos[0]],
        error: 'Some actions failed'
      };

      // Set up all mocks BEFORE creating a new component
      const freshMockVisualSimilarity = createMockVisualSimilarity([mockGroup]);
      freshMockVisualSimilarity.analyzeSimilarity.mockResolvedValue([mockGroup]);
      vi.mocked(useVisualSimilarity).mockReturnValue(freshMockVisualSimilarity);
      vi.mocked(generateCurationRecommendation).mockReturnValue(mockRecommendation);
      vi.mocked(generateScoutAiMessage).mockReturnValue('Test message');
      vi.mocked(createActionsFromRecommendation).mockReturnValue(mockActions);
      vi.mocked(applyCurationActions).mockResolvedValue(mockResult);

      // Create a fresh component with the new mocks
      let freshContextValue: any;
      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { freshContextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(freshContextValue).toBeDefined();
        expect(freshContextValue.userPreferences).toBeDefined();
      });

      // Generate the suggestion first
      await act(async () => {
        await freshContextValue.analyzeSimilarPhotos(mockPhotos);
      });

      // Wait for suggestion to be added
      await waitFor(() => {
        expect(freshContextValue.suggestions).toHaveLength(1);
      });

      const suggestionId = freshContextValue.suggestions[0].id;
      const mockOnPhotoUpdate = vi.fn();

      await act(async () => {
        const result = await freshContextValue.acceptSuggestion(suggestionId, mockPhotos, mockOnPhotoUpdate);
        expect(result).toEqual(mockResult);
      });

      await waitFor(() => {
        expect(freshContextValue.error).toBe('Some actions failed');
      });
    });

    // Note: In practice, userPreferences are always loaded by the useEffect,
    // so the 'User preferences not loaded' case is primarily defensive programming
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage setItem errors gracefully', async () => {
      // Mock localStorage to throw error on setItem
      const mockSetItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(null),
          setItem: mockSetItem,
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });

      let contextValue: any;

      render(
        <MemoryRouter>
          <ScoutAiProvider userId="test-user">
            <TestComponent onContextReady={(ctx) => { contextValue = ctx; }} />
          </ScoutAiProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(contextValue).toBeDefined();
      });

      await act(async () => {
        await contextValue.updateUserPreferences({ qualityThreshold: 0.8 });
      });

      await waitFor(() => {
        expect(contextValue.error).toBe('Storage quota exceeded');
      });
    });
  });
});