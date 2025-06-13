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
  calculateSemanticSimilarity,
  calculateTemporalProximity,
  calculateSpatialProximity
} from '../utils/photoSimilarity';
import { batchGenerateHashes, findExactDuplicates } from '../utils/fileHash';
import { 
  initializeTensorFlow, 
  batchExtractFeatures, 
  findVisualSimilarities, 
  getTensorFlowStats,
  resetTensorFlowStats 
} from '../utils/tensorflowSimilarity';
import { 
  logPipelineStart, 
  logPipelineLayer, 
  logPipelineSummary, 
  logPipelineError 
} from '../utils/pipelineLogger';

interface VisualSimilarityState {
  isAnalyzing: boolean;
  progress: number;
  error: string | null;
  similarityGroups: PhotoSimilarityGroup[];
  filteredGroups: PhotoSimilarityGroup[]; // Groups above confidence threshold
  allGroups: PhotoSimilarityGroup[]; // All groups including low confidence
  similarityMatrix: Map<string, Map<string, SimilarityAnalysis>>;
}

interface UseVisualSimilarityOptions {
  similarityThreshold?: number;
  confidenceThreshold?: number; // Minimum confidence to render groups (default 0.85)
  batchSize?: number;
  maxConcurrent?: number;
  mode?: 'quick' | 'smart' | 'deep'; // Analysis intensity
  enabledLayers?: {
    fileHash?: boolean;      // Layer 1: Exact duplicate detection
    tensorFlow?: boolean;    // Layer 2: Visual feature analysis
    metadata?: boolean;      // Layer 3: Temporal/spatial filtering
    aiAnalysis?: boolean;    // Layer 4: AI-powered analysis
  };
}

