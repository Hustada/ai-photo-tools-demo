// © 2025 Mark Hustad — MIT License

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScoutAiDemo } from '../ScoutAiDemo';
import type { Photo } from '../../types';

// Simple mock for the Scout AI context that works with the current component
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

const createMockPhoto = (id: string): Photo => ({
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
  archive_state: 'active'
});

const mockPhotos = [
  createMockPhoto('photo-1'),
  createMockPhoto('photo-2'),
  createMockPhoto('photo-3')
];

const mockOnPhotoUpdate = vi.fn();

describe('ScoutAiDemo - Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScoutAiContext.suggestions = [];
    mockScoutAiContext.isAnalyzing = false;
    mockScoutAiContext.error = null;
    mockScoutAiContext.analyzeSimilarPhotos.mockResolvedValue([]);
  });

  describe('Component Rendering', () => {
    it('should render when visible is true', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('Scout AI')).toBeInTheDocument();
      expect(screen.getByText('Trigger Analysis')).toBeInTheDocument();
    });

    it('should not render when visible is false', () => {
      const { container } = render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={false} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should display correct photo count', () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('3 photos loaded')).toBeInTheDocument();
    });
  });

  describe('Analysis Triggering', () => {
    it('should call analyzeSimilarPhotos when trigger button clicked', async () => {
      render(
        <ScoutAiDemo 
          photos={mockPhotos} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      const triggerButton = screen.getByText('Trigger Analysis');
      
      await act(async () => {
        fireEvent.click(triggerButton);
      });

      expect(mockScoutAiContext.analyzeSimilarPhotos).toHaveBeenCalledWith(mockPhotos, true);
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

      const triggerButton = screen.getByText('Analyzing...');
      expect(triggerButton).toBeDisabled();
    });

    it('should show analyzing status text when analyzing', () => {
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
  });

  describe('Error Handling', () => {
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
  });

  describe('Insufficient Photos', () => {
    it('should disable trigger button when less than 2 photos', () => {
      render(
        <ScoutAiDemo 
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
        <ScoutAiDemo 
          photos={[mockPhotos[0]]} 
          visible={true} 
          onPhotoUpdate={mockOnPhotoUpdate}
        />
      );

      expect(screen.getByText('💡 Load at least 2 photos to use Scout AI analysis')).toBeInTheDocument();
    });
  });
});