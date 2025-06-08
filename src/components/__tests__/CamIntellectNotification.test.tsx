// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CamIntellectNotification } from '../CamIntellectNotification';
import type { CamIntellectSuggestion, CurationRecommendation } from '../../types/camintellect';
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

const mockSuggestion: CamIntellectSuggestion = {
  id: 'suggestion-1',
  type: 'photo_curation',
  message: 'I noticed 2 photos that look like retry shots of the same thing. Would you like me to recommend the best 1 that capture everything you need?',
  recommendations: [mockRecommendation],
  confidence: 'high',
  actionable: true,
  createdAt: new Date('2025-01-01T10:00:00Z'),
  status: 'pending'
};

describe('CamIntellectNotification', () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render CamIntellect suggestion with proper styling', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      // Should show CamIntellect branding
      expect(screen.getByText('CamIntellect')).toBeInTheDocument();
      
      // Should show the suggestion message
      expect(screen.getByText(mockSuggestion.message)).toBeInTheDocument();
      
      // Should have proper visual styling
      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveClass('bg-sky-50'); // Light blue background
    });

    it('should show confidence indicator for high confidence suggestions', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={mediumConfidenceSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByTestId('confidence-indicator')).toHaveTextContent('Medium Confidence');
    });

    it('should show time savings when available', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={noSavingsSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.queryByText(/minute/i)).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render all action buttons for actionable suggestions', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should not show action buttons for non-actionable suggestions', () => {
      const nonActionableSuggestion = {
        ...mockSuggestion,
        actionable: false
      };

      render(
        <CamIntellectNotification
          suggestion={nonActionableSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /not now/i })).not.toBeInTheDocument();
    });

    it('should call onAccept when accept button is clicked', async () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      await act(async () => {
        fireEvent.click(acceptButton);
      });
      
      expect(mockOnAccept).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should call onReject when "Not Now" button is clicked', async () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      const rejectButton = screen.getByRole('button', { name: /not now/i });
      await act(async () => {
        fireEvent.click(rejectButton);
      });
      
      expect(mockOnReject).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(mockOnDismiss).toHaveBeenCalledWith(mockSuggestion.id);
    });

    it('should call onViewDetails when view details button is clicked', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /view details/i }));
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockSuggestion);
    });
  });

  describe('Animation and Interaction', () => {
    it('should have proper accessibility attributes', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      const notification = screen.getByTestId('camintellect-notification');
      expect(notification).toHaveAttribute('role', 'alert');
      expect(notification).toHaveAttribute('aria-label', expect.stringContaining('CamIntellect suggestion'));
    });

    it('should show loading state when suggestion is being processed', async () => {
      const processingMockOnAccept = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={processingMockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /accept/i });
      fireEvent.click(acceptButton);

      expect(acceptButton).toBeDisabled();
      expect(screen.getAllByText(/processing/i)).toHaveLength(2); // Button text + overlay

      await waitFor(() => {
        expect(acceptButton).not.toBeDisabled();
      });
    });

    it('should show fade-in animation on mount', () => {
      render(
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={acceptedSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={rejectedSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={dismissedSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={mockSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
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
        <CamIntellectNotification
          suggestion={multiGroupSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onDismiss={mockOnDismiss}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('4')).toBeInTheDocument(); // 2 groups * 2 photos each
      expect(screen.getAllByText(/photos/i)).toHaveLength(2); // In message and summary
    });
  });
});