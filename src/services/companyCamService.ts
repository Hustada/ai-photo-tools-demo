// 2025 Mark Hustad — MIT License

import axios from 'axios';
import type { Photo, PhotosResponse, Tag, PhotoTagsResponse, CurrentUser, CompanyDetails, Project } from '../types';

const API_BASE_URL = 'https://api.companycam.com/v2';

const getAuthHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

// Rate limiting and caching
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number = 30; // Max 30 requests per minute
  private readonly timeWindow: number = 60000; // 1 minute in milliseconds

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove requests older than time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    if (this.requests.length === 0) return 0;
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.timeWindow - (Date.now() - oldestRequest));
  }
}

class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly ttl = 30000; // 30 seconds cache

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const rateLimiter = new RateLimiter();
const requestCache = new RequestCache();

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced request function with rate limiting and exponential backoff
const makeRateLimitedRequest = async <T>(
  requestFn: () => Promise<T>,
  cacheKey?: string,
  maxRetries: number = 3
): Promise<T> => {
  // Check cache first
  if (cacheKey) {
    const cached = requestCache.get(cacheKey);
    if (cached) {
      console.log('[companyCamService] Cache hit for:', cacheKey);
      return cached;
    }
  }

  let retries = 0;
  while (retries <= maxRetries) {
    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      console.log(`[companyCamService] Rate limit reached, waiting ${waitTime}ms`);
      await sleep(waitTime);
      continue;
    }

    try {
      rateLimiter.recordRequest();
      const result = await requestFn();
      
      // Cache successful result
      if (cacheKey) {
        requestCache.set(cacheKey, result);
      }
      
      return result;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        retries++;
        if (retries <= maxRetries) {
          const backoffTime = Math.min(1000 * Math.pow(2, retries), 10000); // Max 10s backoff
          console.log(`[companyCamService] 429 error, retrying in ${backoffTime}ms (attempt ${retries}/${maxRetries})`);
          await sleep(backoffTime);
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error(`Max retries (${maxRetries}) exceeded`);
};

console.log('[companyCamService] Initializing...');
export const companyCamService = {
  getPhotos: async (
    apiKey: string,
    page: number = 1,
    perPage: number = 20,
    tagIds?: string[],
  ): Promise<Photo[]> => {
    console.log('[companyCamService] getPhotos called with:', { 
      apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', 
      page, 
      perPage, 
      tagIds 
    });

    const params: Record<string, string | number | string[] | undefined> = {
      page,
      per_page: perPage,
      sort: '-created_at',
    };
    if (tagIds && tagIds.length > 0) {
      params.tag_ids = tagIds;
    }

    // Create cache key
    const cacheKey = `photos-${JSON.stringify(params)}`;

    return makeRateLimitedRequest(
      async () => {
        console.log('[companyCamService] getPhotos - Making GET request to:', `${API_BASE_URL}/photos`, 'with params:', params);
        const response = await axios.get<PhotosResponse>(`${API_BASE_URL}/photos`, {
          headers: getAuthHeaders(apiKey),
          params,
        });
        return response.data;
      },
      cacheKey
    ).catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] getPhotos - Error fetching photos (Axios):', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
      } else if (error instanceof Error) {
        console.error('[companyCamService] getPhotos - Error fetching photos (Generic):', error.message);
      } else {
        console.error('[companyCamService] getPhotos - Unknown error fetching photos:', error);
      }
      throw error;
    });
  },

  getPhotoTags: async (apiKey: string, photoId: string): Promise<Tag[]> => {
    console.log('[companyCamService] getPhotoTags called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', photoId });
    
    const cacheKey = `photo-tags-${photoId}`;

    return makeRateLimitedRequest(
      async () => {
        console.log('[companyCamService] getPhotoTags - Making GET request to:', `${API_BASE_URL}/photos/${photoId}/tags`);
        const response = await axios.get<PhotoTagsResponse>(
          `${API_BASE_URL}/photos/${photoId}/tags`,
          {
            headers: getAuthHeaders(apiKey),
          },
        );
        return response.data;
      },
      cacheKey
    ).catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] getPhotoTags - Error fetching tags for photo ${photoId} (Axios):`, {
          status: error.response?.status,
          message: error.message
        });
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
      throw error;
    });
  },

  listCompanyCamTags: async (apiKey: string): Promise<Tag[]> => {
    console.log('[companyCamService] listCompanyCamTags called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY' });
    
    const cacheKey = 'all-tags';

    return makeRateLimitedRequest(
      async () => {
        console.log('[companyCamService] listCompanyCamTags - Making GET request to:', `${API_BASE_URL}/tags`);
        const response = await axios.get<Tag[]>(`${API_BASE_URL}/tags`, {
          headers: getAuthHeaders(apiKey),
        });
        return response.data;
      },
      cacheKey
    ).catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] listCompanyCamTags - Error fetching all tags (Axios):', {
          status: error.response?.status,
          message: error.message
        });
      } else if (error instanceof Error) {
        console.error('[companyCamService] listCompanyCamTags - Error fetching all tags (Generic):', error.message);
      } else {
        console.error('[companyCamService] listCompanyCamTags - Unknown error fetching all tags:', error);
      }
      throw error;
    });
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

  removeTagsFromPhoto: async (apiKey: string, photoId: string, tagIds: string[]): Promise<void> => {
    console.log('[companyCamService] removeTagsFromPhoto called with:', { apiKey: apiKey ? 'Exists' : 'MISSING/EMPTY', photoId, tagIds });
    if (tagIds.length === 0) {
      console.log('[companyCamService] removeTagsFromPhoto - No tag IDs provided, skipping API call.');
      return Promise.resolve();
    }
    try {
      console.log('[companyCamService] removeTagsFromPhoto - Making DELETE request to:', `${API_BASE_URL}/photos/${photoId}/tags`);
      await axios.delete(
        `${API_BASE_URL}/photos/${photoId}/tags`,
        {
          headers: getAuthHeaders(apiKey),
          data: { tag_ids: tagIds }, // DELETE requests with body
        }
      );
      return;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[companyCamService] removeTagsFromPhoto - Error removing tags from photo ${photoId} (Axios):`, error.toJSON());
      } else if (error instanceof Error) {
        console.error(`[companyCamService] removeTagsFromPhoto - Error removing tags from photo ${photoId} (Generic):`, error.message);
      } else {
        console.error(`[companyCamService] removeTagsFromPhoto - Unknown error removing tags from photo ${photoId}:`, error);
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

  /**
   * Mark a photo as analyzed by Scout AI
   */
  markPhotoAnalyzed: async (
    photoId: string,
    userAction?: 'kept' | 'archived' | 'pending' | null
  ): Promise<{ success: boolean; photo?: any; error?: string }> => {
    try {
      const analysisData = {
        analyzed_at: new Date().toISOString(),
        analysis_version: 'v2.0-perceptual-hash',
        user_action: userAction
      };

      console.log('[companyCamService] markPhotoAnalyzed - Marking photo as analyzed:', photoId, analysisData);

      const response = await axios.patch(
        `/api/photo-analysis/${photoId}`,
        analysisData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('[companyCamService] markPhotoAnalyzed - Error marking photo as analyzed (Axios):', error.toJSON());
        return { 
          success: false, 
          error: error.response?.data?.error || error.message 
        };
      } else if (error instanceof Error) {
        console.error('[companyCamService] markPhotoAnalyzed - Error marking photo as analyzed (Generic):', error.message);
        return { 
          success: false, 
          error: error.message 
        };
      } else {
        console.error('[companyCamService] markPhotoAnalyzed - Unknown error marking photo as analyzed:', error);
        return { 
          success: false, 
          error: 'Unknown error occurred' 
        };
      }
    }
  },

  /**
   * Mark multiple photos as analyzed in batch
   */
  markPhotosAnalyzed: async (
    photoIds: string[],
    userActions?: Record<string, 'kept' | 'archived' | 'pending' | null>
  ): Promise<{ success: boolean; results?: any[]; error?: string }> => {
    try {
      console.log('[companyCamService] markPhotosAnalyzed - Marking photos as analyzed:', photoIds.length, 'photos');

      const promises = photoIds.map(photoId =>
        companyCamService.markPhotoAnalyzed(photoId, userActions?.[photoId])
      );

      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      console.log('[companyCamService] markPhotosAnalyzed - Batch complete:', {
        total: photoIds.length,
        successful: successful.length,
        failed: failed.length
      });

      if (failed.length > 0) {
        console.warn('[companyCamService] markPhotosAnalyzed - Some photos failed to update:', failed);
      }

      return {
        success: successful.length > 0,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Failed' })
      };
    } catch (error: unknown) {
      console.error('[companyCamService] markPhotosAnalyzed - Error in batch update:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  },

  // Test utility to clear cache between tests
  clearCache: () => {
    requestCache.clear();
  }
};
