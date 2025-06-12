// 2025 Mark Hustad — MIT License

import axios from 'axios';
import type { Photo, PhotosResponse, Tag, PhotoTagsResponse, CurrentUser, CompanyDetails, Project } from '../types';

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
      const params: Record<string, string | number | string[] | undefined> = {
        page,
        per_page: perPage,
        sort: '-created_at', // Sort by newest first (descending created_at)
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] getPhotos - Error fetching photos (Axios):', error.toJSON());
      } else if (error instanceof Error) {
        console.error('[companyCamService] getPhotos - Error fetching photos (Generic):', error.message);
      } else {
        console.error('[companyCamService] getPhotos - Unknown error fetching photos:', error);
      }
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
      return response.data; // PhotoTagsResponse is Tag[]
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] getPhotoTags - Error fetching tags for photo ${photoId} (Axios):`, error.toJSON());
        // Handle 404 specifically: if a photo has no tags, the API might 404.
        if (error.response && error.response.status === 404) {
          console.log(`[companyCamService] getPhotoTags - Photo ${photoId} has no tags (404). Returning empty array.`);
          return []; // Return empty array if no tags found (404)
        }
      } else if (error instanceof Error) {
        console.error(`[companyCamService] getPhotoTags - Error fetching tags for photo ${photoId} (Generic):`, error.message);
      } else {
        console.error(`[companyCamService] getPhotoTags - Unknown error fetching tags for photo ${photoId}:`, error);
      }
      throw error; // Re-throw other errors
    }
  },

  listCompanyCamTags: async (apiKey: string): Promise<Tag[]> => {
    console.log('[companyCamService] listCompanyCamTags called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY' });
    try {
      console.log('[companyCamService] listCompanyCamTags - Making GET request to:', `${API_BASE_URL}/tags`);
      // The API for listing all tags might be paginated. For simplicity, we'll assume it returns all tags
      // or we'd need to implement pagination handling here if it's a large number of tags.
      const response = await axios.get<Tag[]>(`${API_BASE_URL}/tags`, {
        headers: getAuthHeaders(apiKey),
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] listCompanyCamTags - Error fetching all tags (Axios):', error.toJSON());
      } else if (error instanceof Error) {
        console.error('[companyCamService] listCompanyCamTags - Error fetching all tags (Generic):', error.message);
      } else {
        console.error('[companyCamService] listCompanyCamTags - Unknown error fetching all tags:', error);
      }
      throw error;
    }
  },

  createCompanyCamTagDefinition: async (apiKey: string, displayValue: string): Promise<Tag> => {
    console.log('[companyCamService] createCompanyCamTagDefinition called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', displayValue });
    try {
      console.log('[companyCamService] createCompanyCamTagDefinition - Making POST request to:', `${API_BASE_URL}/tags`);
      const response = await axios.post<Tag>(
        `${API_BASE_URL}/tags`,
        { tag: { display_value: displayValue } }, // Correct payload structure
        {
          headers: getAuthHeaders(apiKey),
        },
      );
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] createCompanyCamTagDefinition - Error creating tag definition for '${displayValue}' (Axios):`, error.toJSON());
      } else if (error instanceof Error) {
        console.error(`[companyCamService] createCompanyCamTagDefinition - Error creating tag definition for '${displayValue}' (Generic):`, error.message);
      } else {
        console.error(`[companyCamService] createCompanyCamTagDefinition - Unknown error creating tag definition for '${displayValue}':`, error);
      }
      throw error;
    }
  },

  addTagsToPhoto: async (apiKey: string, photoId: string, tagIds: string[]): Promise<void> => { // API returns 204 No Content on success
    console.log('[companyCamService] addTagsToPhoto called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', photoId, tagIds });
    if (tagIds.length === 0) {
      console.log('[companyCamService] addTagsToPhoto - No tag IDs provided, skipping API call.');
      return Promise.resolve(); // Or handle as appropriate
    }
    try {
      console.log('[companyCamService] addTagsToPhoto - Making POST request to:', `${API_BASE_URL}/photos/${photoId}/tags`);
      await axios.post(
        `${API_BASE_URL}/photos/${photoId}/tags`,
        { tag_ids: tagIds }, // Correct payload structure
        {
          headers: getAuthHeaders(apiKey),
        },
      );
      // Successful response is typically 204 No Content, so response.data might be undefined or empty.
      return; // Or return a success status/message
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] addTagsToPhoto - Error adding tags to photo ${photoId} (Axios):`, error.toJSON());
      } else if (error instanceof Error) {
        console.error(`[companyCamService] addTagsToPhoto - Error adding tags to photo ${photoId} (Generic):`, error.message);
      } else {
        console.error(`[companyCamService] addTagsToPhoto - Unknown error adding tags to photo ${photoId}:`, error);
      }
      throw error;
    }
  },

  getCurrentUser: async (apiKey: string): Promise<CurrentUser> => {
    console.log('[companyCamService] getCurrentUser called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY' });
    try {
      console.log('[companyCamService] getCurrentUser - Making GET request to:', `${API_BASE_URL}/users/current`);
      const response = await axios.get<CurrentUser>(`${API_BASE_URL}/users/current`, {
        headers: getAuthHeaders(apiKey),
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] getCurrentUser - Error fetching current user (Axios):', error.toJSON());
      } else if (error instanceof Error) {
        console.error('[companyCamService] getCurrentUser - Error fetching current user (Generic):', error.message);
      } else {
        console.error('[companyCamService] getCurrentUser - Unknown error fetching current user:', error);
      }
      throw error;
    }
  },

  getCompanyDetails: async (apiKey: string, companyId: string): Promise<CompanyDetails> => {
    console.log('[companyCamService] getCompanyDetails called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', companyId });
    try {
      console.log('[companyCamService] getCompanyDetails - Making GET request to:', `${API_BASE_URL}/companies/${companyId}`);
      const response = await axios.get<CompanyDetails>(`${API_BASE_URL}/companies/${companyId}`, {
        headers: getAuthHeaders(apiKey),
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] getCompanyDetails - Error fetching company ${companyId} (Axios):`, error.toJSON());
      } else if (error instanceof Error) {
        console.error(`[companyCamService] getCompanyDetails - Error fetching company ${companyId} (Generic):`, error.message);
      } else {
        console.error(`[companyCamService] getCompanyDetails - Unknown error fetching company ${companyId}:`, error);
      }
      throw error;
    }
  },

  getProjects: async (apiKey: string, page: number = 1, perPage: number = 50): Promise<Project[]> => {
    console.log('[companyCamService] getProjects called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', page, perPage });
    try {
      const params: Record<string, string | number> = {
        page,
        per_page: perPage,
      };
      console.log('[companyCamService] getProjects - Making GET request to:', `${API_BASE_URL}/projects`, 'with params:', params);
      // Assuming the response data is directly an array of Project objects.
      // If the API wraps it (e.g., { projects: [...] }), this needs adjustment.
      const response = await axios.get<Project[]>(`${API_BASE_URL}/projects`, {
        headers: getAuthHeaders(apiKey),
        params,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] getProjects - Error fetching projects (Axios):', error.toJSON());
      } else if (error instanceof Error) {
        console.error('[companyCamService] getProjects - Error fetching projects (Generic):', error.message);
      } else {
        console.error('[companyCamService] getProjects - Unknown error fetching projects:', error);
      }
      throw error;
    }
  },
};
