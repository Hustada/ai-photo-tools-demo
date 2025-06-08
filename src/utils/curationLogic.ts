// © 2025 Mark Hustad — MIT License

import type { Photo } from '../types';
import type { PhotoSimilarityGroup, CurationRecommendation, PhotoQualityMetrics } from '../types/camintellect';
import { calculateQualityMetrics } from './photoSimilarity';

/**
 * Calculate estimated time savings from photo curation
 * Based on typical photo review time per photo
 */
export function calculateTimeSavings(originalCount: number, keepCount: number): number {
  if (keepCount >= originalCount || originalCount === 0) {
    return 0;
  }
  
  const photosRemoved = originalCount - keepCount;
  const timePerPhotoReview = 0.5; // 30 seconds per photo review
  const timeSavedMinutes = photosRemoved * timePerPhotoReview;
  
  return Math.round(timeSavedMinutes * 10) / 10; // Round to 1 decimal place
}

/**
 * Select the best photos from a group based on quality metrics
 */
export function selectBestPhotos(photos: Photo[], keepCount: number): Photo[] {
  if (photos.length === 0) {
    return [];
  }
  
  if (keepCount >= photos.length) {
    return [...photos];
  }
  
  // Calculate quality metrics for each photo
  const photosWithQuality = photos.map(photo => ({
    photo,
    quality: calculateQualityMetrics(photo)
  }));
  
  // Sort by overall documentation value (descending)
  photosWithQuality.sort((a, b) => {
    // Primary sort: documentation value
    if (b.quality.documentationValue !== a.quality.documentationValue) {
      return b.quality.documentationValue - a.quality.documentationValue;
    }
    
    // Secondary sort: information content
    if (b.quality.informationContent !== a.quality.informationContent) {
      return b.quality.informationContent - a.quality.informationContent;
    }
    
    // Tertiary sort: average of other quality metrics
    const aAvg = (a.quality.sharpness + a.quality.lighting + a.quality.composition) / 3;
    const bAvg = (b.quality.sharpness + b.quality.lighting + b.quality.composition) / 3;
    return bAvg - aAvg;
  });
  
  // Return top photos
  return photosWithQuality.slice(0, keepCount).map(item => item.photo);
}

/**
 * Generate a curation recommendation for a similarity group
 */
export function generateCurationRecommendation(group: PhotoSimilarityGroup): CurationRecommendation {
  const photoCount = group.photos.length;
  
  // Determine how many photos to keep based on group type and size
  let keepCount: number;
  switch (group.groupType) {
    case 'retry_shots':
      keepCount = Math.max(1, Math.ceil(photoCount * 0.3)); // Keep ~30% for retries
      break;
    case 'angle_variations':
      keepCount = Math.max(1, Math.ceil(photoCount * 0.4)); // Keep ~40% for angles
      break;
    case 'incremental_progress':
      keepCount = Math.max(2, Math.ceil(photoCount * 0.6)); // Keep ~60% for progress
      break;
    case 'redundant_documentation':
      keepCount = Math.max(1, Math.ceil(photoCount * 0.5)); // Keep ~50% for redundant
      break;
    default:
      keepCount = Math.max(1, Math.ceil(photoCount * 0.5));
  }
  
  // Select best photos to keep
  const keep = selectBestPhotos(group.photos, keepCount);
  const keepIds = new Set(keep.map(p => p.id));
  const archive = group.photos.filter(p => !keepIds.has(p.id));
  
  // Generate rationale based on group type
  const rationale = generateRationale(group, keep, archive);
  
  // Calculate time savings
  const estimatedTimeSaved = calculateTimeSavings(photoCount, keepCount);
  
  // Confidence based on group confidence and similarity scores
  const confidence = Math.min(0.95, group.confidence * 0.9 + group.similarity.overallSimilarity * 0.1);
  
  return {
    group,
    keep,
    archive,
    rationale,
    estimatedTimeSaved,
    confidence
  };
}

/**
 * Generate human-readable rationale for curation recommendation
 */
function generateRationale(
  group: PhotoSimilarityGroup, 
  keep: Photo[], 
  archive: Photo[]
): string {
  const groupTypeDescriptions = {
    retry_shots: 'multiple attempts at the same shot',
    angle_variations: 'different angles of the same subject',
    incremental_progress: 'incremental progress documentation',
    redundant_documentation: 'similar documentation content'
  };
  
  const groupDescription = groupTypeDescriptions[group.groupType] || 'similar photos';
  const photoCount = group.photos.length;
  const keepCount = keep.length;
  
  if (keepCount === 1) {
    return `I found ${photoCount} photos showing ${groupDescription}. This photo captures everything you need with the best quality and most complete documentation.`;
  } else {
    return `I found ${photoCount} photos showing ${groupDescription}. These ${keepCount} photos provide the most comprehensive documentation while eliminating redundancy.`;
  }
}

/**
 * Generate conversational CamIntellect message for curation suggestions
 */
export function generateCamIntellectMessage(recommendations: CurationRecommendation[]): string {
  if (recommendations.length === 0) {
    return "I've analyzed your photos and everything looks well organized!";
  }
  
  const totalPhotos = recommendations.reduce((sum, rec) => sum + rec.group.photos.length, 0);
  const totalKeep = recommendations.reduce((sum, rec) => sum + rec.keep.length, 0);
  const totalSavings = recommendations.reduce((sum, rec) => sum + rec.estimatedTimeSaved, 0);
  
  // Get the most common group type for tailored messaging
  const groupTypes = recommendations.map(rec => rec.group.groupType);
  const primaryGroupType = groupTypes.reduce((a, b, i, arr) =>
    arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
  );
  
  let message: string;
  
  if (recommendations.length === 1) {
    const rec = recommendations[0];
    switch (rec.group.groupType) {
      case 'retry_shots':
        message = `I noticed ${totalPhotos} photos that look like retry shots of the same thing. Would you like me to recommend the best ${totalKeep} that capture everything you need?`;
        break;
      case 'angle_variations':
        message = `I found ${totalPhotos} photos showing the same work from different angles. I can help you pick the ${totalKeep} most useful shots - want to see my suggestions?`;
        break;
      case 'incremental_progress':
        message = `I see ${totalPhotos} progress photos that tell a similar story. Would you like me to recommend the ${totalKeep} key shots that best document the progression?`;
        break;
      default:
        message = `I've noticed ${totalPhotos} photos that appear very similar. I can help you streamline to the best ${totalKeep} photos - shall I show you?`;
    }
  } else {
    message = `I found ${recommendations.length} groups of similar photos (${totalPhotos} total). I can help you streamline these to ${totalKeep} photos that maintain all the important documentation.`;
  }
  
  // Add time savings if significant
  if (totalSavings >= 1) {
    message += ` This could save you about ${Math.round(totalSavings)} minute${totalSavings > 1 ? 's' : ''} during photo reviews.`;
  }
  
  return message;
}