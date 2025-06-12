// © 2025 Mark Hustad — MIT License

import type { Photo } from '../types';
import type { SimilarityAnalysis, PhotoSimilarityGroup, PhotoQualityMetrics } from '../types/camintellect';

/**
 * Calculate temporal proximity between two photos based on capture time
 * Returns a score from 0-1 where 1 means captured at the same time
 */
export function calculateTemporalProximity(photo1: Photo, photo2: Photo): number {
  if (!photo1.captured_at || !photo2.captured_at) {
    return 0.0;
  }

  const time1 = new Date(photo1.captured_at).getTime();
  const time2 = new Date(photo2.captured_at).getTime();
  const timeDiffMinutes = Math.abs(time1 - time2) / (1000 * 60); // Convert to minutes

  if (timeDiffMinutes === 0) return 1.0;
  if (timeDiffMinutes < 1) return 0.98;  // Within 1 minute - almost identical
  if (timeDiffMinutes < 5) return 0.95;  // Within 5 minutes - very close
  if (timeDiffMinutes < 15) return 0.85; // Within 15 minutes - close
  if (timeDiffMinutes < 60) return 0.6;  // Within 1 hour - moderate
  if (timeDiffMinutes < 240) return 0.3; // Within 4 hours - distant
  if (timeDiffMinutes < 1440) return 0.1; // Within 24 hours - very distant
  
  return 0.05; // More than a day apart - extremely distant
}

/**
 * Calculate spatial proximity between two photos based on GPS coordinates
 * Returns a score from 0-1 where 1 means same location
 */
export function calculateSpatialProximity(photo1: Photo, photo2: Photo): number {
  if (!photo1.coordinates || !photo2.coordinates || 
      photo1.coordinates.length === 0 || photo2.coordinates.length === 0) {
    return 0.0; // No spatial data available
  }

  const coord1 = photo1.coordinates[0]; // Take first coordinate
  const coord2 = photo2.coordinates[0];
  
  if (!coord1 || !coord2) return 0.0;

  const lat1 = coord1.latitude;
  const lon1 = coord1.longitude;
  const lat2 = coord2.latitude;
  const lon2 = coord2.longitude;

  if (lat1 === lat2 && lon1 === lon2) return 1.0;

  // Haversine formula to calculate distance between two points
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c;

  // Convert distance to proximity score
  if (distanceKm < 0.01) return 0.98; // Within 10 meters - very close
  if (distanceKm < 0.05) return 0.92; // Within 50 meters - close
  if (distanceKm < 0.1) return 0.6;   // Within 100 meters - moderate
  if (distanceKm < 0.5) return 0.4;   // Within 500 meters - distant
  if (distanceKm < 1.0) return 0.2;   // Within 1 km - very distant
  
  return 0.0; // More than 1 km apart
}

/**
 * Calculate quality metrics for a photo based on available metadata
 * This is a simplified version - in production, would use actual image analysis
 */
export function calculateQualityMetrics(photo: Photo): PhotoQualityMetrics {
  // For now, we'll estimate quality based on metadata
  // In production, this would use actual image analysis APIs
  
  const baseQuality = 0.6; // Assume reasonable baseline quality
  
  // Information content based on description and tags
  const descriptionWords = (photo.description || '').split(' ').length;
  const tagCount = (photo.tags || []).length;
  const informationContent = Math.min(1.0, 
    (descriptionWords * 0.05 + tagCount * 0.1) / 2 + 0.3
  );
  
  // Documentation value combines information content with other factors
  const hasCoordinates = photo.coordinates ? 0.1 : 0;
  const hasDescription = photo.description && photo.description.length > 10 ? 0.1 : 0;
  const hasTags = (photo.tags || []).length > 0 ? 0.1 : 0;
  
  const documentationValue = Math.min(1.0, 
    informationContent * 0.7 + hasCoordinates + hasDescription + hasTags
  );

  return {
    sharpness: baseQuality + Math.random() * 0.2 - 0.1, // Simulated with small random variance
    lighting: baseQuality + Math.random() * 0.2 - 0.1,
    composition: baseQuality + Math.random() * 0.2 - 0.1,
    informationContent,
    documentationValue
  };
}

