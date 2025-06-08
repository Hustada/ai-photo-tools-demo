// © 2025 Mark Hustad — MIT License

import { companyCamService } from '../../services/companyCamService';
import type { Photo, Tag } from '../../types';

// Local type for API enhancement response
interface ApiPhotoEnhancement {
  photo_id: string;
  user_id: string;
  ai_description?: string;
  accepted_ai_tags: string[];
  created_at: string;
  updated_at: string;
  suggestion_source?: string;
}

// Query key factories for consistent cache keys
export const photoQueryKeys = {
  all: ['photos'] as const,
  lists: () => [...photoQueryKeys.all, 'list'] as const,
  list: (page: number, filters?: { tagIds?: string[] }) => 
    [...photoQueryKeys.lists(), { page, filters }] as const,
  details: () => [...photoQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoQueryKeys.details(), id] as const,
  tags: () => [...photoQueryKeys.all, 'tags'] as const,
  photoTags: (photoId: string) => [...photoQueryKeys.tags(), 'photo', photoId] as const,
  batchTags: (photoIds: string[]) => [...photoQueryKeys.tags(), 'batch', photoIds.sort()] as const,
  aiEnhancements: () => [...photoQueryKeys.all, 'ai-enhancements'] as const,
  aiEnhancement: (photoId: string) => [...photoQueryKeys.aiEnhancements(), photoId] as const,
  batchAiEnhancements: (photoIds: string[]) => [...photoQueryKeys.aiEnhancements(), 'batch', photoIds.sort()] as const,
};

// Batch fetch AI enhancements for multiple photos
export const batchFetchAiEnhancements = async (photoIds: string[]): Promise<Record<string, ApiPhotoEnhancement>> => {
  console.log(`[photoQueries] Batch fetching AI enhancements for ${photoIds.length} photos`);
  
  try {
    const response = await fetch('/api/ai-enhancements-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoIds }),
    });

    if (!response.ok) {
      throw new Error(`Batch AI enhancements request failed: ${response.status}`);
    }

    const batchResponse: { enhancements: Record<string, ApiPhotoEnhancement>; errors?: Record<string, string> } = await response.json();
    
    if (batchResponse.errors && Object.keys(batchResponse.errors).length > 0) {
      console.warn(`[photoQueries] Some AI enhancements failed to fetch:`, batchResponse.errors);
    }

    console.log(`[photoQueries] Successfully batch fetched AI enhancements for ${Object.keys(batchResponse.enhancements).length}/${photoIds.length} photos`);
    return batchResponse.enhancements;
    
  } catch (error) {
    console.error(`[photoQueries] Error in batch fetch AI enhancements:`, error);
    // Fallback to empty enhancements map
    return {};
  }
};

// Batch fetch tags for multiple photos
export const batchFetchPhotoTags = async (apiKey: string, photoIds: string[]): Promise<Record<string, Tag[]>> => {
  console.log(`[photoQueries] Batch fetching tags for ${photoIds.length} photos`);
  
  try {
    const response = await fetch('/api/photo-tags-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoIds, apiKey }),
    });

    if (!response.ok) {
      throw new Error(`Batch photo tags request failed: ${response.status}`);
    }

    const batchResponse: { photoTags: Record<string, Tag[]>; errors?: Record<string, string> } = await response.json();
    
    if (batchResponse.errors && Object.keys(batchResponse.errors).length > 0) {
      console.warn(`[photoQueries] Some photo tags failed to fetch:`, batchResponse.errors);
    }

    console.log(`[photoQueries] Successfully batch fetched tags for ${Object.keys(batchResponse.photoTags).length}/${photoIds.length} photos`);
    return batchResponse.photoTags;
    
  } catch (error) {
    console.error(`[photoQueries] Error in batch fetch photo tags:`, error);
    // Fallback to empty tags map
    const fallbackMap: Record<string, Tag[]> = {};
    photoIds.forEach(id => { fallbackMap[id] = []; });
    return fallbackMap;
  }
};