interface UseVisualSimilarityReturn {
  state: VisualSimilarityState;
  analyzeSimilarity: (photos: Photo[]) => Promise<PhotoSimilarityGroup[]>;
  getSimilarityScore: (photo1Id: string, photo2Id: string) => SimilarityAnalysis | null;
  getGroupForPhoto: (photoId: string) => PhotoSimilarityGroup | null;
  getAllGroups: () => PhotoSimilarityGroup[]; // Access all groups including filtered out
  getFilteredGroups: () => PhotoSimilarityGroup[]; // Access only high-confidence groups
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
    confidenceThreshold = 0.85, // 85% confidence minimum for rendering
    batchSize = 5,
    maxConcurrent = 3,
    mode = 'smart', // Default to smart mode
    enabledLayers = {
      fileHash: true,
      tensorFlow: true,
      metadata: true,
      aiAnalysis: true
    }
  } = options;

  const [state, setState] = useState<VisualSimilarityState>({
    isAnalyzing: false,
    progress: 0,
    error: null,
    similarityGroups: [],
    filteredGroups: [],
    allGroups: [],
    similarityMatrix: new Map()
  });

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  /**
   * Filter groups by confidence threshold for rendering
   */
  const filterGroupsByConfidence = useCallback((groups: PhotoSimilarityGroup[]) => {
    const filtered = groups.filter(group => group.confidence >= confidenceThreshold);
    const rejected = groups.filter(group => group.confidence < confidenceThreshold);
    
    if (rejected.length > 0) {
      console.log(`[VisualSimilarity] Confidence filtering: ${filtered.length}/${groups.length} groups above ${(confidenceThreshold * 100).toFixed(0)}% threshold (85% default)`);
      console.log('[VisualSimilarity] Filtered out low-confidence groups:', 
        rejected.map(g => `${g.id} (${(g.confidence * 100).toFixed(1)}%)`).join(', '));
    }
    
    return filtered;
  }, [confidenceThreshold]);

  const clearAnalysis = useCallback(() => {
    setState({
      isAnalyzing: false,
      progress: 0,
      error: null,
      similarityGroups: [],
      filteredGroups: [],
      allGroups: [],
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
        filteredGroups: [],
        allGroups: [],
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
      filteredGroups: [],
      allGroups: [],
      similarityMatrix: new Map()
    }));

    try {
      console.log(`[VisualSimilarity] Starting smart analysis of ${photos.length} photos`);
      console.log('[VisualSimilarity] Enabled layers:', enabledLayers);
      logPipelineStart(photos.length);
      
      let exactDuplicateGroups: PhotoSimilarityGroup[] = [];
      let remainingPhotos = [...photos];
      
      // Step 0: Check for exact duplicates using file hashes (instant, free)
      if (enabledLayers.fileHash) {
        setState(prev => ({ ...prev, progress: 5 }));
        console.log('[VisualSimilarity] Layer 1: Checking for exact duplicates using file hashes...');
      
      const photoUrls = photos.map(photo => {
        const webUri = photo.uris?.find(uri => uri.type === 'web')?.uri;
        const originalUri = photo.uris?.find(uri => uri.type === 'original')?.uri;
        return webUri || originalUri || photo.photo_url;
      }).filter(Boolean);
      
      const hashMap = await batchGenerateHashes(photoUrls);
      const photoHashMap = new Map<string, { hash: string; photoId: string }>();
      
      photos.forEach((photo, index) => {
        const url = photoUrls[index];
        const hash = hashMap.get(url);
        if (url && hash) {
          photoHashMap.set(url, { hash, photoId: photo.id });
        }
      });
      
        const exactDuplicates = findExactDuplicates(photoHashMap);
        console.log(`[VisualSimilarity] Found ${exactDuplicates.length} exact duplicate groups`);
        
        const hashDuration = 100; // Approximate hash duration
        logPipelineLayer('Layer 1: File Hash', 'Exact Duplicate Detection', photos.length, exactDuplicates.length, 100, {
          hashesGenerated: hashMap.size,
          duplicateGroups: exactDuplicates.length
        });
        
        // Convert exact duplicates to PhotoSimilarityGroups
        exactDuplicateGroups = exactDuplicates.map(dupGroup => {
          const groupPhotos = photos.filter(photo => dupGroup.photoIds.includes(photo.id));
          return {
            id: `exact-duplicate-${dupGroup.hash.substring(0, 8)}`,
            photos: groupPhotos,
            similarity: {
              overallSimilarity: 1.0,
              visualSimilarity: 1.0,
              temporalProximity: 0,
              spatialProximity: 0,
              contentSimilarity: 1.0,
              semanticSimilarity: 1.0
            },
            groupType: 'exact_duplicates',
            confidence: 1.0
          };
        });
        
        // Remove exact duplicates from further analysis
        const duplicatePhotoIds = new Set(exactDuplicates.flatMap(group => group.photoIds));
        remainingPhotos = photos.filter(photo => !duplicatePhotoIds.has(photo.id));
        console.log(`[VisualSimilarity] Removed ${duplicatePhotoIds.size} exact duplicates, ${remainingPhotos.length} photos remaining`);
      } else {
        console.log('[VisualSimilarity] Layer 1: File hash detection DISABLED');
      }
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }
      
      let candidatePhotos = remainingPhotos;
      
      // Step 1: TensorFlow.js Visual Feature Extraction (FREE, local processing)
      if (enabledLayers.tensorFlow) {
        setState(prev => ({ ...prev, progress: 15 }));
        console.log('[VisualSimilarity] Layer 2: TensorFlow.js visual feature extraction...');
        const tfStartTime = Date.now();
        
        // Initialize TensorFlow if needed
        await initializeTensorFlow();
        
        // Extract visual features for remaining photos
        const photoData = remainingPhotos.map(photo => ({
          id: photo.id,
          imageUrl: photo.uris?.find(uri => uri.type === 'web')?.uri 
                  || photo.uris?.find(uri => uri.type === 'original')?.uri 
                  || photo.photo_url
        })).filter(p => p.imageUrl);
        
        setState(prev => ({ ...prev, progress: 35 }));
        const visualFeatures = await batchExtractFeatures(photoData, 3);
        
        if (controller.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        console.log(`[VisualSimilarity] Extracted features for ${visualFeatures.length}/${remainingPhotos.length} photos`);
        
        // Find visual similarity groups using TensorFlow features
        setState(prev => ({ ...prev, progress: 45 }));
        console.log('[VisualSimilarity] Finding visual similarity groups...');
        
        // Conservative threshold - looking for "redundant documentation" not exact duplicates
        const tensorFlowGroups = findVisualSimilarities(visualFeatures, 0.90); 
        const tfStats = getTensorFlowStats();
        
        console.log('[VisualSimilarity] TensorFlow analysis complete:', {
          groupsFound: tensorFlowGroups.length,
          modelLoadTime: tfStats.modelLoadTime + 'ms',
          averageExtractionTime: Math.round(tfStats.averageExtractionTime) + 'ms',
          totalExtractions: tfStats.featuresExtracted,
          totalComparisons: tfStats.comparisonsPerformed
        });
        
        // Convert TensorFlow groups to candidates for API analysis
        const tfCandidates = new Set<string>();
        tensorFlowGroups.forEach(group => {
          group.group.forEach(feature => {
            const photo = remainingPhotos.find(p => p.id === feature.photoId);
            if (photo) tfCandidates.add(photo.id);
          });
        });
        
        candidatePhotos = remainingPhotos.filter(photo => tfCandidates.has(photo.id));
        console.log(`[VisualSimilarity] TensorFlow filtered ${remainingPhotos.length} photos to ${candidatePhotos.length} candidates for API analysis`);
        
        const tfDuration = Date.now() - tfStartTime;
        logPipelineLayer('Layer 2: TensorFlow.js', 'Visual Feature Analysis', remainingPhotos.length, candidatePhotos.length, tfDuration, {
          modelLoadTime: tfStats.modelLoadTime,
          averageExtractionTime: Math.round(tfStats.averageExtractionTime),
          groupsFound: tensorFlowGroups.length,
          threshold: 0.90
        });
      } else {
        console.log('[VisualSimilarity] Layer 2: TensorFlow.js analysis DISABLED');
      }
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }
      
      let finalCandidates = candidatePhotos;
      
      // Step 3: Metadata-based pre-filtering
      if (enabledLayers.metadata) {
        setState(prev => ({ ...prev, progress: 50 }));
        console.log('[VisualSimilarity] Layer 3: Metadata pre-filtering (PERMISSIVE mode for testing)');
        const metadataStartTime = Date.now();
        const metadataCandidates = findLikelyDuplicateCandidates(candidatePhotos, 'permissive');
        const metadataDuration = Date.now() - metadataStartTime;
        
        // Combine TensorFlow candidates with metadata candidates
        const allCandidates = new Set([...candidatePhotos.map(p => p.id), ...metadataCandidates.map(p => p.id)]);
        finalCandidates = photos.filter(photo => allCandidates.has(photo.id));
        
        console.log(`[VisualSimilarity] Final candidate selection: ${finalCandidates.length} photos (${candidatePhotos.length} from TensorFlow, ${metadataCandidates.length} from metadata)`);
        
        logPipelineLayer('Layer 3: Metadata', 'Smart Pre-filtering (Permissive)', candidatePhotos.length, metadataCandidates.length, metadataDuration, {
          mode: 'permissive',
          inputSource: 'tensorflow_candidates',
          finalCandidates: finalCandidates.length
        });
      } else {
        console.log('[VisualSimilarity] Layer 3: Metadata filtering DISABLED');
      }
      
      if (finalCandidates.length === 0) {
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
        
        // Combine exact duplicates with visual groups
        const allSampleGroups = [...exactDuplicateGroups, ...visualGroups];
        const filteredSampleGroups = filterGroupsByConfidence(allSampleGroups);
        
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          progress: 100,
          similarityGroups: filteredSampleGroups,
          filteredGroups: filteredSampleGroups,
          allGroups: allSampleGroups
        }));
        
        const apiCalls = samplePhotos.length;
        console.log(`[VisualSimilarity] Visual-only analysis complete: ${allSampleGroups.length} groups found (${exactDuplicateGroups.length} exact duplicates, ${visualGroups.length} visual groups) from ${samplePhotos.length} sampled photos`);
        console.log(`[VisualSimilarity] Confidence filtering: ${filteredSampleGroups.length}/${allSampleGroups.length} groups above ${(confidenceThreshold * 100).toFixed(0)}% threshold (90% default)`);
        console.log(`[VisualSimilarity] Used ${apiCalls} API calls (sampled analysis)`);
        return filteredSampleGroups;
      }
      
      console.log(`[VisualSimilarity] Found ${finalCandidates.length} candidate photos (reduced from ${photos.length})`);
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }

      let finalGroups: PhotoSimilarityGroup[] = [];
      let similarityMatrix = new Map<string, Map<string, SimilarityAnalysis>>();
      let descriptions = new Map<string, string>();
      let aiDuration = 0;
      
      // Step 4: Batch generate AI descriptions for final candidates only (Google Vision + GPT-4)
      if (enabledLayers.aiAnalysis && finalCandidates.length > 0) {
        setState(prev => ({ ...prev, progress: 60 }));
        console.log('[VisualSimilarity] Layer 4: Generating AI descriptions for candidates...');
        const aiStartTime = Date.now();
        descriptions = await batchGenerateDescriptions(finalCandidates);
        aiDuration = Date.now() - aiStartTime;
        
        if (controller.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        setState(prev => ({ ...prev, progress: 80 }));
        
        // Step 5: Compare descriptions locally (very fast, no more API calls)
        console.log('[VisualSimilarity] Comparing AI descriptions locally...');
        const processedPhotos = new Set<string>();
        
        // Initialize similarity matrix for candidates
        finalCandidates.forEach(photo => {
          similarityMatrix.set(photo.id, new Map());
        });
      
      // Find similarity groups among final candidates using semantic similarity
      for (let i = 0; i < finalCandidates.length; i++) {
        if (processedPhotos.has(finalCandidates[i].id)) continue;
        
        const currentGroup: Photo[] = [finalCandidates[i]];
        processedPhotos.add(finalCandidates[i].id);
        
        const desc1 = descriptions.get(finalCandidates[i].id);
        if (!desc1) continue;
        
        for (let j = i + 1; j < finalCandidates.length; j++) {
          if (processedPhotos.has(finalCandidates[j].id)) continue;
          
          const desc2 = descriptions.get(finalCandidates[j].id);
          if (!desc2) continue;
          
          // Use semantic similarity (AI embeddings) for better understanding
          const visualSimilarity = await calculateSemanticSimilarity(desc1, desc2);
          
          // Debug first few comparisons
          if (finalGroups.length === 0 && currentGroup.length <= 3) {
            console.log(`[VisualSimilarity] Comparing ${finalCandidates[i].id} vs ${finalCandidates[j].id}:`, {
              visualSimilarity: visualSimilarity.toFixed(3),
              threshold: similarityThreshold,
              passes: visualSimilarity >= similarityThreshold,
              desc1: desc1.substring(0, 50) + '...',
              desc2: desc2.substring(0, 50) + '...',
              method: 'semantic_embeddings'
            });
          }
          
          if (visualSimilarity >= similarityThreshold) {
            currentGroup.push(finalCandidates[j]);
            processedPhotos.add(finalCandidates[j].id);
            
            // Store similarity
            const fullSimilarity: SimilarityAnalysis = {
              visualSimilarity,
              contentSimilarity: finalCandidates[i].project_id === finalCandidates[j].project_id ? 1.0 : 0.0,
              temporalProximity: calculateTemporalProximity(finalCandidates[i], finalCandidates[j]),
              spatialProximity: calculateSpatialProximity(finalCandidates[i], finalCandidates[j]),
              semanticSimilarity: visualSimilarity, // Now using actual semantic similarity
              overallSimilarity: visualSimilarity
            };
            
            similarityMatrix.get(finalCandidates[i].id)?.set(finalCandidates[j].id, fullSimilarity);
            similarityMatrix.get(finalCandidates[j].id)?.set(finalCandidates[i].id, fullSimilarity);
          }
        }
        
        // Only create groups with multiple photos
        if (currentGroup.length > 1) {
          const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Calculate average similarity within the group
          let totalSimilarity = 0;
          let comparisons = 0;
          for (let x = 0; x < currentGroup.length; x++) {
            for (let y = x + 1; y < currentGroup.length; y++) {
              const sim = similarityMatrix.get(currentGroup[x].id)?.get(currentGroup[y].id);
              if (sim) {
                totalSimilarity += sim.visualSimilarity;
                comparisons++;
              }
            }
          }
          const avgVisualSimilarity = comparisons > 0 ? totalSimilarity / comparisons : similarityThreshold;
          
          const newGroup = {
            id: groupId,
            photos: currentGroup,
            similarity: {
              visualSimilarity: avgVisualSimilarity,
              contentSimilarity: 1.0,
              temporalProximity: calculateTemporalProximity(currentGroup[0], currentGroup[1]),
              spatialProximity: calculateSpatialProximity(currentGroup[0], currentGroup[1]),
              semanticSimilarity: avgVisualSimilarity,
              overallSimilarity: avgVisualSimilarity
            },
            groupType: 'retry_shots' as const, // Most likely for closely timed/located photos
            confidence: Math.min(1.0, avgVisualSimilarity * 1.1) // Slightly boost confidence
          };
          
          console.log(`[VisualSimilarity] Created group ${groupId} with ${currentGroup.length} photos:`, 
            currentGroup.map(p => p.id).join(', '));
          console.log(`[VisualSimilarity] Group similarity - Visual: ${(avgVisualSimilarity * 100).toFixed(1)}%, Confidence: ${(newGroup.confidence * 100).toFixed(1)}%`);
          finalGroups.push(newGroup);
        }
      }
        
        // Log Layer 4 (AI Analysis)
        logPipelineLayer('Layer 4: AI Analysis', 'Google Vision + GPT-4', finalCandidates.length, descriptions.size, aiDuration, {
          descriptionsGenerated: descriptions.size,
          similarityGroupsFound: finalGroups.length
        });
      } else {
        console.log('[VisualSimilarity] Layer 4: AI analysis DISABLED');
      }

      // Combine exact duplicates with similarity groups
      const allGroups = [...exactDuplicateGroups, ...finalGroups];
      const filteredGroups = filterGroupsByConfidence(allGroups);
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 100,
        similarityGroups: filteredGroups, // Only high-confidence groups for UI
        filteredGroups: filteredGroups,
        allGroups: allGroups, // Keep all groups for debugging
        similarityMatrix
      }));

      const apiCalls = finalCandidates.length; // Much fewer calls!
      const originalCalls = (photos.length * (photos.length - 1)) / 2;
      
      console.log(`[VisualSimilarity] Smart analysis complete: ${allGroups.length} groups found (${exactDuplicateGroups.length} exact duplicates, ${finalGroups.length} similarity groups)`);
      console.log(`[VisualSimilarity] Confidence filtering: ${filteredGroups.length}/${allGroups.length} groups above ${(confidenceThreshold * 100).toFixed(0)}% threshold (90% default)`);
      console.log(`[VisualSimilarity] Efficiency analysis:`, {
        apiCalls: apiCalls,
        bruteForceApiCalls: originalCalls,
        reductionPercentage: Math.round((1 - apiCalls/originalCalls) * 100) + '%',
        photosAnalyzed: photos.length,
        candidatesFiltered: finalCandidates.length,
        exactDuplicates: exactDuplicateGroups.length,
        visualGroups: finalGroups.length,
        filteredGroups: filteredGroups.length
      });
      
      logPipelineSummary(allGroups.length, photos.length);
      
      return filteredGroups;

    } catch (error) {
      if (controller.signal.aborted) {
        return []; // State already updated in cancelAnalysis
      }
      
      console.error('[VisualSimilarity] Analysis failed:', error);
      logPipelineError('Analysis Pipeline', error instanceof Error ? error.message : 'Unknown error', error);
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

  /**
   * Get all groups including those filtered out by confidence threshold
   */
  const getAllGroups = useCallback((): PhotoSimilarityGroup[] => {
    return state.allGroups;
  }, [state.allGroups]);

  /**
   * Get only high-confidence groups (same as state.similarityGroups)
   */
  const getFilteredGroups = useCallback((): PhotoSimilarityGroup[] => {
    return state.filteredGroups;
  }, [state.filteredGroups]);

  return {
    state,
    analyzeSimilarity,
    getSimilarityScore,
    getGroupForPhoto,
    getAllGroups,
    getFilteredGroups,
    clearAnalysis,
    cancelAnalysis
  };
};