/**
 * Generate visual content description for similarity analysis
 * Uses the existing AI pipeline to analyze photo content
 * 
 * Data Flow:
 * 1. Scout AI "Trigger Analysis" → analyzeSimilarPhotos()
 * 2. For each photo pair → calculateVisualSimilarity() 
 * 3. generateVisualDescription() → /api/suggest-ai-tags (with custom prompt)
 * 4. AI returns visual description → calculateVisualContentSimilarity()
 * 5. Jaccard similarity + construction terms → similarity score
 * 6. groupSimilarPhotos() → curation recommendations
 */
export async function generateVisualDescription(photoUrl: string, photoId?: string): Promise<string | null> {
  try {
    console.log(`[VisualSimilarity] Generating description for photo ${photoId} with URL: ${photoUrl.substring(0, 100)}...`);
    
    const response = await fetch('/api/suggest-ai-tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photoId: photoId || `similarity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, // Provide a photoId (required by API)
        photoUrl
        // Note: We rely on the default AI analysis to generate descriptions
        // The similarity detection works well with standard AI-generated descriptions
      }),
    });

    if (!response.ok) {
      console.error(`[VisualSimilarity] Failed to generate visual description for ${photoId}: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[VisualSimilarity] Error response body:`, errorText);
      return null;
    }

    const data = await response.json();
    return data.suggestedDescription || null;
  } catch (error) {
    console.error('[VisualSimilarity] Error generating visual description:', error);
    return null;
  }
}

/**
 * Calculate visual content similarity between two descriptions
 * Uses semantic similarity analysis
 */
export function calculateVisualContentSimilarity(description1: string, description2: string): number {
  if (!description1 || !description2) {
    return 0.0;
  }

  // Normalize and tokenize descriptions
  const normalize = (text: string) => 
    text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);

  const words1 = new Set(normalize(description1));
  const words2 = new Set(normalize(description2));
  
  // Calculate Jaccard similarity coefficient
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0.0;
  
  const jaccardSimilarity = intersection.size / union.size;
  
  // Enhanced similarity scoring with construction-specific terms
  const constructionTerms = new Set([
    'roof', 'roofing', 'electrical', 'plumbing', 'hvac', 'framing', 'drywall', 
    'flooring', 'concrete', 'foundation', 'insulation', 'wiring', 'pipes',
    'ductwork', 'shingles', 'siding', 'windows', 'doors', 'fixtures',
    'installation', 'repair', 'inspection', 'progress', 'completion'
  ]);
  
  const constructionWords1 = [...words1].filter(word => constructionTerms.has(word));
  const constructionWords2 = [...words2].filter(word => constructionTerms.has(word));
  const constructionIntersection = constructionWords1.filter(word => constructionWords2.includes(word));
  
  // Boost similarity if construction-specific terms match
  const constructionBoost = constructionIntersection.length > 0 ? 
    (constructionIntersection.length / Math.max(constructionWords1.length, constructionWords2.length)) * 0.3 : 0;
  
  return Math.min(1.0, jaccardSimilarity + constructionBoost);
}

/**
 * Enhanced visual similarity calculation using AI-generated descriptions
 */
export async function calculateVisualSimilarity(photo1: Photo, photo2: Photo): Promise<number> {
  // Return 1.0 for identical photos
  if (photo1.id === photo2.id) {
    return 1.0;
  }

  // Get photo URLs for analysis
  const getPhotoUrl = (photo: Photo) => {
    const webUri = photo.uris?.find(uri => uri.type === 'web')?.uri;
    const originalUri = photo.uris?.find(uri => uri.type === 'original')?.uri;
    return webUri || originalUri || photo.photo_url;
  };

  const url1 = getPhotoUrl(photo1);
  const url2 = getPhotoUrl(photo2);

  if (!url1 || !url2) {
    console.warn('[VisualSimilarity] Missing photo URLs for analysis');
    return 0.0;
  }

  try {
    // Generate visual descriptions for both photos
    const [description1, description2] = await Promise.all([
      generateVisualDescription(url1, photo1.id),
      generateVisualDescription(url2, photo2.id)
    ]);

    if (!description1 || !description2) {
      // Fallback to basic similarity using temporal/spatial proximity
      const temporal = calculateTemporalProximity(photo1, photo2);
      const spatial = calculateSpatialProximity(photo1, photo2);
      return (temporal * 0.4 + spatial * 0.6);
    }

    // Calculate visual content similarity
    const visualSimilarity = calculateVisualContentSimilarity(description1, description2);
    
    // Cache the descriptions for future use (could be stored in photo metadata)
    // For now, just return the similarity score
    return visualSimilarity;

  } catch (error) {
    console.error('[VisualSimilarity] Error calculating visual similarity:', error);
    
    // Fallback to basic similarity
    const temporal = calculateTemporalProximity(photo1, photo2);
    const spatial = calculateSpatialProximity(photo1, photo2);
    return (temporal * 0.4 + spatial * 0.6);
  }
}

