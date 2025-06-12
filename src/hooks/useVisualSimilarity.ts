// © 2025 Mark Hustad — MIT License

import { useState, useCallback, useMemo } from 'react';
import type { Photo } from '../types';
import type { PhotoSimilarityGroup, SimilarityAnalysis } from '../types/scoutai';
import { 
  calculatePhotoSimilarityAsync, 
  calculateVisualSimilarity,
  groupSimilarPhotos,
  findLikelyDuplicateCandidates,
  batchGenerateDescriptions,
  calculateVisualContentSimilarity,
  calculateTemporalProximity,
  calculateSpatialProximity
} from '../utils/photoSimilarity';

interface VisualSimilarityState {
  isAnalyzing: boolean;
  progress: number;
  error: string | null;
  similarityGroups: PhotoSimilarityGroup[];
  similarityMatrix: Map<string, Map<string, SimilarityAnalysis>>;
}

interface UseVisualSimilarityOptions {
  similarityThreshold?: number;
  batchSize?: number;
  maxConcurrent?: number;
  mode?: 'quick' | 'smart' | 'deep'; // Analysis intensity
}

interface UseVisualSimilarityReturn {
  state: VisualSimilarityState;
  analyzeSimilarity: (photos: Photo[]) => Promise<PhotoSimilarityGroup[]>;
  getSimilarityScore: (photo1Id: string, photo2Id: string) => SimilarityAnalysis | null;
  getGroupForPhoto: (photoId: string) => PhotoSimilarityGroup | null;
  clearAnalysis: () => void;
  cancelAnalysis: () => void;
}

/**
 * Hook for managing visual similarity analysis of photo collections
 * Efficiently processes photo comparisons with batching and progress tracking
 */
