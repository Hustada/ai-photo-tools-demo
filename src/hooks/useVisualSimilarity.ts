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
  batchCalculateHashes, 
  findPerceptualSimilarities,
  type PerceptualHashResult 
} from '../utils/perceptualHash';
import { 
  initializeTensorFlow, 
  batchExtractFeatures, 
  findVisualSimilarities,
  compareVisualFeatures,
  getTensorFlowStats,
  resetTensorFlowStats,
  type VisualFeatures
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
    fileHash?: boolean;        // Layer 1: Exact duplicate detection
    perceptualHash?: boolean;  // Layer 1.5: Near-duplicate detection
    tensorFlow?: boolean;      // Layer 2: Visual feature analysis
    metadata?: boolean;        // Layer 3: Temporal/spatial filtering
    aiAnalysis?: boolean;      // Layer 4: AI-powered analysis
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
    similarityThreshold = 0.98, // Very high threshold due to MobileNet's high similarities
    confidenceThreshold = 0.85, // 85% confidence minimum for rendering
    batchSize = 5,
    maxConcurrent = 3,
    mode = 'smart', // Default to smart mode
    enabledLayers = {
      fileHash: true,
      perceptualHash: true,
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
    
    // Always log filtering results for debugging
    console.log(`[VisualSimilarity] ===== CONFIDENCE FILTERING RESULTS =====`);
    console.log(`[VisualSimilarity] Total groups found: ${groups.length}`);
    console.log(`[VisualSimilarity] Confidence threshold: ${(confidenceThreshold * 100).toFixed(0)}%`);
    console.log(`[VisualSimilarity] Groups ABOVE threshold: ${filtered.length}`);
    console.log(`[VisualSimilarity] Groups BELOW threshold: ${rejected.length}`);
    
    if (groups.length > 0) {
      // Show all groups with their confidence scores
      console.log('[VisualSimilarity] All groups with confidence scores:');
      groups.forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.id}: ${(g.confidence * 100).toFixed(1)}% confidence, ${g.photos.length} photos, type: ${g.groupType}`);
      });
    }
    
    if (rejected.length > 0) {
      console.log('[VisualSimilarity] Groups REJECTED (below 85%):');
      rejected.forEach((g, i) => {
        console.log(`  - ${g.id}: ${(g.confidence * 100).toFixed(1)}% confidence, ${g.photos.length} photos`);
      });
    }
    
    if (filtered.length > 0) {
      console.log('[VisualSimilarity] Groups ACCEPTED (above 85%):');
      filtered.forEach((g, i) => {
        console.log(`  + ${g.id}: ${(g.confidence * 100).toFixed(1)}% confidence, ${g.photos.length} photos`);
      });
    }
    
    console.log(`[VisualSimilarity] =====================================`);
    
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
      let perceptualDuplicateGroups: PhotoSimilarityGroup[] = [];
      let remainingPhotos = [...photos];
      
      // Layer 1: Check for exact duplicates using file hashes (instant, free)
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
      
      // Layer 1.5: Check for near-duplicates using perceptual hashing
      if (enabledLayers.perceptualHash && remainingPhotos.length > 1) {
        setState(prev => ({ ...prev, progress: 15 }));
        console.log('[VisualSimilarity] Layer 1.5: Checking for near-duplicates using perceptual hashing...');
        const pHashStartTime = Date.now();
        
        const photoData = remainingPhotos.map(photo => ({
          id: photo.id,
          imageUrl: photo.uris?.find(uri => uri.type === 'web')?.uri 
                  || photo.uris?.find(uri => uri.type === 'original')?.uri 
                  || photo.photo_url
        })).filter(p => p.imageUrl);
        
        const perceptualHashes = await batchCalculateHashes(photoData, 3);
        
        if (controller.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        // Find perceptual similarities with a stricter threshold for construction photos
        const perceptualGroups = findPerceptualSimilarities(perceptualHashes, 0.85); // 85% similar - stricter to avoid false groupings
        console.log(`[VisualSimilarity] Found ${perceptualGroups.length} perceptual similarity groups`);
        
        // Convert perceptual groups to PhotoSimilarityGroups
        perceptualDuplicateGroups = perceptualGroups.map(pGroup => {
          const groupPhotos = remainingPhotos.filter(photo => 
            pGroup.photos.some(pHash => pHash.photoId === photo.id)
          );
          return {
            id: `perceptual-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            photos: groupPhotos,
            similarity: {
              overallSimilarity: pGroup.averageSimilarity,
              visualSimilarity: pGroup.averageSimilarity,
              temporalProximity: 0,
              spatialProximity: 0,
              contentSimilarity: pGroup.averageSimilarity,
              semanticSimilarity: 0.8 // Assume perceptually similar = semantically similar
            },
            groupType: 'retry_shots',
            confidence: pGroup.averageSimilarity
          };
        });
        
        // Remove perceptual duplicates from TensorFlow analysis
        const perceptualPhotoIds = new Set(perceptualDuplicateGroups.flatMap(group => group.photos.map(p => p.id)));
        remainingPhotos = remainingPhotos.filter(photo => !perceptualPhotoIds.has(photo.id));
        
        const pHashDuration = Date.now() - pHashStartTime;
        logPipelineLayer('Layer 1.5: Perceptual Hash', 'Near-Duplicate Detection', photoData.length, perceptualDuplicateGroups.length, pHashDuration, {
          hashesCalculated: perceptualHashes.length,
          groupsFound: perceptualDuplicateGroups.length,
          threshold: 0.85,
          photosRemaining: remainingPhotos.length
        });
        
        console.log(`[VisualSimilarity] Perceptual hashing removed ${perceptualPhotoIds.size} near-duplicates, ${remainingPhotos.length} photos remaining for TensorFlow`);
      } else {
        console.log('[VisualSimilarity] Layer 1.5: Perceptual hash detection DISABLED');
      }
      
      if (controller.signal.aborted) {
        throw new Error('Analysis cancelled');
      }
      
      let candidatePhotos = remainingPhotos;
      let visualFeatures: VisualFeatures[] = []; // Initialize visual features array
      
      // Layer 2: TensorFlow.js Visual Feature Extraction (FREE, local processing)
      if (enabledLayers.tensorFlow) {
        setState(prev => ({ ...prev, progress: 25 }));
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
        
        setState(prev => ({ ...prev, progress: 45 }));
        visualFeatures = await batchExtractFeatures(photoData, 3);
        
        if (controller.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        console.log(`[VisualSimilarity] Extracted features for ${visualFeatures.length}/${remainingPhotos.length} photos`);
        
        // Find visual similarity groups using TensorFlow features
        setState(prev => ({ ...prev, progress: 55 }));
        console.log('[VisualSimilarity] Finding visual similarity groups...');
        
        // Extremely high threshold for MobileNet features due to high similarities
        const tensorFlowGroups = findVisualSimilarities(visualFeatures, 0.999); 
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
          threshold: 0.85
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
        
        // Combine exact duplicates, perceptual duplicates, and visual groups
        const allSampleGroups = [...exactDuplicateGroups, ...perceptualDuplicateGroups, ...visualGroups];
        console.log('[VisualSimilarity] SECONDARY ANALYSIS RESULTS:');
        console.log('[VisualSimilarity] - Exact duplicate groups:', exactDuplicateGroups.length);
        console.log('[VisualSimilarity] - Perceptual duplicate groups:', perceptualDuplicateGroups.length);
        console.log('[VisualSimilarity] - Visual similarity groups:', visualGroups.length);
        console.log('[VisualSimilarity] - Total groups before filtering:', allSampleGroups.length);
        
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
      
      // Step 4: TensorFlow-based similarity analysis (PRIMARY ENGINE)
      setState(prev => ({ ...prev, progress: 60 }));
      console.log('[VisualSimilarity] Layer 4: TensorFlow-based similarity analysis (PRIMARY)');
      const aiStartTime = Date.now();
      
      const processedPhotos = new Set<string>();
      
      // Initialize similarity matrix for candidates
      finalCandidates.forEach(photo => {
        similarityMatrix.set(photo.id, new Map());
      });
      
      // Find similarity groups using TensorFlow visual features (PRIMARY METHOD)
      for (let i = 0; i < finalCandidates.length; i++) {
        if (processedPhotos.has(finalCandidates[i].id)) continue;
        
        const currentGroup: Photo[] = [finalCandidates[i]];
        processedPhotos.add(finalCandidates[i].id);
        
        for (let j = i + 1; j < finalCandidates.length; j++) {
          if (processedPhotos.has(finalCandidates[j].id)) continue;
          
          // Get visual similarity from TensorFlow features (PRIMARY)
          let visualSimilarity = 0;
          
          // Find the visual features for both photos
          const photo1Features = visualFeatures.find(f => f.photoId === finalCandidates[i].id);
          const photo2Features = visualFeatures.find(f => f.photoId === finalCandidates[j].id);
          
          if (photo1Features && photo2Features) {
            // Use TensorFlow visual features comparison (PRIMARY)
            const tfComparison = compareVisualFeatures(photo1Features, photo2Features);
            visualSimilarity = tfComparison.similarity;
          } else {
            // Skip if no visual features available
            console.warn(`[VisualSimilarity] No TensorFlow features for ${finalCandidates[i].id} or ${finalCandidates[j].id}, skipping`);
            continue;
          }
          
          // Debug first few comparisons
          if (finalGroups.length === 0 && currentGroup.length <= 3) {
            console.log(`[VisualSimilarity] TensorFlow Primary Comparison ${finalCandidates[i].id} vs ${finalCandidates[j].id}:`, {
              tensorFlowSimilarity: visualSimilarity.toFixed(3),
              threshold: similarityThreshold,
              passes: visualSimilarity >= similarityThreshold,
              method: 'TensorFlow_ResNet_Primary',
              photo1: finalCandidates[i].photo_url.split('/').pop(),
              photo2: finalCandidates[j].photo_url.split('/').pop()
            });
          }
          
          if (visualSimilarity >= similarityThreshold) {
            currentGroup.push(finalCandidates[j]);
            processedPhotos.add(finalCandidates[j].id);
            
            // Store similarity based on TensorFlow features
            const fullSimilarity: SimilarityAnalysis = {
              visualSimilarity,
              contentSimilarity: finalCandidates[i].project_id === finalCandidates[j].project_id ? 1.0 : 0.0,
              temporalProximity: calculateTemporalProximity(finalCandidates[i], finalCandidates[j]),
              spatialProximity: calculateSpatialProximity(finalCandidates[i], finalCandidates[j]),
              semanticSimilarity: visualSimilarity, // Using TensorFlow similarity as semantic proxy
              overallSimilarity: visualSimilarity * 0.8 + 
                                (calculateTemporalProximity(finalCandidates[i], finalCandidates[j]) * 0.1) +
                                (calculateSpatialProximity(finalCandidates[i], finalCandidates[j]) * 0.1)
            };
            
            similarityMatrix.get(finalCandidates[i].id)?.set(finalCandidates[j].id, fullSimilarity);
            similarityMatrix.get(finalCandidates[j].id)?.set(finalCandidates[i].id, fullSimilarity);
          }
        }
        
        // Only create groups with multiple photos
        if (currentGroup.length > 1) {
          const groupId = `tf-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
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
            confidence: avgVisualSimilarity // Use actual similarity as confidence
          };
          
          console.log(`[VisualSimilarity] Created TensorFlow group ${groupId} with ${currentGroup.length} photos:`, 
            currentGroup.map(p => p.id).join(', '));
          console.log(`[VisualSimilarity] TensorFlow Group - Visual: ${(avgVisualSimilarity * 100).toFixed(1)}%, Confidence: ${(newGroup.confidence * 100).toFixed(1)}%`);
          finalGroups.push(newGroup);
        }
      }
      
      const tfDuration = Date.now() - aiStartTime;
      
      // Optional Layer 4b: Google Vision for supplementary analysis (only if enabled)
      if (enabledLayers.aiAnalysis && finalCandidates.length > 0 && finalGroups.length === 0) {
        console.log('[VisualSimilarity] Layer 4b: Optional Google Vision fallback for edge cases...');
        const visionStartTime = Date.now();
        descriptions = await batchGenerateDescriptions(finalCandidates.slice(0, 10)); // Limit to 10 for fallback
        const visionDuration = Date.now() - visionStartTime;
        
        console.log(`[VisualSimilarity] Google Vision fallback generated ${descriptions.size} descriptions in ${visionDuration}ms`);
        
        logPipelineLayer('Layer 4b: Vision Fallback', 'Google Vision Supplementary', Math.min(10, finalCandidates.length), descriptions.size, visionDuration, {
          descriptionsGenerated: descriptions.size,
          fallbackMode: true
        });
      }
      
      // Log primary TensorFlow analysis
      logPipelineLayer('Layer 4: TensorFlow Primary', 'ResNet Feature Similarity', finalCandidates.length, finalGroups.length, tfDuration, {
        groupsFound: finalGroups.length,
        method: 'TensorFlow_ResNet_Primary',
        threshold: similarityThreshold
      });

      // Combine exact duplicates, perceptual duplicates, and similarity groups
      const allGroups = [...exactDuplicateGroups, ...perceptualDuplicateGroups, ...finalGroups];
      console.log('[VisualSimilarity] FINAL PIPELINE RESULTS:');
      console.log('[VisualSimilarity] - Exact duplicate groups:', exactDuplicateGroups.length);
      console.log('[VisualSimilarity] - Perceptual duplicate groups:', perceptualDuplicateGroups.length);
      console.log('[VisualSimilarity] - TensorFlow similarity groups:', finalGroups.length);
      console.log('[VisualSimilarity] - Total groups before filtering:', allGroups.length);
      
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
      
      console.log(`[VisualSimilarity] Multi-layer analysis complete: ${allGroups.length} groups found (${exactDuplicateGroups.length} exact duplicates, ${perceptualDuplicateGroups.length} perceptual groups, ${finalGroups.length} TensorFlow groups)`);
      console.log(`[VisualSimilarity] Confidence filtering: ${filteredGroups.length}/${allGroups.length} groups above ${(confidenceThreshold * 100).toFixed(0)}% threshold`);
      console.log(`[VisualSimilarity] Enhanced pipeline analysis:`, {
        primaryEngine: 'Perceptual_Hash_dHash',
        secondaryEngine: 'TensorFlow_ResNet_Features',
        fallbackEngine: 'Google_Vision_Limited',
        photosAnalyzed: photos.length,
        candidatesFiltered: finalCandidates.length,
        exactDuplicates: exactDuplicateGroups.length,
        perceptualGroups: perceptualDuplicateGroups.length,
        tensorFlowGroups: finalGroups.length,
        filteredGroups: filteredGroups.length,
        visualSimilarityThreshold: similarityThreshold,
        improvements: ['Perceptual_Hashing_dHash', 'Enhanced_Cosine_Similarity', 'L2_Normalized_Vectors', 'ResNet_Features']
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