/**
 * Calculate comprehensive similarity analysis between two photos (synchronous version)
 * This version uses fallback visual similarity calculation
 */
export function calculatePhotoSimilarity(photo1: Photo, photo2: Photo): SimilarityAnalysis {
  const temporalProximity = calculateTemporalProximity(photo1, photo2);
  const spatialProximity = calculateSpatialProximity(photo1, photo2);
  
  // Content similarity based on shared attributes
  const sameProject = photo1.project_id === photo2.project_id ? 1.0 : 0.0;
  const sameCreator = photo1.creator_id === photo2.creator_id ? 0.8 : 0.3;
  const contentSimilarity = (sameProject * 0.6 + sameCreator * 0.4);
  
  // Semantic similarity based on tags and description overlap
  const tags1 = new Set((photo1.tags || []).map(tag => tag.value || tag.display_value));
  const tags2 = new Set((photo2.tags || []).map(tag => tag.value || tag.display_value));
  const sharedTags = new Set([...tags1].filter(tag => tags2.has(tag)));
  const totalUniqueTags = new Set([...tags1, ...tags2]);
  const tagSimilarity = totalUniqueTags.size > 0 ? sharedTags.size / totalUniqueTags.size : 0;
  
  const desc1Words = new Set((photo1.description || '').toLowerCase().split(' ').filter(w => w.length > 3));
  const desc2Words = new Set((photo2.description || '').toLowerCase().split(' ').filter(w => w.length > 3));
  const sharedWords = new Set([...desc1Words].filter(word => desc2Words.has(word)));
  const totalUniqueWords = new Set([...desc1Words, ...desc2Words]);
  const descriptionSimilarity = totalUniqueWords.size > 0 ? sharedWords.size / totalUniqueWords.size : 0;
  
  const semanticSimilarity = (tagSimilarity * 0.7 + descriptionSimilarity * 0.3);
  
  // Basic visual similarity using existing descriptions if available
  let visualSimilarity = 0.0;
  if (photo1.id === photo2.id) {
    visualSimilarity = 1.0;
  } else if (photo1.description && photo2.description) {
    // Use existing descriptions for basic visual similarity
    visualSimilarity = calculateVisualContentSimilarity(photo1.description, photo2.description);
  } else {
    // Fallback to temporal/spatial proximity
    visualSimilarity = (temporalProximity * 0.4 + spatialProximity * 0.6);
  }
  
  // Special case: if photos are very close in time (likely identical/retakes) and same project,
  // weight visual similarity much higher and don't penalize missing spatial data
  let overallSimilarity: number;
  if (photo1.id === photo2.id) {
    overallSimilarity = 1.0;
  } else if (temporalProximity > 0.95 && contentSimilarity > 0.8) {
    // Likely identical photos or immediate retakes - prioritize visual and temporal
    overallSimilarity = visualSimilarity * 0.7 + temporalProximity * 0.2 + contentSimilarity * 0.1;
  } else {
    // Normal similarity calculation
    overallSimilarity = (
      visualSimilarity * 0.4 +
      contentSimilarity * 0.2 +
      temporalProximity * 0.15 +
      spatialProximity * 0.15 +
      semanticSimilarity * 0.1
    );
  }
  
  // Debug logging for similarity calculation
  if (temporalProximity > 0.95) {
    console.log(`[DEBUG] Similarity breakdown for ${photo1.id} vs ${photo2.id}:`, {
      visual: visualSimilarity.toFixed(3),
      content: contentSimilarity.toFixed(3), 
      temporal: temporalProximity.toFixed(3),
      spatial: spatialProximity.toFixed(3),
      semantic: semanticSimilarity.toFixed(3),
      overall: overallSimilarity.toFixed(3),
      photo1_desc: photo1.description?.substring(0, 50) + '...',
      photo2_desc: photo2.description?.substring(0, 50) + '...'
    });
  }

  return {
    visualSimilarity,
    contentSimilarity,
    temporalProximity,
    spatialProximity,
    semanticSimilarity,
    overallSimilarity
  };
}

