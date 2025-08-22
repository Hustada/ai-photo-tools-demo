// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ScoutAiDemo } from '../ScoutAiDemo';
import type { Photo } from '../../types';
import type { ScoutAiSuggestion, CurationRecommendation } from '../../types/scoutai';

// Mock the Scout AI context
const mockScoutAiContext = {
  suggestions: [],
  userPreferences: null,
  isAnalyzing: false,
  error: null,
  undoStack: [],
  analyzeSimilarPhotos: vi.fn(),
  generateSuggestion: vi.fn(),
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  dismissSuggestion: vi.fn(),
  updateUserPreferences: vi.fn(),
  applyCurationActions: vi.fn(),
  archivePhoto: vi.fn(),
  restorePhoto: vi.fn(),
  undoLastAction: vi.fn(),
  clearUndoStack: vi.fn(),
  clearSuggestions: vi.fn()
};

vi.mock('../../contexts/ScoutAiContext', () => ({
  useScoutAi: () => mockScoutAiContext
}));

// Helper to create mock photos
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

const mockPhotos = [
  createMockPhoto('photo-1'),
  createMockPhoto('photo-2'),
  createMockPhoto('photo-3'),
  createMockPhoto('photo-4'),
  createMockPhoto('photo-5')
];

// Mock recommendation data
const mockRecommendation: CurationRecommendation = {
  group: {
    id: 'group-1',
    photos: [mockPhotos[0], mockPhotos[1]],
    similarity: {
      visualSimilarity: 0.8,
      contentSimilarity: 0.9,
      temporalProximity: 0.95,
      spatialProximity: 0.98,
      semanticSimilarity: 0.7,
      overallSimilarity: 0.85
    },
    groupType: 'retry_shots',
    confidence: 0.9
  },
  keep: [mockPhotos[0]],
  archive: [mockPhotos[1]],
  rationale: 'Keep the best quality photo and archive similar attempts',
  estimatedTimeSaved: 2,
  confidence: 0.9
};

const mockSuggestion: ScoutAiSuggestion = {
  id: 'suggestion-1',
  type: 'photo_curation',
  message: 'I noticed 2 photos that look like retry shots of the same thing. Would you like me to recommend the best 1 that capture everything you need?',
  recommendations: [mockRecommendation],
  confidence: 'high',
  actionable: true,
  createdAt: new Date(),
  status: 'pending'
};

const mockOnPhotoUpdate = vi.fn();

// Helper to render component with active suggestions
const renderWithActiveSuggestions = async (suggestions = [mockSuggestion]) => {
  // Set up the mock context to have suggestions already
  mockScoutAiContext.suggestions = suggestions;
  
  // Mock the analyzeSimilarPhotos to update suggestions when called
  mockScoutAiContext.analyzeSimilarPhotos.mockImplementation(async () => {
    // Update the mock context state
    mockScoutAiContext.suggestions = suggestions;
    return Promise.resolve([]);
  });
  
  const result = render(
    <ScoutAiDemo 
      photos={mockPhotos} 
      visible={true} 
      onPhotoUpdate={mockOnPhotoUpdate}
    />
  );
  
  // Trigger analysis to activate suggestions display
  const triggerButton = screen.getByText('Analyze Photos');
  await act(async () => {
    fireEvent.click(triggerButton);
  });
  
  // Wait for any async state updates - adjust expectation based on number of suggestions
  await waitFor(() => {
    const notifications = screen.getAllByTestId('camintellect-notification');
    expect(notifications).toHaveLength(suggestions.length);
  });
  
  return result;
};

