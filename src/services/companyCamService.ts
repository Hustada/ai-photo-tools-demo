// © 2025 Mark Hustad — MIT License

import axios from 'axios';
import type { Photo, PhotosResponse, Tag, PhotoTagsResponse } from '../types';

const API_BASE_URL = 'https://api.companycam.com/v2';

const getAuthHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

console.log('[companyCamService] Initializing...');
export const companyCamService = {
  getPhotos: async (
    // Adding console.log for parameters
    apiKey: string,
    page: number = 1,
    perPage: number = 20,
    tagIds?: string[],
  ): Promise<Photo[]> => {
    console.log('[companyCamService] getPhotos called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', page, perPage, tagIds });
    try {
      const params: Record<string, any> = {
        page,
        per_page: perPage,
      };
      if (tagIds && tagIds.length > 0) {
        params.tag_ids = tagIds; // API expects 'tag_ids' as array
      }
      console.log('[companyCamService] getPhotos - Making GET request to:', `${API_BASE_URL}/photos`, 'with params:', params);
      const response = await axios.get<PhotosResponse>(`${API_BASE_URL}/photos`, {
        headers: getAuthHeaders(apiKey),
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('[companyCamService] getPhotos - Error fetching photos:', error.isAxiosError ? error.toJSON() : error);
      // Consider more sophisticated error handling
      throw error;
    }
  },

  getPhotoTags: async (apiKey: string, photoId: string): Promise<Tag[]> => {
    console.log('[companyCamService] getPhotoTags called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', photoId });
    try {
      console.log('[companyCamService] getPhotoTags - Making GET request to:', `${API_BASE_URL}/photos/${photoId}/tags`);
      const response = await axios.get<PhotoTagsResponse>(
        `${API_BASE_URL}/photos/${photoId}/tags`,
        {
          headers: getAuthHeaders(apiKey),
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(`[companyCamService] getPhotoTags - Error fetching tags for photo ${photoId}:`, error.isAxiosError ? error.toJSON() : error);
      throw error;
    }
  },
};