/**
 * Calculate comprehensive similarity analysis between two photos (async version with AI)
 * This version uses AI-powered visual analysis for more accurate results
 */
export async function calculatePhotoSimilarityAsync(photo1: Photo, photo2: Photo): Promise<SimilarityAnalysis> {
  const temporalProximity = calculateTemporalProximity(photo1, photo2);
  const spatialProximity = calculateSpatialProximity(photo1, photo2);
  
  // Content similarity based on shared attributes
  const sameProject = photo1.project_id === photo2.project_id ? 1.0 : 0.0;
  const sameCreator = photo1.creator_id === photo2.creator_id ? 0.8 : 0.3;
  const contentSimilarity = (sameProject * 0.6 + sameCreator * 0.4);
  
  // Semantic similarity based on tags and description overlap
  const tags1 = new Set((photo1.tags || []).map(tag => tag.value || tag.display_value));
  const tags2 = new Set((photo2.tags || []).map(tag => tag.value || tag.display_value));
  const sharedTags = new Set([...tags1].filter(tag => tags2.has(tag)));
  const totalUniqueTags = new Set([...tags1, ...tags2]);
  const tagSimilarity = totalUniqueTags.size > 0 ? sharedTags.size / totalUniqueTags.size : 0;
  
  const desc1Words = new Set((photo1.description || '').toLowerCase().split(' ').filter(w => w.length > 3));
  const desc2Words = new Set((photo2.description || '').toLowerCase().split(' ').filter(w => w.length > 3));
  const sharedWords = new Set([...desc1Words].filter(word => desc2Words.has(word)));
  const totalUniqueWords = new Set([...desc1Words, ...desc2Words]);
  const descriptionSimilarity = totalUniqueWords.size > 0 ? sharedWords.size / totalUniqueWords.size : 0;
  
  const semanticSimilarity = (tagSimilarity * 0.7 + descriptionSimilarity * 0.3);
  
  // Enhanced visual similarity using AI analysis
  const visualSimilarity = await calculateVisualSimilarity(photo1, photo2);
  
  // Overall similarity weighted average (increased weight for visual similarity)
  const overallSimilarity = photo1.id === photo2.id ? 1.0 : (
    visualSimilarity * 0.5 +
    contentSimilarity * 0.2 +
    temporalProximity * 0.1 +
    spatialProximity * 0.1 +
    semanticSimilarity * 0.1
  );

  return {
    visualSimilarity,
    contentSimilarity,
    temporalProximity,
    spatialProximity,
    semanticSimilarity,
    overallSimilarity
  };
}

/**
 * Determine the type of similarity group based on similarity analysis
 */
function determineGroupType(similarity: SimilarityAnalysis): PhotoSimilarityGroup['groupType'] {
  // Special case: VERY close timestamps (within seconds) + high visual similarity = likely true duplicates/retries
  if (similarity.temporalProximity > 0.98 && similarity.visualSimilarity > 0.8 && similarity.contentSimilarity > 0.8) {
    return 'retry_shots'; // Near-identical timestamps AND visual content = likely duplicates
  }
  if (similarity.temporalProximity > 0.8 && similarity.spatialProximity > 0.8) {
    return 'retry_shots'; // Same time and place - likely retries
  }
  if (similarity.spatialProximity > 0.7 && similarity.temporalProximity > 0.5) {
    return 'angle_variations'; // Same area, close time - different angles
  }
  if (similarity.contentSimilarity > 0.8 && similarity.temporalProximity > 0.3) {
    return 'incremental_progress'; // Same project, progress over time
  }
  return 'redundant_documentation'; // Similar content/semantic meaning
}

