// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ScoutAiNotification } from '../ScoutAiNotification';
import type { ScoutAiSuggestion, CurationRecommendation } from '../../types/scoutai';
import type { Photo } from '../../types';

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

const mockRecommendation: CurationRecommendation = {
  group: {
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
    groupType: 'retry_shots',
    confidence: 0.9
  },
  keep: [mockPhotos[0]],
  archive: [mockPhotos[1]],
  rationale: 'I found 2 photos showing multiple attempts at the same shot. This photo captures everything you need with the best quality and most complete documentation.',
  estimatedTimeSaved: 0.5,
  confidence: 0.9
};

const mockSuggestion: ScoutAiSuggestion = {
  id: 'suggestion-1',
  type: 'photo_curation',
  message: 'I noticed 2 photos that look like retry shots of the same thing. Would you like me to recommend the best 1 that capture everything you need?',
  recommendations: [mockRecommendation],
  confidence: 'high',
  actionable: true,
  createdAt: new Date('2025-01-01T10:00:00Z'),
  status: 'pending'
};

describe('ScoutAiNotification', () => {
  const mockOnAccept = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render Scout AI suggestion with proper styling', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      // Should show Scout AI branding
      expect(screen.getByText('Scout AI')).toBeInTheDocument();
      
      // Should show the suggestion message
      expect(screen.getByText(mockSuggestion.message)).toBeInTheDocument();
      
      // Should have proper visual styling
      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('bg-sky-50'); // Light blue background
    });

    it('should show confidence indicator for high confidence suggestions', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      // Should indicate high confidence
      expect(screen.getByTestId('confidence-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('confidence-indicator')).toHaveTextContent('High Confidence');
    });

    it('should show different styling for medium confidence suggestions', () => {
      const mediumConfidenceSuggestion = {
        ...mockSuggestion,
        confidence: 'medium' as const
      };

      render(
        <ScoutAiNotification
          suggestion={mediumConfidenceSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByTestId('confidence-indicator')).toHaveTextContent('Medium Confidence');
    });

    it('should show time savings when available', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText(/save/i)).toBeInTheDocument();
      expect(screen.getByText('0.5')).toBeInTheDocument();
    });

    it('should not show time savings for zero savings', () => {
      const noSavingsSuggestion = {
        ...mockSuggestion,
        recommendations: [{
          ...mockRecommendation,
          estimatedTimeSaved: 0
        }]
      };

      render(
        <ScoutAiNotification
          suggestion={noSavingsSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.queryByText(/minute/i)).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render all action buttons for actionable suggestions', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should not show action buttons for non-actionable suggestions', () => {
      const nonActionableSuggestion = {
        ...mockSuggestion,
        actionable: false
      };

      render(
        <ScoutAiNotification
          suggestion={nonActionableSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
    });

    it('should call onAccept when accept button is clicked', async () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      await act(async () => {
        fireEvent.click(acceptButton);
      });
      
      expect(mockOnAccept).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(mockOnDismiss).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should call onPreview when preview button is clicked', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /preview/i }));
      expect(mockOnPreview).toHaveBeenCalledWith(mockSuggestion);
    });
  });

  describe('Animation and Interaction', () => {
    it('should have proper accessibility attributes', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveAttribute('role', 'alert');
      expect(notification).toHaveAttribute('aria-label', expect.stringContaining('Scout AI suggestion'));
    });

    it('should show loading state when suggestion is being processed', async () => {
      const processingMockOnAccept = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={processingMockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      expect(acceptButton).toBeDisabled();
      expect(screen.getByText(/applying/i)).toBeInTheDocument(); // Button text shows "Applying..."

      await waitFor(() => {
        expect(acceptButton).not.toBeDisabled();
      });
    });

    it('should show fade-in animation on mount', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('animate-fade-in');
    });
  });

  describe('Suggestion Status Display', () => {
    it('should show accepted status styling for accepted suggestions', () => {
      const acceptedSuggestion = {
        ...mockSuggestion,
        status: 'accepted' as const
      };

      render(
        <ScoutAiNotification
          suggestion={acceptedSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText(/accepted/i)).toBeInTheDocument();
      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('bg-green-50');
    });

    it('should show rejected status styling for rejected suggestions', () => {
      const rejectedSuggestion = {
        ...mockSuggestion,
        status: 'rejected' as const
      };

      render(
        <ScoutAiNotification
          suggestion={rejectedSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText(/not applied/i)).toBeInTheDocument();
      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('bg-gray-50');
    });

    it('should show dismissed status styling for dismissed suggestions', () => {
      const dismissedSuggestion = {
        ...mockSuggestion,
        status: 'dismissed' as const
      };

      render(
        <ScoutAiNotification
          suggestion={dismissedSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText(/dismissed/i)).toBeInTheDocument();
      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('bg-gray-50');
    });
  });

  describe('Photo Summary', () => {
    it('should show photo count summary', () => {
      render(
        <ScoutAiNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText(/2.*photos/i)).toBeInTheDocument();
      expect(screen.getByText(/keep/i)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle multiple recommendation groups', () => {
      const multiGroupSuggestion = {
        ...mockSuggestion,
        recommendations: [mockRecommendation, { ...mockRecommendation, group: { ...mockRecommendation.group, id: 'group-2' } }]
      };

      render(
        <ScoutAiNotification
          suggestion={multiGroupSuggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onPreview={mockOnPreview}
        />
      );

      expect(screen.getByText('4')).toBeInTheDocument(); // 2 groups * 2 photos each
      expect(screen.getAllByText(/photos/i)).toHaveLength(2); // In message and summary
    });
  });
});