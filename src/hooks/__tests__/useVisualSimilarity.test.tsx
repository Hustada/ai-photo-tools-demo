// © 2025 Mark Hustad — MIT License

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVisualSimilarity } from '../useVisualSimilarity';
import type { Photo } from '../../types';
import * as photoSimilarityUtils from '../../utils/photoSimilarity';

// Mock the photo similarity utilities
vi.mock('../../utils/photoSimilarity', () => ({
  calculatePhotoSimilarityAsync: vi.fn(),
  groupSimilarPhotos: vi.fn(),
  findLikelyDuplicateCandidates: vi.fn(),
  batchGenerateDescriptions: vi.fn(),
  calculateVisualContentSimilarity: vi.fn(),
  calculateTemporalProximity: vi.fn(),
  calculateSpatialProximity: vi.fn(),
}));

const mockPhotos: Photo[] = [
  {
    id: 'photo1',
    company_id: 'company1',
    creator_id: 'user1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project1',
    processing_status: 'processed',
    coordinates: [{ latitude: 40.7128, longitude: -74.0060 }],
    uris: [
      { type: 'web', uri: 'https://example.com/photo1.jpg', url: 'https://example.com/photo1.jpg' }
    ],
    hash: 'hash1',
    description: 'Test photo 1',
    internal: false,
    photo_url: 'https://example.com/photo1.jpg',
    captured_at: Date.now() - 1000,
    created_at: Date.now() - 1000,
    updated_at: Date.now() - 1000
  },
  {
    id: 'photo2',
    company_id: 'company1',
    creator_id: 'user1',
    creator_type: 'user',
    creator_name: 'Test User',
    project_id: 'project1',
    processing_status: 'processed',
    coordinates: [{ latitude: 40.7128, longitude: -74.0060 }],
    uris: [
      { type: 'web', uri: 'https://example.com/photo2.jpg', url: 'https://example.com/photo2.jpg' }
    ],
    hash: 'hash2',
    description: 'Test photo 2',
    internal: false,
    photo_url: 'https://example.com/photo2.jpg',
    captured_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now()
  }
];