/**
 * Fast pre-filtering to identify likely duplicate candidates
 * Reduces the number of photos that need expensive AI analysis
 */
export function findLikelyDuplicateCandidates(photos: Photo[]): Photo[] {
  const candidates = new Set<Photo>();
  
  console.log(`[VisualSimilarity] Analyzing ${photos.length} photos for potential duplicates...`);
  
  // Debug first few photos to understand the data
  if (photos.length > 0) {
    const sample = photos[0];
    console.log(`[VisualSimilarity] Sample photo data:`, {
      id: sample.id,
      project_id: sample.project_id,
      creator_id: sample.creator_id,
      captured_at_raw: sample.captured_at,
      captured_at_parsed: new Date(sample.captured_at).toISOString(),
      captured_at_timestamp: new Date(sample.captured_at).getTime(),
      has_coordinates: !!sample.coordinates && sample.coordinates.length > 0,
      coordinates: sample.coordinates?.[0],
      photo_url: sample.photo_url,
      uris_count: sample.uris?.length || 0,
      first_uri: sample.uris?.[0]
    });
    
    // Test a few photo pairs to see what the similarity scores actually are
    if (photos.length > 1) {
      const photo1 = photos[0];
      const photo2 = photos[1];
      const temporal = calculateTemporalProximity(photo1, photo2);
      const spatial = calculateSpatialProximity(photo1, photo2);
      const sameProject = photo1.project_id === photo2.project_id;
      const sameCreator = photo1.creator_id === photo2.creator_id;
      
      const timeDiffMs = Math.abs(new Date(photo1.captured_at).getTime() - new Date(photo2.captured_at).getTime());
      const timeDiffMinutes = timeDiffMs / (1000 * 60);
      const isVeryCloseInTime = temporal > 0.85;
      const isVeryCloseInSpace = spatial > 0.9;
      
      console.log(`[VisualSimilarity] Sample pair analysis (${photo1.id} vs ${photo2.id}):`, {
        photo1_timestamp: new Date(photo1.captured_at).getTime(),
        photo2_timestamp: new Date(photo2.captured_at).getTime(),
        time_diff_ms: timeDiffMs,
        time_diff_minutes: timeDiffMinutes.toFixed(2),
        temporal: temporal.toFixed(3),
        spatial: spatial.toFixed(3),
        sameProject,
        wouldBeCandidate: sameProject && (
          (isVeryCloseInTime && isVeryCloseInSpace) ||
          (isVeryCloseInTime && temporal > 0.95)
        )
      });
    }
  }
  
  let candidatePairCount = 0;
  let totalPairCount = 0;
  
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      totalPairCount++;
      const photo1 = photos[i];
      const photo2 = photos[j];
      
      // Fast checks - no AI needed
      const temporal = calculateTemporalProximity(photo1, photo2);
      const spatial = calculateSpatialProximity(photo1, photo2);
      const sameProject = photo1.project_id === photo2.project_id;
      
      // Smart criteria for duplicate detection
      const isVeryCloseInTime = temporal > 0.85; // Within ~5-15 minutes
      const isVeryCloseInSpace = spatial > 0.9;  // Within ~50 meters
      
      // For logged-in users, all photos are from same user, so focus on project, time, and location
      // Flag as candidates if same project AND either:
      // 1. Close in both time and space (typical retakes at same location)
      // 2. Very close in time even without GPS (rapid sequence shots)
      const isDuplicateCandidate = sameProject && (
        (isVeryCloseInTime && isVeryCloseInSpace) || // Same time AND place
        (isVeryCloseInTime && temporal > 0.95)      // Almost identical timestamp (retakes)
      );
      
      if (isDuplicateCandidate) {
        candidatePairCount++;
        candidates.add(photo1);
        candidates.add(photo2);
        
        // Debug logging for first few matches
        if (candidatePairCount <= 5) {
          const timeDiff = Math.abs(new Date(photo1.captured_at).getTime() - new Date(photo2.captured_at).getTime()) / (1000 * 60);
          console.log(`[VisualSimilarity] Candidate pair ${candidatePairCount}: ${photo1.id} & ${photo2.id}`);
          console.log(`  Time diff: ${timeDiff.toFixed(1)} minutes (temporal: ${temporal.toFixed(2)})`);
          console.log(`  Spatial: ${spatial.toFixed(2)}, Same project: ${sameProject}`);
        }
      }
    }
  }
  
  console.log(`[VisualSimilarity] Pre-filtering stats: ${candidatePairCount} candidate pairs out of ${totalPairCount} total pairs (${((candidatePairCount/totalPairCount)*100).toFixed(1)}%)`);
  console.log(`[VisualSimilarity] Pre-filtering complete: ${candidates.size} candidates from ${photos.length} photos`);
  return Array.from(candidates);
}

