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
  if (timeDiffMinutes < 5) return 0.95; // Within 5 minutes - very close
  if (timeDiffMinutes < 30) return 0.85; // Within 30 minutes - close
  if (timeDiffMinutes < 120) return 0.5; // Within 2 hours - moderate
  if (timeDiffMinutes < 1440) return 0.3; // Within 24 hours - distant
  
  return 0.1; // More than a day apart - very distant
}

/**
 * Calculate spatial proximity between two photos based on GPS coordinates
 * Returns a score from 0-1 where 1 means same location
 */
export function calculateSpatialProximity(photo1: Photo, photo2: Photo): number {
  if (!photo1.coordinates || !photo2.coordinates) {
    return 0.0; // No spatial data available
  }

  const lat1 = photo1.coordinates.latitude;
  const lon1 = photo1.coordinates.longitude;
  const lat2 = photo2.coordinates.latitude;
  const lon2 = photo2.coordinates.longitude;

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
  if (distanceKm < 0.05) return 0.92;  // Within 50 meters - close
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
 * Calculate comprehensive similarity analysis between two photos
 */
export function calculatePhotoSimilarity(photo1: Photo, photo2: Photo): SimilarityAnalysis {
  const temporalProximity = calculateTemporalProximity(photo1, photo2);
  const spatialProximity = calculateSpatialProximity(photo1, photo2);
  
  // Content similarity based on shared attributes
  const sameProject = photo1.project_id === photo2.project_id ? 1.0 : 0.0;
  const sameCreator = photo1.creator_id === photo2.creator_id ? 0.8 : 0.3;
  const contentSimilarity = (sameProject * 0.6 + sameCreator * 0.4);
  
  // Semantic similarity based on tags and description overlap
  const tags1 = new Set(photo1.tags || []);
  const tags2 = new Set(photo2.tags || []);
  const sharedTags = new Set([...tags1].filter(tag => tags2.has(tag)));
  const totalUniqueTags = new Set([...tags1, ...tags2]);
  const tagSimilarity = totalUniqueTags.size > 0 ? sharedTags.size / totalUniqueTags.size : 0;
  
  const desc1Words = new Set((photo1.description || '').toLowerCase().split(' '));
  const desc2Words = new Set((photo2.description || '').toLowerCase().split(' '));
  const sharedWords = new Set([...desc1Words].filter(word => desc2Words.has(word) && word.length > 3));
  const totalUniqueWords = new Set([...desc1Words, ...desc2Words]);
  const descriptionSimilarity = totalUniqueWords.size > 0 ? sharedWords.size / totalUniqueWords.size : 0;
  
  const semanticSimilarity = (tagSimilarity * 0.7 + descriptionSimilarity * 0.3);
  
  // Visual similarity (simplified - would use actual image analysis in production)
  // For now, base it on temporal and spatial proximity as proxy
  // For identical photos, ensure visual similarity is 1.0
  const visualSimilarity = photo1.id === photo2.id ? 1.0 : (temporalProximity * 0.4 + spatialProximity * 0.6);
  
  // Overall similarity weighted average
  // For identical photos, return perfect similarity
  const overallSimilarity = photo1.id === photo2.id ? 1.0 : (
    visualSimilarity * 0.3 +
    contentSimilarity * 0.25 +
    temporalProximity * 0.2 +
    spatialProximity * 0.15 +
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
 * Group similar photos based on similarity threshold
 */
export function groupSimilarPhotos(photos: Photo[], similarityThreshold: number = 0.6): PhotoSimilarityGroup[] {
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