export const useVisualSimilarity = (options: UseVisualSimilarityOptions = {}): UseVisualSimilarityReturn => {
  const {
    similarityThreshold = 0.6,
    batchSize = 5,
    maxConcurrent = 3,
    mode = 'smart' // Default to smart mode
  } = options;

  const [state, setState] = useState<VisualSimilarityState>({
    isAnalyzing: false,
    progress: 0,
    error: null,
    similarityGroups: [],
    similarityMatrix: new Map()
  });

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const clearAnalysis = useCallback(() => {
    setState({
      isAnalyzing: false,
      progress: 0,
      error: null,
      similarityGroups: [],
      similarityMatrix: new Map()
    });
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortController) {
      console.log('[VisualSimilarity] Cancelling analysis...');
      abortController.abort();
      setAbortController(null);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: 'Analysis cancelled by user'
      }));
    }
  }, [abortController]);

  /**
   * Efficient similarity analysis: Smart pre-filtering + batch AI analysis
   * Much more efficient than comparing every photo to every other photo
   */
  const analyzeSimilarity = useCallback(async (photos: Photo[]) => {
    if (photos.length < 2) {
      setState(prev => ({
        ...prev,
        error: 'Need at least 2 photos for similarity analysis',
        similarityGroups: [],
        similarityMatrix: new Map()
      }));
      return [];
    }

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 0,
      error: null,
      similarityGroups: [],
      similarityMatrix: new Map()
    }));

    try {
      console.log(`[VisualSimilarity] Starting smart analysis of ${photos.length} photos`);
      
      // Step 1: Fast pre-filtering to find likely duplicate candidates (no AI needed)
      setState(prev => ({ ...prev, progress: 10 }));
      const candidates = findLikelyDuplicateCandidates(photos);
      
      if (candidates.length === 0) {
        console.log('[VisualSimilarity] No obvious duplicate candidates found via strict filtering');
        console.log('[VisualSimilarity] Trying secondary analysis for visual duplicates...');
        
        // Secondary approach: Look for photos with potential visual similarity
        // Use a small sample to avoid overwhelming the API
        const sampleSize = Math.min(15, photos.length); // Limit to 15 photos max
        const samplePhotos = photos.slice(0, sampleSize); // Take first 15 photos
        
        console.log(`[VisualSimilarity] Analyzing ${samplePhotos.length} photos for visual similarity`);
        
        setState(prev => ({ ...prev, progress: 20 }));
        const descriptions = await batchGenerateDescriptions(samplePhotos);
        
        if (controller.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        setState(prev => ({ ...prev, progress: 70 }));
        
        // Quick visual similarity check
        const visualGroups: PhotoSimilarityGroup[] = [];
        const processedIds = new Set<string>();
        
        for (let i = 0; i < samplePhotos.length; i++) {
          if (processedIds.has(samplePhotos[i].id)) continue;
          
          const currentGroup: Photo[] = [samplePhotos[i]];
          processedIds.add(samplePhotos[i].id);
          
          const desc1 = descriptions.get(samplePhotos[i].id);
          if (!desc1) continue;
          
          for (let j = i + 1; j < samplePhotos.length; j++) {
            if (processedIds.has(samplePhotos[j].id)) continue;
            
            const desc2 = descriptions.get(samplePhotos[j].id);
            if (!desc2) continue;
            
            const visualSim = calculateVisualContentSimilarity(desc1, desc2);
            
            if (visualSim >= 0.7) { // Higher threshold for visual-only matches
              currentGroup.push(samplePhotos[j]);
              processedIds.add(samplePhotos[j].id);
            }
          }
          
          if (currentGroup.length > 1) {
            visualGroups.push({
              id: `visual-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              photos: currentGroup,
              similarity: {
                visualSimilarity: 0.7,
                contentSimilarity: 1.0,
                temporalProximity: 0.1,
                spatialProximity: 0.1,
                semanticSimilarity: 0.7,
                overallSimilarity: 0.7
              },
              groupType: 'redundant_documentation',
              confidence: 0.7
            });
          }
        }
        
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          progress: 100,
          similarityGroups: visualGroups
        }));
        
        const apiCalls = samplePhotos.length;
        console.log(`[VisualSimilarity] Visual-only analysis complete: ${visualGroups.length} groups found from ${samplePhotos.length} sampled photos`);
        console.log(`[VisualSimilarity] Used ${apiCalls} API calls (sampled analysis)`);
        return visualGroups;
      }
      
      console.log(`[VisualSimilarity] Found ${candidates.length} candidate photos (reduced from ${photos.length})`);
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }

      // Step 2: Batch generate AI descriptions for candidates only
      setState(prev => ({ ...prev, progress: 20 }));
      const descriptions = await batchGenerateDescriptions(candidates);
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }
      
      setState(prev => ({ ...prev, progress: 70 }));
      
      // Step 3: Compare descriptions locally (very fast, no more API calls)
      const similarityMatrix = new Map<string, Map<string, SimilarityAnalysis>>();
      const groups: PhotoSimilarityGroup[] = [];
      const processedPhotos = new Set<string>();
      
      // Initialize similarity matrix for candidates
      candidates.forEach(photo => {
        similarityMatrix.set(photo.id, new Map());
      });
      
      // Find similarity groups among candidates
      for (let i = 0; i < candidates.length; i++) {
        if (processedPhotos.has(candidates[i].id)) continue;
        
        const currentGroup: Photo[] = [candidates[i]];
        processedPhotos.add(candidates[i].id);
        
        const desc1 = descriptions.get(candidates[i].id);
        if (!desc1) continue;
        
        for (let j = i + 1; j < candidates.length; j++) {
          if (processedPhotos.has(candidates[j].id)) continue;
          
          const desc2 = descriptions.get(candidates[j].id);
          if (!desc2) continue;
          
          // Fast local comparison of AI descriptions
          const visualSimilarity = calculateVisualContentSimilarity(desc1, desc2);
          
          // Debug first few comparisons
          if (groups.length === 0 && currentGroup.length <= 3) {
            console.log(`[VisualSimilarity] Comparing ${candidates[i].id} vs ${candidates[j].id}:`, {
              visualSimilarity: visualSimilarity.toFixed(3),
              threshold: similarityThreshold,
              passes: visualSimilarity >= similarityThreshold,
              desc1: desc1.substring(0, 50) + '...',
              desc2: desc2.substring(0, 50) + '...'
            });
          }
          
          if (visualSimilarity >= similarityThreshold) {
            currentGroup.push(candidates[j]);
            processedPhotos.add(candidates[j].id);
            
            // Store similarity
            const fullSimilarity: SimilarityAnalysis = {
              visualSimilarity,
              contentSimilarity: candidates[i].project_id === candidates[j].project_id ? 1.0 : 0.0,
              temporalProximity: calculateTemporalProximity(candidates[i], candidates[j]),
              spatialProximity: calculateSpatialProximity(candidates[i], candidates[j]),
              semanticSimilarity: visualSimilarity, // Using visual as proxy
              overallSimilarity: visualSimilarity
            };
            
            similarityMatrix.get(candidates[i].id)?.set(candidates[j].id, fullSimilarity);
            similarityMatrix.get(candidates[j].id)?.set(candidates[i].id, fullSimilarity);
          }
        }
        
        // Only create groups with multiple photos
        if (currentGroup.length > 1) {
          const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newGroup = {
            id: groupId,
            photos: currentGroup,
            similarity: {
              visualSimilarity: similarityThreshold,
              contentSimilarity: 1.0,
              temporalProximity: calculateTemporalProximity(currentGroup[0], currentGroup[1]),
              spatialProximity: calculateSpatialProximity(currentGroup[0], currentGroup[1]),
              semanticSimilarity: similarityThreshold,
              overallSimilarity: similarityThreshold
            },
            groupType: 'retry_shots', // Most likely for closely timed/located photos
            confidence: Math.min(1.0, similarityThreshold * 1.2)
          };
          
          console.log(`[VisualSimilarity] Created group ${groupId} with ${currentGroup.length} photos:`, 
            currentGroup.map(p => p.id).join(', '));
          groups.push(newGroup);
        }
      }

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        similarityGroups: groups,
        similarityMatrix
      }));

      const apiCalls = candidates.length; // Much fewer calls!
      const originalCalls = (photos.length * (photos.length - 1)) / 2;
      console.log(`[VisualSimilarity] Smart analysis complete: ${groups.length} groups found`);
      console.log(`[VisualSimilarity] Efficiency: ${apiCalls} API calls vs ${originalCalls} in brute force (${Math.round((1 - apiCalls/originalCalls) * 100)}% reduction)`);
      
      return groups;

    } catch (error) {
      if (controller.signal.aborted) {
        return []; // State already updated in cancelAnalysis
      }
      
      console.error('[VisualSimilarity] Analysis failed:', error);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Unknown error during analysis'
      }));
      return [];
    } finally {
      setAbortController(null);
    }
  }, [similarityThreshold, batchSize, maxConcurrent]);

  /**
   * Get similarity score between two specific photos
   */
  const getSimilarityScore = useCallback((photo1Id: string, photo2Id: string): SimilarityAnalysis | null => {
    return state.similarityMatrix.get(photo1Id)?.get(photo2Id) || null;
  }, [state.similarityMatrix]);

  /**
   * Get the similarity group that contains a specific photo
   */
  const getGroupForPhoto = useCallback((photoId: string): PhotoSimilarityGroup | null => {
    return state.similarityGroups.find(group => 
      group.photos.some(photo => photo.id === photoId)
    ) || null;
  }, [state.similarityGroups]);

  return {
    state,
    analyzeSimilarity,
    getSimilarityScore,
    getGroupForPhoto,
    clearAnalysis,
    cancelAnalysis
  };
};