/**
 * Efficient batch description generation for multiple photos
 * Much more efficient than pair-wise API calls
 */
export async function batchGenerateDescriptions(photos: Photo[]): Promise<Map<string, string>> {
  console.log(`[VisualSimilarity] Starting batch description generation for ${photos.length} photos`);
  const descriptions = new Map<string, string>();
  
  // Generate descriptions in parallel (but with reasonable batch size)
  const batchSize = 5; // Limit concurrent API calls
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    console.log(`[VisualSimilarity] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)} (${batch.length} photos)`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (photo) => {
        const url = photo.uris?.find(uri => uri.type === 'web')?.uri 
                 || photo.uris?.find(uri => uri.type === 'original')?.uri 
                 || photo.photo_url;
        
        if (!url) {
          console.warn(`[VisualSimilarity] No valid URL found for photo ${photo.id}`);
          return null;
        }
        
        const description = await generateVisualDescription(url, photo.id);
        return { photoId: photo.id, description };
      })
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && result.value.description) {
        descriptions.set(result.value.photoId, result.value.description);
      } else if (result.status === 'rejected') {
        console.error(`[VisualSimilarity] Failed to generate description for photo ${batch[index]?.id}:`, result.reason);
      } else if (result.status === 'fulfilled' && !result.value?.description) {
        console.warn(`[VisualSimilarity] No description returned for photo ${batch[index]?.id}`);
      }
    });
    
    // Small delay between batches to be API-friendly
    if (i + batchSize < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[VisualSimilarity] Batch description generation complete: ${descriptions.size}/${photos.length} descriptions generated`);
  return descriptions;
}

/**
 * Group similar photos based on similarity threshold
 */
export function groupSimilarPhotos(photos: Photo[], similarityThreshold: number = 0.4): PhotoSimilarityGroup[] {
  const groups: PhotoSimilarityGroup[] = [];
  const processedPhotos = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    if (processedPhotos.has(photos[i].id)) continue;

    const currentGroup: Photo[] = [photos[i]];
    processedPhotos.add(photos[i].id);
    let groupSimilarity: SimilarityAnalysis | null = null;

    for (let j = i + 1; j < photos.length; j++) {
      if (processedPhotos.has(photos[j].id)) continue;

      const similarity = calculatePhotoSimilarity(photos[i], photos[j]);
      
      // Debug logging for high similarity pairs
      if (similarity.overallSimilarity > 0.3) {
        console.log(`[VisualSimilarity] High similarity pair ${photos[i].id} & ${photos[j].id}: overall=${similarity.overallSimilarity.toFixed(3)}, visual=${similarity.visualSimilarity.toFixed(3)}, temporal=${similarity.temporalProximity.toFixed(3)}, spatial=${similarity.spatialProximity.toFixed(3)}, threshold=${similarityThreshold}`);
      }
      
      if (similarity.overallSimilarity >= similarityThreshold) {
        currentGroup.push(photos[j]);
        processedPhotos.add(photos[j].id);
        
        // Use the similarity from the first comparison as representative
        if (!groupSimilarity) {
          groupSimilarity = similarity;
        }
      }
    }

    // Only create groups with more than one photo
    if (currentGroup.length > 1 && groupSimilarity) {
      const groupType = determineGroupType(groupSimilarity);
      const confidence = Math.min(1.0, groupSimilarity.overallSimilarity * 1.2); // Boost confidence slightly
      
      groups.push({
        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        photos: currentGroup,
        similarity: groupSimilarity,
        groupType,
        confidence
      });
    }
  }

  // Sort groups by confidence (highest first)
  return groups.sort((a, b) => b.confidence - a.confidence);
}