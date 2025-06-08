// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CamIntellectDemo } from '../CamIntellectDemo';
import type { Photo } from '../../types';
import type { CamIntellectSuggestion, CurationRecommendation } from '../../types/camintellect';

// Mock the CamIntellect context
const mockCamIntellectContext = {
  suggestions: [],
  userPreferences: null,
  isAnalyzing: false,
  error: null,
  analyzeSimilarPhotos: vi.fn(),
  generateSuggestion: vi.fn(),
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  dismissSuggestion: vi.fn(),
  updateUserPreferences: vi.fn(),
  applyCurationActions: vi.fn(),
  archivePhoto: vi.fn(),
  restorePhoto: vi.fn()
};

vi.mock('../../contexts/CamIntellectContext', () => ({
  useCamIntellect: () => mockCamIntellectContext
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

const mockSuggestion: CamIntellectSuggestion = {
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

describe('CamIntellectDemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock context to default state
    mockCamIntellectContext.suggestions = [];
    mockCamIntellectContext.isAnalyzing = false;
    mockCamIntellectContext.error = null;
    mockCamIntellectContext.analyzeSimilarPhotos.mockResolvedValue([]);
    mockCamIntellectContext.acceptSuggestion.mockResolvedValue({ success: true, appliedActions: [], failedActions: [], updatedPhotos: [] });
    mockCamIntellectContext.rejectSuggestion.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Visibility', () => {
    it('should not render when visible is false', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={false} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.queryByTestId('camintellect-demo')).not.toBeInTheDocument();
    });

    it('should render when visible is true', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('🧪 CamIntellect Demo Controls')).toBeInTheDocument();
    });
  });

  describe('Demo Controls Display', () => {
    it('should display correct photo count', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Photos loaded:')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display suggestion count', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Suggestions:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should display Ready status when not analyzing', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should display Analyzing status when analyzing', () => {
      mockCamIntellectContext.isAnalyzing = true;
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    it('should enable trigger button when photos available and not analyzing', () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      expect(triggerButton).toBeEnabled();
    });

    it('should disable trigger button when analyzing', () => {
      mockCamIntellectContext.isAnalyzing = true;
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      expect(triggerButton).toBeDisabled();
    });

    it('should disable trigger button when less than 2 photos', () => {
      render(
        <CamIntellectDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      expect(triggerButton).toBeDisabled();
    });

    it('should show helpful message when insufficient photos', () => {
      render(
        <CamIntellectDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('💡 Load at least 2 photos to see CamIntellect suggestions')).toBeInTheDocument();
    });
  });

  describe('Error Display', () => {
    it('should display error message when error exists', () => {
      mockCamIntellectContext.error = 'Analysis failed';
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('❌ Error: Analysis failed')).toBeInTheDocument();
    });

    it('should not display error section when no error', () => {
      render(
        <CamIntellectDemo 
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
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).toHaveBeenCalledWith(mockPhotos);
    });

    it('should handle multiple trigger clicks', async () => {
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).toHaveBeenCalledTimes(2);
    });
  });

  describe('Automatic Analysis', () => {
    it('should trigger analysis automatically when photos become available', async () => {
      vi.useFakeTimers();
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // Fast-forward the timer
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Wait a bit for the async operation
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).toHaveBeenCalledWith(mockPhotos);

      vi.useRealTimers();
    });

    it('should not trigger automatic analysis when less than 2 photos', async () => {
      vi.useFakeTimers();
      
      render(
        <CamIntellectDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not trigger automatic analysis when not visible', async () => {
      vi.useFakeTimers();
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={false} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should only trigger automatic analysis once', async () => {
      vi.useFakeTimers();
      
      const { rerender } = render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Rerender with same props
      rerender(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockCamIntellectContext.analyzeSimilarPhotos).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('Suggestion Display and Interaction', () => {
    it('should display suggestion count when suggestions exist', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // Look for suggestion count specifically in the demo controls
      expect(screen.getByText('Suggestions:')).toBeInTheDocument();
      const suggestionElements = screen.getAllByText('1');
      expect(suggestionElements.length).toBeGreaterThan(0);
    });

    it('should render CamIntellectNotification for each suggestion', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByTestId('camintellect-notification')).toBeInTheDocument();
    });

    it('should handle accepting suggestions', async () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const acceptButtons = screen.getAllByText('Accept');
      const acceptButton = acceptButtons[0]; // Get the first Accept button
      
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(mockCamIntellectContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-1',
        mockPhotos,
        mockOnPhotoUpdate
      );
    });

    it('should handle rejecting suggestions', async () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const rejectButton = screen.getByText('Not Now');
      
      await act(async () => {
        fireEvent.click(rejectButton);
      });

      expect(mockCamIntellectContext.rejectSuggestion).toHaveBeenCalledWith('suggestion-1');
    });

    it('should handle dismissing suggestions', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const dismissButton = screen.getByLabelText('Dismiss suggestion');
      
      fireEvent.click(dismissButton);

      expect(mockCamIntellectContext.dismissSuggestion).toHaveBeenCalledWith('suggestion-1');
    });

    it('should handle viewing details', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const detailsButton = screen.getByText('View Details');
      
      fireEvent.click(detailsButton);

      // Details modal should appear
      expect(screen.getByText('CamIntellect Suggestion Details')).toBeInTheDocument();
    });
  });

  describe('Details Modal', () => {
    const renderModalAndOpen = () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // Open details modal
      const detailsButton = screen.getByText('View Details');
      fireEvent.click(detailsButton);
    };

    it('should display suggestion message in modal', () => {
      renderModalAndOpen();
      // Look for the message specifically in the modal (should be in p element with gray-600 class)
      const modalElements = screen.getAllByText(mockSuggestion.message);
      expect(modalElements.length).toBeGreaterThan(0);
    });

    it('should display confidence level', () => {
      renderModalAndOpen();
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('should display recommendation details', () => {
      renderModalAndOpen();
      expect(screen.getByText('retry shots')).toBeInTheDocument();
      // Check for individual parts since they may be split across elements
      expect(screen.getByText('Photos:')).toBeInTheDocument();
      expect(screen.getByText('Keep:')).toBeInTheDocument();
      expect(screen.getByText('Archive:')).toBeInTheDocument();
      expect(screen.getByText('2 minutes')).toBeInTheDocument(); // time saved
    });

    it('should display rationale', () => {
      renderModalAndOpen();
      // Look for the rationale text anywhere in the modal
      const rationaleElements = screen.getAllByText(mockRecommendation.rationale);
      expect(rationaleElements.length).toBeGreaterThan(0);
    });

    it('should close modal when close button clicked', () => {
      renderModalAndOpen();
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);

      expect(screen.queryByText('CamIntellect Suggestion Details')).not.toBeInTheDocument();
    });

    it('should show modal when viewing details', () => {
      renderModalAndOpen();
      
      // Modal should be visible
      expect(screen.getByText('CamIntellect Suggestion Details')).toBeInTheDocument();
      expect(screen.getByText('Message:')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
      expect(screen.getByText('Recommendations:')).toBeInTheDocument();
    });
  });

  describe('Multiple Suggestions', () => {
    const secondSuggestion: CamIntellectSuggestion = {
      ...mockSuggestion,
      id: 'suggestion-2',
      message: 'Found more similar photos to organize'
    };

    it('should display correct suggestion count', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion, secondSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // Look for suggestion count specifically in the demo controls
      expect(screen.getByText('Suggestions:')).toBeInTheDocument();
      const suggestionElements = screen.getAllByText('2');
      expect(suggestionElements.length).toBeGreaterThan(0);
    });

    it('should render multiple CamIntellectNotifications', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion, secondSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const notifications = screen.getAllByTestId('camintellect-notification');
      expect(notifications).toHaveLength(2);
    });

    it('should handle interactions with each suggestion independently', async () => {
      mockCamIntellectContext.suggestions = [mockSuggestion, secondSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const acceptButtons = screen.getAllByText('Accept');
      
      await act(async () => {
        fireEvent.click(acceptButtons[0]);
      });

      expect(mockCamIntellectContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-1',
        mockPhotos,
        mockOnPhotoUpdate
      );

      await act(async () => {
        fireEvent.click(acceptButtons[1]);
      });

      expect(mockCamIntellectContext.acceptSuggestion).toHaveBeenCalledWith(
        'suggestion-2',
        mockPhotos,
        mockOnPhotoUpdate
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty photos array', () => {
      render(
        <CamIntellectDemo 
          photos={[]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Photos loaded:')).toBeInTheDocument();
      expect(screen.getByText('💡 Load at least 2 photos to see CamIntellect suggestions')).toBeInTheDocument();
    });

    it('should handle undefined suggestion data gracefully', () => {
      mockCamIntellectContext.suggestions = [{
        ...mockSuggestion,
        recommendations: []
      }];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      // Should still render the notification
      expect(screen.getByTestId('camintellect-notification')).toBeInTheDocument();
    });

    it('should handle suggestion action errors gracefully', async () => {
      mockCamIntellectContext.acceptSuggestion.mockRejectedValue(new Error('Action failed'));
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const acceptButton = screen.getByText('Accept');
      
      // Should not crash when action fails
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(mockCamIntellectContext.acceptSuggestion).toHaveBeenCalled();
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
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[CamIntellectDemo] Manual analysis triggered');
    });

    it('should log suggestion acceptance', async () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const acceptButton = screen.getByText('Accept');
      
      await act(async () => {
        fireEvent.click(acceptButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[CamIntellectDemo] Accepting suggestion:', 'suggestion-1');
    });

    it('should log suggestion rejection', async () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const rejectButton = screen.getByText('Not Now');
      
      await act(async () => {
        fireEvent.click(rejectButton);
      });

      expect(consoleSpy).toHaveBeenCalledWith('[CamIntellectDemo] Rejecting suggestion:', 'suggestion-1');
    });

    it('should log suggestion dismissal', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const dismissButton = screen.getByLabelText('Dismiss suggestion');
      
      fireEvent.click(dismissButton);

      expect(consoleSpy).toHaveBeenCalledWith('[CamIntellectDemo] Dismissing suggestion:', 'suggestion-1');
    });

    it('should log viewing details', () => {
      mockCamIntellectContext.suggestions = [mockSuggestion];
      
      render(
        <CamIntellectDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const detailsButton = screen.getByText('View Details');
      
      fireEvent.click(detailsButton);

      expect(consoleSpy).toHaveBeenCalledWith('[CamIntellectDemo] Viewing details for suggestion:', 'suggestion-1');
    });
  });
});