describe('useVisualSimilarity', () => {
  const mockCalculatePhotoSimilarityAsync = vi.mocked(photoSimilarityUtils.calculatePhotoSimilarityAsync);
  const mockGroupSimilarPhotos = vi.mocked(photoSimilarityUtils.groupSimilarPhotos);
  const mockFindLikelyDuplicateCandidates = vi.mocked(photoSimilarityUtils.findLikelyDuplicateCandidates);
  const mockBatchGenerateDescriptions = vi.mocked(photoSimilarityUtils.batchGenerateDescriptions);
  const mockCalculateVisualContentSimilarity = vi.mocked(photoSimilarityUtils.calculateVisualContentSimilarity);
  const mockCalculateTemporalProximity = vi.mocked(photoSimilarityUtils.calculateTemporalProximity);
  const mockCalculateSpatialProximity = vi.mocked(photoSimilarityUtils.calculateSpatialProximity);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the smart analysis workflow
    mockFindLikelyDuplicateCandidates.mockReturnValue(mockPhotos); // Return both photos as candidates
    mockBatchGenerateDescriptions.mockResolvedValue(new Map([
      ['photo1', 'Construction site with electrical work'],
      ['photo2', 'Construction site with electrical installation']
    ]));
    mockCalculateVisualContentSimilarity.mockReturnValue(0.8);
    mockCalculateTemporalProximity.mockReturnValue(0.9);
    mockCalculateSpatialProximity.mockReturnValue(0.95);
    
    // Mock successful similarity calculation (fallback)
    mockCalculatePhotoSimilarityAsync.mockResolvedValue({
      visualSimilarity: 0.8,
      contentSimilarity: 0.7,
      temporalProximity: 0.9,
      spatialProximity: 0.95,
      semanticSimilarity: 0.6,
      overallSimilarity: 0.75
    });

    // Mock group creation (fallback)
    mockGroupSimilarPhotos.mockReturnValue([
      {
        id: 'group1',
        photos: mockPhotos,
        similarity: {
          visualSimilarity: 0.8,
          contentSimilarity: 0.7,
          temporalProximity: 0.9,
          spatialProximity: 0.95,
          semanticSimilarity: 0.6,
          overallSimilarity: 0.75
        },
        groupType: 'retry_shots',
        confidence: 0.8
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVisualSimilarity());

    expect(result.current.state).toEqual({
      isAnalyzing: false,
      progress: 0,
      error: null,
      similarityGroups: [],
      similarityMatrix: new Map()
    });
  });

  it('should handle photo analysis with less than 2 photos', async () => {
    const { result } = renderHook(() => useVisualSimilarity());

    await act(async () => {
      await result.current.analyzeSimilarity([mockPhotos[0]]);
    });

    expect(result.current.state.error).toBe('Need at least 2 photos for similarity analysis');
    expect(result.current.state.similarityGroups).toEqual([]);
  });

  it('should analyze photos and create similarity groups', async () => {
    const { result } = renderHook(() => useVisualSimilarity({
      similarityThreshold: 0.6,
      batchSize: 2,
      maxConcurrent: 1
    }));

    await act(async () => {
      await result.current.analyzeSimilarity(mockPhotos);
    });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.similarityGroups).toHaveLength(1);
    expect(mockBatchGenerateDescriptions).toHaveBeenCalledWith(mockPhotos);
  });

  it('should track progress during analysis', async () => {
    const { result } = renderHook(() => useVisualSimilarity({
      batchSize: 1,
      maxConcurrent: 1
    }));

    const progressValues: number[] = [];
    
    // Mock a slower response to catch progress updates
    mockCalculatePhotoSimilarityAsync.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        visualSimilarity: 0.8,
        contentSimilarity: 0.7,
        temporalProximity: 0.9,
        spatialProximity: 0.95,
        semanticSimilarity: 0.6,
        overallSimilarity: 0.75
      };
    });

    act(() => {
      result.current.analyzeSimilarity(mockPhotos);
    });

    // Monitor progress updates
    await waitFor(() => {
      progressValues.push(result.current.state.progress);
      return result.current.state.progress > 0;
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.state.progress).toBe(100);
  });

  it('should handle analysis cancellation', async () => {
    const { result } = renderHook(() => useVisualSimilarity());

    // Start analysis
    act(() => {
      result.current.analyzeSimilarity(mockPhotos);
    });

    expect(result.current.state.isAnalyzing).toBe(true);

    // Cancel analysis
    act(() => {
      result.current.cancelAnalysis();
    });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    expect(result.current.state.error).toBe('Analysis cancelled by user');
  });

  it('should clear analysis state', () => {
    const { result } = renderHook(() => useVisualSimilarity());

    // First set some state
    act(() => {
      result.current.analyzeSimilarity(mockPhotos);
    });

    expect(result.current.state.isAnalyzing).toBe(true);

    // Clear analysis
    act(() => {
      result.current.clearAnalysis();
    });

    expect(result.current.state).toEqual({
      isAnalyzing: false,
      progress: 0,
      error: null,
      similarityGroups: [],
      similarityMatrix: new Map()
    });
  });

  it('should get similarity score between photos', async () => {
    const { result } = renderHook(() => useVisualSimilarity());

    await act(async () => {
      await result.current.analyzeSimilarity(mockPhotos);
    });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    const similarity = result.current.getSimilarityScore('photo1', 'photo2');
    expect(similarity).toBeDefined();
    expect(similarity?.overallSimilarity).toBe(0.8); // Updated to match the smart analysis result
  });

  it('should get group for specific photo', async () => {
    const { result } = renderHook(() => useVisualSimilarity());

    await act(async () => {
      await result.current.analyzeSimilarity(mockPhotos);
    });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    const group = result.current.getGroupForPhoto('photo1');
    expect(group).toBeDefined();
    expect(group?.photos).toHaveLength(2);
    expect(group?.groupType).toBe('retry_shots');
  });

  it('should handle analysis errors gracefully', async () => {
    const { result } = renderHook(() => useVisualSimilarity());

    // Mock analysis failure in the batch description generation
    mockFindLikelyDuplicateCandidates.mockReturnValue(mockPhotos);
    mockBatchGenerateDescriptions.mockRejectedValue(new Error('API failed'));

    await act(async () => {
      await result.current.analyzeSimilarity(mockPhotos);
    });

    await waitFor(() => {
      expect(result.current.state.isAnalyzing).toBe(false);
    });

    expect(result.current.state.error).toBe('API failed');
  });

  it('should use custom options', () => {
    const customOptions = {
      similarityThreshold: 0.8,
      batchSize: 10,
      maxConcurrent: 5
    };

    const { result } = renderHook(() => useVisualSimilarity(customOptions));

    // Test that the hook is created successfully with custom options
    expect(result.current.state.isAnalyzing).toBe(false);
    expect(typeof result.current.analyzeSimilarity).toBe('function');
  });
});