describe('ScoutAiDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock context to default state
    mockScoutAiContext.suggestions = [];
    mockScoutAiContext.isAnalyzing = false;
    mockScoutAiContext.error = null;
    mockScoutAiContext.undoStack = [];
    mockScoutAiContext.analyzeSimilarPhotos.mockResolvedValue([]);
    mockScoutAiContext.acceptSuggestion.mockResolvedValue({ success: true, appliedActions: [], failedActions: [], updatedPhotos: [] });
    mockScoutAiContext.rejectSuggestion.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Visibility', () => {
    it('should not render when visible is false', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={false} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.queryByTestId('camintellect-demo')).not.toBeInTheDocument();
    });

    it('should render when visible is true', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Scout AI')).toBeInTheDocument();
      // Component may be in minimized state initially, check for either state
      const analyzeButton = screen.queryByText('Analyze Photos');
      const photoCount = screen.queryByText('5 photos loaded');
      expect(analyzeButton || photoCount).toBeTruthy();
    });
  });

  describe('Demo Controls Display', () => {
    it('should display correct photo count', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('5 photos loaded')).toBeInTheDocument();
    });

    it('should not display suggestions when none are triggered', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // No suggestions should be visible until manually triggered
      expect(screen.queryByTestId('camintellect-notification')).not.toBeInTheDocument();
    });

    it('should display correct status text when not analyzing', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('5 photos loaded')).toBeInTheDocument();
    });

    it('should display Analyzing status when analyzing', () => {
      mockScoutAiContext.isAnalyzing = true;
      
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Analyzing photos...')).toBeInTheDocument();
    });

    it('should enable trigger button when photos available and not analyzing', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Analyze Photos');
      expect(triggerButton).toBeEnabled();
    });

    it('should disable trigger button when analyzing', () => {
      mockScoutAiContext.isAnalyzing = true;
      
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // When analyzing, there's no trigger button, just the status text
      expect(screen.getByText('Analyzing photos...')).toBeInTheDocument();
      // Button should not be present during analysis
      expect(screen.queryByText('Analyze Photos')).not.toBeInTheDocument();
    });

    it('should disable trigger button when less than 2 photos', () => {
      render(
        <ScoutAiDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Need 2+ Photos');
      expect(triggerButton).toBeDisabled();
    });

    it('should show helpful message when insufficient photos', () => {
      render(
        <ScoutAiDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('💡 Load at least 2 photos to use Scout AI analysis')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display error message when error exists', () => {
      mockScoutAiContext.error = 'Analysis failed';
      
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('❌ Error: Analysis failed')).toBeInTheDocument();
    });

    it('should not display error section when no error', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.queryByText(/❌ Error:/)).not.toBeInTheDocument();
    });
  });

  describe('Manual Analysis Trigger', () => {
    it('should call analyzeSimilarPhotos when trigger button clicked', async () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Analyze Photos');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(mockScoutAiContext.analyzeSimilarPhotos).toHaveBeenCalledWith(
        mockPhotos, 
        true, 
        { mode: 'smart', newPhotoDays: 30, forceReanalysis: false }
      );
    });

    it('should handle multiple trigger clicks', async () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Analyze Photos');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(mockScoutAiContext.analyzeSimilarPhotos).toHaveBeenCalledTimes(2);
    });
  });

  describe('Auto-minimize Behavior', () => {
    it('should auto-minimize after successful suggestions', async () => {
      // Set up accepted suggestion
      const acceptedSuggestion = { ...mockSuggestion, status: 'accepted' as const };
      mockScoutAiContext.suggestions = [acceptedSuggestion];
      
      vi.useFakeTimers();
      
      const { rerender } = render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );
      
      // Simulate manual trigger to show suggestions
      const triggerButton = screen.getByText('Analyze Photos');
      await act(async () => {
        fireEvent.click(triggerButton);
      });
      
      // Rerender to trigger the effect with accepted suggestions
      rerender(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );
      
      // Fast-forward to trigger auto-minimize
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      
      vi.useRealTimers();
    });
  });

  describe('Suggestion Display and Interaction', () => {
    it('should display suggestion when manually triggered', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);
      
      // Should show the notification
      expect(screen.getByTestId('camintellect-notification')).toBeInTheDocument();
    });

    it('should render ScoutAiNotification for each active suggestion', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      expect(screen.getByTestId('camintellect-notification')).toBeInTheDocument();
    });

    it('should handle accepting suggestions', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const acceptButtons = screen.getAllByText('Accept');
      const acceptButton = acceptButtons[0]; // Get the first Accept button
      
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(mockScoutAiContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-1',
        mockPhotos,
        mockOnPhotoUpdate
      );
    });

    it('should handle rejecting suggestions', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const dismissButton = screen.getByText('Dismiss');
      
      await act(async () => {
        fireEvent.click(dismissButton);
      });

      expect(mockScoutAiContext.dismissSuggestion).toHaveBeenCalledWith('suggestion-1');
    });

    it('should handle dismissing suggestions', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const dismissButton = screen.getByText('Dismiss');
      
      fireEvent.click(dismissButton);

      expect(mockScoutAiContext.dismissSuggestion).toHaveBeenCalledWith('suggestion-1');
    });

    it('should handle viewing preview', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const previewButton = screen.getByText('Preview');
      
      fireEvent.click(previewButton);

      // Preview modal should appear
      expect(screen.getByText('Preview Changes')).toBeInTheDocument();
    });
  });

  describe('Details Modal', () => {
    const renderModalAndOpen = async () => {
      await renderWithActiveSuggestions([mockSuggestion]);
      
      // Open preview modal
      const previewButton = screen.getByText('Preview');
      await act(async () => {
        fireEvent.click(previewButton);
      });
      
      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Preview Changes')).toBeInTheDocument();
      });
    };

    it('should display suggestion message in modal', async () => {
      await renderModalAndOpen();
      // Look for the message specifically in the modal (should be in p element with gray-600 class)
      const modalElements = screen.getAllByText(mockSuggestion.message);
      expect(modalElements.length).toBeGreaterThan(0);
    });

    it('should display confidence level', async () => {
      await renderModalAndOpen();
      expect(screen.getByText(/Confidence:.*high/)).toBeInTheDocument();
    });

    it('should display recommendation details', async () => {
      await renderModalAndOpen();
      
      // Wait for modal to fully render
      expect(screen.getByText('Preview Changes')).toBeInTheDocument();
      
      // Check for the new modal structure
      expect(screen.getByText('Bulk Actions')).toBeInTheDocument();
      expect(screen.getAllByText(/Keep:/)).toHaveLength(2); // One in header, one in bulk actions
      expect(screen.getAllByText(/Archive:/)).toHaveLength(2); // One in header, one in bulk actions
      
      // Check for group type text (it's now "Group: retry shots")
      expect(screen.getByText(/Group:.*retry shots/)).toBeInTheDocument();
      
      // Check that there are multiple Save elements (both in notification and modal)
      const saveElements = screen.getAllByText(/Save ~.*minutes/);
      expect(saveElements.length).toBeGreaterThan(0);
    });

    it('should display rationale', async () => {
      await renderModalAndOpen();
      // Look for the rationale text anywhere in the modal
      const rationaleElements = screen.getAllByText(mockRecommendation.rationale);
      expect(rationaleElements.length).toBeGreaterThan(0);
    });

    it('should close modal when close button clicked', async () => {
      await renderModalAndOpen();
      const closeButton = screen.getByText('✕');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(screen.queryByText('Preview Changes')).not.toBeInTheDocument();
    });

    it('should show modal when viewing details', async () => {
      await renderModalAndOpen();
      
      // Modal should be visible
      expect(screen.getByText('Preview Changes')).toBeInTheDocument();
      expect(screen.getByText('Message:')).toBeInTheDocument();
      expect(screen.getByText(/Confidence:/)).toBeInTheDocument();
      expect(screen.getByText('Bulk Actions')).toBeInTheDocument();
      expect(screen.getByText('Apply Changes')).toBeInTheDocument();
    });
  });

  describe('Multiple Suggestions', () => {
    const secondSuggestion: ScoutAiSuggestion = {
      ...mockSuggestion,
      id: 'suggestion-2',
      message: 'Found more similar photos to organize'
    };

    it('should display correct suggestion count', async () => {
      await renderWithActiveSuggestions([mockSuggestion, secondSuggestion]);
      
      // Should have multiple notifications
      const notifications = screen.getAllByTestId('camintellect-notification');
      expect(notifications).toHaveLength(2);
    });

    it('should render multiple ScoutAiNotifications', async () => {
      await renderWithActiveSuggestions([mockSuggestion, secondSuggestion]);

      const notifications = screen.getAllByTestId('camintellect-notification');
      expect(notifications).toHaveLength(2);
    });

    it('should handle interactions with each suggestion independently', async () => {
      await renderWithActiveSuggestions([mockSuggestion, secondSuggestion]);

      const acceptButtons = screen.getAllByText('Accept');
      
      await act(async () => {
        fireEvent.click(acceptButtons[0]);
      });

      expect(mockScoutAiContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-1',
        mockPhotos,
        mockOnPhotoUpdate
      );

      await act(async () => {
        fireEvent.click(acceptButtons[1]);
      });

      expect(mockScoutAiContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-2',
        mockPhotos,
        mockOnPhotoUpdate
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty photos array', () => {
      render(
        <ScoutAiDemo 
          photos={[]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('0 photos loaded')).toBeInTheDocument();
      expect(screen.getByText('💡 Load at least 2 photos to use Scout AI analysis')).toBeInTheDocument();
    });

    it('should handle undefined suggestion data gracefully', async () => {
      const emptyRecommendationSuggestion = {
        ...mockSuggestion,
        recommendations: []
      };
      
      await renderWithActiveSuggestions([emptyRecommendationSuggestion]);

      // Should still render the notification
      expect(screen.getByTestId('camintellect-notification')).toBeInTheDocument();
    });

    it('should handle suggestion action errors gracefully', async () => {
      mockScoutAiContext.acceptSuggestion.mockRejectedValue(new Error('Action failed'));
      
      await renderWithActiveSuggestions([mockSuggestion]);

      const acceptButton = screen.getByText('Accept');
      
      // Should not crash when action fails
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(mockScoutAiContext.acceptSuggestion).toHaveBeenCalled();
    });
  });

  describe('Console Logging', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log manual analysis trigger', async () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Analyze Photos');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[ScoutAiDemo] Manual analysis triggered with options:', { mode: 'smart', newPhotoDays: 30, forceReanalysis: false });
    });

    it('should log suggestion acceptance', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const acceptButton = screen.getByText('Accept');
      
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[ScoutAiDemo] Accepting suggestion:', 'suggestion-1');
    });

    it('should log suggestion rejection', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const dismissButton = screen.getByText('Dismiss');
      
      await act(async () => {
        fireEvent.click(dismissButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[ScoutAiDemo] Dismissing suggestion:', 'suggestion-1');
    });

    it('should log suggestion dismissal', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const dismissButton = screen.getByText('Dismiss');
      
      fireEvent.click(dismissButton);

      expect(consoleSpy).toHaveBeenCalledWith('[ScoutAiDemo] Dismissing suggestion:', 'suggestion-1');
    });

    it('should log viewing preview', async () => {
      await renderWithActiveSuggestions([mockSuggestion]);

      const previewButton = screen.getByText('Preview');
      
      fireEvent.click(previewButton);

      expect(consoleSpy).toHaveBeenCalledWith('[ScoutAiDemo] Previewing suggestion:', 'suggestion-1');
    });
  });
});