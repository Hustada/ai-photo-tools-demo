// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CamIntellectProvider, useCamIntellect } from '../CamIntellectContext';
import type { Photo } from '../../types';
import type { CamIntellectSuggestion, UserCurationPreferences } from '../../types/camintellect';

// Mock the utility functions
vi.mock('../../utils/photoSimilarity', () => ({
  groupSimilarPhotos: vi.fn(),
}));

vi.mock('../../utils/curationLogic', () => ({
  generateCurationRecommendation: vi.fn(),
  generateCamIntellectMessage: vi.fn(),
}));

// Mock photos for testing
const mockPhotos: Photo[] = [
  {
    id: 'photo-1',
    project_id: 'project-1',
    creator_id: 'user-1',
    creator_name: 'John Doe',
    company_id: 'company-1',
    uri: 'https://example.com/photo1.jpg',
    captured_at: '2025-01-01T10:00:00Z',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    description: 'Roofing progress photo',
    tags: ['roofing', 'progress']
  },
  {
    id: 'photo-2',
    project_id: 'project-1',
    creator_id: 'user-1',
    creator_name: 'John Doe',
    company_id: 'company-1',
    uri: 'https://example.com/photo2.jpg',
    captured_at: '2025-01-01T10:05:00Z',
    coordinates: { latitude: 40.7129, longitude: -74.0061 },
    description: 'Roofing progress photo - different angle',
    tags: ['roofing', 'progress']
  }
];

// Test component to access context
const TestComponent: React.FC = () => {
  const context = useCamIntellect();
  
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
        onClick={() => context.acceptSuggestion('suggestion-1')}
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
    </div>
  );
};

const renderWithContext = (userId: string = 'test-user') => {
  return render(
    <CamIntellectProvider userId={userId}>
      <TestComponent />
    </CamIntellectProvider>
  );
};

describe('CamIntellectContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      
      expect(window.localStorage.getItem).toHaveBeenCalledWith('camintellect-preferences-test-user');
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
      const { groupSimilarPhotos } = await import('../../utils/photoSimilarity');
      const { generateCurationRecommendation, generateCamIntellectMessage } = await import('../../utils/curationLogic');
      
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

      vi.mocked(groupSimilarPhotos).mockResolvedValue([mockGroup]);
      vi.mocked(generateCurationRecommendation).mockReturnValue(mockRecommendation);
      vi.mocked(generateCamIntellectMessage).mockReturnValue('Test message');

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      await act(async () => {
        analyzeButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1');
      });

      expect(groupSimilarPhotos).toHaveBeenCalledWith(mockPhotos, expect.any(Number));
      expect(generateCurationRecommendation).toHaveBeenCalledWith(mockGroup);
      expect(generateCamIntellectMessage).toHaveBeenCalled();
    });

    it('should handle errors during analysis gracefully', async () => {
      const { groupSimilarPhotos } = await import('../../utils/photoSimilarity');
      vi.mocked(groupSimilarPhotos).mockRejectedValue(new Error('Analysis failed'));

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

    it('should not generate suggestions when no similar photos found', async () => {
      const { groupSimilarPhotos } = await import('../../utils/photoSimilarity');
      vi.mocked(groupSimilarPhotos).mockResolvedValue([]);

      renderWithContext();
      
      const analyzeButton = screen.getByTestId('analyze-button');
      
      await act(async () => {
        analyzeButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
        expect(screen.getByTestId('is-analyzing')).toHaveTextContent('idle');
      });
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
    it('should throw error when useCamIntellect used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useCamIntellect must be used within a CamIntellectProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('user preferences', () => {
    it('should update user preferences and persist to localStorage', async () => {
      // Create a test component that can call updateUserPreferences
      const PreferencesTestComponent: React.FC = () => {
        const context = useCamIntellect();
        
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
        <CamIntellectProvider userId="test-user">
          <PreferencesTestComponent />
        </CamIntellectProvider>
      );
      
      const updateButton = screen.getByTestId('update-preferences');
      
      await act(async () => {
        updateButton.click();
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'camintellect-preferences-test-user',
        expect.stringContaining('"qualityThreshold":0.8')
      );
    });
  });
});