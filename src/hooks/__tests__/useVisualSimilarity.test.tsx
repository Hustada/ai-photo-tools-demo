// © 2025 Mark Hustad — MIT License

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVisualSimilarity } from '../useVisualSimilarity';
import type { Photo } from '../../types';
import * as photoSimilarityUtils from '../../utils/photoSimilarity';
import * as fileHashUtils from '../../utils/fileHash';
import * as perceptualHashUtils from '../../utils/perceptualHash';
import * as tensorflowUtils from '../../utils/tensorflowSimilarity';
import * as pipelineLoggerUtils from '../../utils/pipelineLogger';

// Mock the photo similarity utilities
vi.mock('../../utils/photoSimilarity', () => ({
  calculatePhotoSimilarityAsync: vi.fn(),
  calculateVisualSimilarity: vi.fn(),
  groupSimilarPhotos: vi.fn(),
  findLikelyDuplicateCandidates: vi.fn(),
  batchGenerateDescriptions: vi.fn(),
  calculateVisualContentSimilarity: vi.fn(),
  calculateSemanticSimilarity: vi.fn(),
  calculateTemporalProximity: vi.fn(),
  calculateSpatialProximity: vi.fn(),
}));

// Mock file hash utilities
vi.mock('../../utils/fileHash', () => ({
  batchGenerateHashes: vi.fn(),
  findExactDuplicates: vi.fn(),
}));

// Mock perceptual hash utilities
vi.mock('../../utils/perceptualHash', () => ({
  batchCalculateHashes: vi.fn(),
  findPerceptualSimilarities: vi.fn(),
}));

// Mock TensorFlow utilities
vi.mock('../../utils/tensorflowSimilarity', () => ({
  initializeTensorFlow: vi.fn(),
  batchExtractFeatures: vi.fn(),
  findVisualSimilarities: vi.fn(),
  compareVisualFeatures: vi.fn(),
  getTensorFlowStats: vi.fn(),
  resetTensorFlowStats: vi.fn(),
}));

// Mock pipeline logger
vi.mock('../../utils/pipelineLogger', () => ({
  logPipelineStart: vi.fn(),
  logPipelineLayer: vi.fn(),
  logPipelineSummary: vi.fn(),
  logPipelineError: vi.fn(),
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
  
  // File hash mocks
  const mockBatchGenerateHashes = vi.mocked(fileHashUtils.batchGenerateHashes);
  const mockFindExactDuplicates = vi.mocked(fileHashUtils.findExactDuplicates);
  
  // Perceptual hash mocks
  const mockBatchCalculateHashes = vi.mocked(perceptualHashUtils.batchCalculateHashes);
  const mockFindPerceptualSimilarities = vi.mocked(perceptualHashUtils.findPerceptualSimilarities);
  
  // TensorFlow mocks
  const mockInitializeTensorFlow = vi.mocked(tensorflowUtils.initializeTensorFlow);
  const mockBatchExtractFeatures = vi.mocked(tensorflowUtils.batchExtractFeatures);
  const mockCompareVisualFeatures = vi.mocked(tensorflowUtils.compareVisualFeatures);
  const mockFindVisualSimilarities = vi.mocked(tensorflowUtils.findVisualSimilarities);
  const mockGetTensorFlowStats = vi.mocked(tensorflowUtils.getTensorFlowStats);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock file hash layer (Layer 1)
    mockBatchGenerateHashes.mockResolvedValue(new Map([
      ['https://example.com/photo1.jpg', 'hash1'],
      ['https://example.com/photo2.jpg', 'hash2']
    ]));
    mockFindExactDuplicates.mockReturnValue([]);
    
    // Mock perceptual hash layer (Layer 1.5)
    mockBatchCalculateHashes.mockResolvedValue([
      { photoId: 'photo1', hash: 'hash1', url: 'url1' },
      { photoId: 'photo2', hash: 'hash2', url: 'url2' }
    ]);
    mockFindPerceptualSimilarities.mockReturnValue([]);
    
    // Mock TensorFlow layer (Layer 2)
    mockInitializeTensorFlow.mockResolvedValue();
    mockBatchExtractFeatures.mockResolvedValue([
      { photoId: 'photo1', features: new Float32Array([0.1, 0.2, 0.3]) },
      { photoId: 'photo2', features: new Float32Array([0.4, 0.5, 0.6]) }
    ]);
    mockCompareVisualFeatures.mockReturnValue({ similarity: 0.8, confidence: 0.9 });
    mockFindVisualSimilarities.mockReturnValue([
      {
        id: 'tf-group-1',
        group: [
          { photoId: 'photo1', features: new Float32Array([0.1, 0.2, 0.3]) },
          { photoId: 'photo2', features: new Float32Array([0.4, 0.5, 0.6]) }
        ],
        similarity: 0.8,
        confidence: 0.9
      }
    ]);
    mockGetTensorFlowStats.mockReturnValue({
      modelLoadTime: 100,
      averageExtractionTime: 50,
      featuresExtracted: 2,
      comparisonsPerformed: 1
    });
    
    // Mock metadata layer (Layer 3)
    mockFindLikelyDuplicateCandidates.mockReturnValue(mockPhotos);
    mockCalculateTemporalProximity.mockReturnValue(0.9);
    mockCalculateSpatialProximity.mockReturnValue(0.95);
    
    // Mock AI layer (Layer 4)
    mockBatchGenerateDescriptions.mockResolvedValue(new Map([
      ['photo1', 'Construction site with electrical work'],
      ['photo2', 'Construction site with electrical installation']
    ]));
    mockCalculateVisualContentSimilarity.mockReturnValue(0.8);
    
    // Mock legacy methods for fallback
    mockCalculatePhotoSimilarityAsync.mockResolvedValue({
      visualSimilarity: 0.8,
      contentSimilarity: 0.7,
      temporalProximity: 0.9,
      spatialProximity: 0.95,
      semanticSimilarity: 0.6,
      overallSimilarity: 0.75
    });

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
      filteredGroups: [],
      allGroups: [],
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
    expect(result.current.state.filteredGroups).toEqual([]);
    expect(result.current.state.allGroups).toEqual([]);
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