// Enhanced photo fetching with batched tag and AI data
export const fetchPhotosWithEnhancements = async (
  apiKey: string,
  page: number = 1,
  perPage: number = 20,
  tagIds?: string[]
): Promise<Photo[]> => {
  console.log(`[photoQueries] Fetching photos with enhancements - page: ${page}, perPage: ${perPage}, tagIds:`, tagIds);

  // 1. Fetch basic photos
  const basicPhotos = await companyCamService.getPhotos(apiKey, page, perPage, tagIds);
  console.log(`[photoQueries] Fetched ${basicPhotos.length} basic photos`);

  if (basicPhotos.length === 0) {
    return [];
  }

  const photoIds = basicPhotos.map(photo => photo.id);

  // 2. Batch fetch tags and AI enhancements in parallel
  const [tagsMap, aiEnhancementsMap] = await Promise.all([
    batchFetchPhotoTags(apiKey, photoIds),
    batchFetchAiEnhancements(photoIds)
  ]);

  // 3. Merge all data
  const enhancedPhotos = basicPhotos.map(basicPhoto => {
    const companyCamTags = tagsMap[basicPhoto.id] || [];
    const aiEnhancement = aiEnhancementsMap[basicPhoto.id];

    // Process CompanyCam tags
    let finalTags: Tag[] = companyCamTags.map(tag => ({
      ...tag,
      id: tag.id.toString(),
      isAiEnhanced: false,
    }));

    let finalDescription = basicPhoto.description;

    // Apply AI enhancements if available
    if (aiEnhancement) {
      // Apply AI description
      if (aiEnhancement.ai_description) {
        finalDescription = aiEnhancement.ai_description;
      }

      // Apply AI tags
      if (aiEnhancement.accepted_ai_tags && aiEnhancement.accepted_ai_tags.length > 0) {
        const aiTagValues = aiEnhancement.accepted_ai_tags
          .map(tagValue => tagValue.trim())
          .filter(Boolean);

        aiTagValues.forEach(aiTagValue => {
          const aiTagValueLower = aiTagValue.toLowerCase();
          const matchingExistingTag = finalTags.find(t => 
            t.display_value.toLowerCase() === aiTagValueLower
          );

          if (matchingExistingTag) {
            matchingExistingTag.isAiEnhanced = true;
          } else {
            finalTags.push({
              display_value: aiTagValue,
              isAiEnhanced: true,
              id: `ai_${basicPhoto.id}_${aiTagValue.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}`,
              company_id: 'AI_TAG',
              value: aiTagValue,
              created_at: Date.now(),
              updated_at: Date.now(),
            });
          }
        });
      }
    }

    return {
      ...basicPhoto,
      description: finalDescription,
      tags: finalTags,
    };
  });

  console.log(`[photoQueries] Successfully enhanced ${enhancedPhotos.length} photos with tags and AI data`);
  return enhancedPhotos;
};

// Get single photo by ID with full enhancement data
export const fetchPhotoById = async (apiKey: string, photoId: string): Promise<Photo | null> => {
  console.log(`[photoQueries] Fetching single photo by ID: ${photoId}`);
  
  try {
    // For a single photo, we need to use the same API but filter
    // Since CompanyCam API doesn't have a single photo endpoint, we'll need to search
    // This is a limitation we'd need to address with a proper single photo API
    
    // For now, fetch photo tags and AI enhancements directly
    const [tagsMap, aiEnhancementsMap] = await Promise.all([
      batchFetchPhotoTags(apiKey, [photoId]),
      batchFetchAiEnhancements([photoId])
    ]);
    
    // We'd need the basic photo data too - this is a limitation of the current approach
    // In a real scenario, you'd want a proper /photos/{id} endpoint
    console.warn(`[photoQueries] fetchPhotoById is incomplete - need basic photo data for ${photoId}`);
    return null;
    
  } catch (error) {
    console.error(`[photoQueries] Error fetching photo ${photoId}:`, error);
    return null;
  }
};