// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  photoQueryKeys,
  batchFetchAiEnhancements,
  batchFetchPhotoTags,
  fetchPhotosWithEnhancements,
  fetchPhotoById,
} from '../photoQueries';
import { companyCamService } from '../../../services/companyCamService';
import type { Photo, Tag } from '../../../types';

// Mock the companyCamService
vi.mock('../../../services/companyCamService');

// Mock fetch globally
global.fetch = vi.fn();

// Mock photo data
const mockPhoto: Photo = {
  id: 'photo-1',
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Doe',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [],
  uris: [
    { type: 'web', uri: 'https://example.com/photo.jpg', url: 'https://example.com/photo.jpg' }
  ],
  hash: 'abc123',
  description: 'Test photo',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  tags: [],
};

const mockTag: Tag = {
  id: 'tag-1',
  display_value: 'Roofing',
  value: 'roofing',
  company_id: 'company-1',
  created_at: Date.now(),
  updated_at: Date.now(),
};

const mockAiEnhancement = {
  photo_id: 'photo-1',
  user_id: 'user-1',
  ai_description: 'AI generated description',
  accepted_ai_tags: ['ai-tag-1', 'ai-tag-2'],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  suggestion_source: 'test',
};

describe('photoQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('photoQueryKeys', () => {
    it('should generate correct query keys', () => {
      expect(photoQueryKeys.all).toEqual(['photos']);
      expect(photoQueryKeys.lists()).toEqual(['photos', 'list']);
      expect(photoQueryKeys.list(1, { tagIds: ['tag1'] })).toEqual([
        'photos',
        'list',
        { page: 1, filters: { tagIds: ['tag1'] } },
      ]);
      expect(photoQueryKeys.details()).toEqual(['photos', 'detail']);
      expect(photoQueryKeys.detail('photo-1')).toEqual(['photos', 'detail', 'photo-1']);
      expect(photoQueryKeys.tags()).toEqual(['photos', 'tags']);
      expect(photoQueryKeys.photoTags('photo-1')).toEqual(['photos', 'tags', 'photo', 'photo-1']);
      expect(photoQueryKeys.batchTags(['photo-2', 'photo-1'])).toEqual([
        'photos',
        'tags',
        'batch',
        ['photo-1', 'photo-2'], // Should be sorted
      ]);
      expect(photoQueryKeys.aiEnhancements()).toEqual(['photos', 'ai-enhancements']);
      expect(photoQueryKeys.aiEnhancement('photo-1')).toEqual(['photos', 'ai-enhancements', 'photo-1']);
      expect(photoQueryKeys.batchAiEnhancements(['photo-2', 'photo-1'])).toEqual([
        'photos',
        'ai-enhancements',
        'batch',
        ['photo-1', 'photo-2'], // Should be sorted
      ]);
    });
  });

  describe('batchFetchAiEnhancements', () => {
    it('should fetch AI enhancements successfully via batch endpoint', async () => {
      const mockResponse = {
        enhancements: {
          'photo-1': mockAiEnhancement,
          'photo-2': { ...mockAiEnhancement, photo_id: 'photo-2' },
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await batchFetchAiEnhancements(['photo-1', 'photo-2']);

      expect(fetch).toHaveBeenCalledWith('/api/ai-enhancements-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: ['photo-1', 'photo-2'] }),
      });

      expect(result).toEqual(mockResponse.enhancements);
    });

    it('should handle batch endpoint errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await batchFetchAiEnhancements(['photo-1']);

      expect(result).toEqual({});
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await batchFetchAiEnhancements(['photo-1']);

      expect(result).toEqual({});
    });

    it('should handle response with errors', async () => {
      const mockResponse = {
        enhancements: { 'photo-1': mockAiEnhancement },
        errors: { 'photo-2': 'Failed to fetch' },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await batchFetchAiEnhancements(['photo-1', 'photo-2']);

      expect(result).toEqual(mockResponse.enhancements);
    });
  });

  describe('batchFetchPhotoTags', () => {
    it('should fetch photo tags successfully via batch endpoint', async () => {
      const mockResponse = {
        photoTags: {
          'photo-1': [mockTag],
          'photo-2': [{ ...mockTag, id: 'tag-2', display_value: 'HVAC' }],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await batchFetchPhotoTags('test-api-key', ['photo-1', 'photo-2']);

      expect(fetch).toHaveBeenCalledWith('/api/photo-tags-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: ['photo-1', 'photo-2'], apiKey: 'test-api-key' }),
      });

      expect(result).toEqual(mockResponse.photoTags);
    });

    it('should handle batch endpoint errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await batchFetchPhotoTags('test-api-key', ['photo-1']);

      expect(result).toEqual({ 'photo-1': [] });
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await batchFetchPhotoTags('test-api-key', ['photo-1']);

      expect(result).toEqual({ 'photo-1': [] });
    });

    it('should handle response with errors', async () => {
      const mockResponse = {
        photoTags: { 'photo-1': [mockTag] },
        errors: { 'photo-2': 'Failed to fetch' },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await batchFetchPhotoTags('test-api-key', ['photo-1', 'photo-2']);

      expect(result).toEqual(mockResponse.photoTags);
    });
  });

  describe('fetchPhotosWithEnhancements', () => {
    beforeEach(() => {
      // Mock the batch fetch functions
      vi.mocked(fetch).mockImplementation((url) => {
        if (url === '/api/ai-enhancements-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enhancements: { 'photo-1': mockAiEnhancement } }),
          } as Response);
        }
        if (url === '/api/photo-tags-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ photoTags: { 'photo-1': [mockTag] } }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should fetch and enhance photos successfully', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto]);

      const result = await fetchPhotosWithEnhancements('test-api-key', 1, 20);

      expect(companyCamService.getPhotos).toHaveBeenCalledWith('test-api-key', 1, 20, undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockPhoto,
        description: mockAiEnhancement.ai_description,
        tags: expect.arrayContaining([
          expect.objectContaining({ ...mockTag, isAiEnhanced: false }),
          expect.objectContaining({ display_value: 'ai-tag-1', isAiEnhanced: true }),
          expect.objectContaining({ display_value: 'ai-tag-2', isAiEnhanced: true }),
        ]),
      });
    });

    it('should handle empty photo results', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([]);

      const result = await fetchPhotosWithEnhancements('test-api-key', 1, 20);

      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled(); // Should not call batch endpoints for empty results
    });

    it('should handle photos without AI enhancements', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto]);
      
      // Mock empty AI enhancements response
      vi.mocked(fetch).mockImplementation((url) => {
        if (url === '/api/ai-enhancements-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enhancements: {} }),
          } as Response);
        }
        if (url === '/api/photo-tags-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ photoTags: { 'photo-1': [mockTag] } }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await fetchPhotosWithEnhancements('test-api-key', 1, 20);

      expect(result[0]).toEqual({
        ...mockPhoto,
        tags: [{ ...mockTag, isAiEnhanced: false }],
      });
    });

    it('should merge AI tags with existing tags correctly', async () => {
      const photoWithExistingTag = {
        ...mockPhoto,
        tags: [mockTag],
      };

      vi.mocked(companyCamService.getPhotos).mockResolvedValue([photoWithExistingTag]);

      const aiEnhancementWithMatchingTag = {
        ...mockAiEnhancement,
        accepted_ai_tags: ['roofing', 'new-ai-tag'], // 'roofing' matches existing tag
      };

      vi.mocked(fetch).mockImplementation((url) => {
        if (url === '/api/ai-enhancements-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enhancements: { 'photo-1': aiEnhancementWithMatchingTag } }),
          } as Response);
        }
        if (url === '/api/photo-tags-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ photoTags: { 'photo-1': [mockTag] } }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await fetchPhotosWithEnhancements('test-api-key', 1, 20);

      const resultTags = result[0].tags;
      const roofingTag = resultTags?.find(t => t.display_value.toLowerCase() === 'roofing');
      const newAiTag = resultTags?.find(t => t.display_value === 'new-ai-tag');

      expect(roofingTag?.isAiEnhanced).toBe(true); // Should be marked as AI enhanced
      expect(newAiTag?.isAiEnhanced).toBe(true); // Should be a new AI tag
    });

    it('should handle tagIds parameter', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto]);

      await fetchPhotosWithEnhancements('test-api-key', 1, 20, ['tag1', 'tag2']);

      expect(companyCamService.getPhotos).toHaveBeenCalledWith('test-api-key', 1, 20, ['tag1', 'tag2']);
    });

    it('should handle AI tag sanitization', async () => {
      vi.mocked(companyCamService.getPhotos).mockResolvedValue([mockPhoto]);

      const aiEnhancementWithMessyTags = {
        ...mockAiEnhancement,
        accepted_ai_tags: ['  valid-tag  ', '', '   ', 'another-tag'],
      };

      vi.mocked(fetch).mockImplementation((url) => {
        if (url === '/api/ai-enhancements-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ enhancements: { 'photo-1': aiEnhancementWithMessyTags } }),
          } as Response);
        }
        if (url === '/api/photo-tags-batch') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ photoTags: { 'photo-1': [] } }),
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await fetchPhotosWithEnhancements('test-api-key', 1, 20);

      expect(result[0].tags).toHaveLength(2); // Only valid tags should be included
      expect(result[0].tags?.map(t => t.display_value)).toEqual(['valid-tag', 'another-tag']);
    });
  });

  describe('fetchPhotoById', () => {
    it('should log a warning about incomplete implementation', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await fetchPhotoById('test-api-key', 'photo-1');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('fetchPhotoById is incomplete')
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      // Mock fetch to throw an error
      vi.mocked(fetch).mockRejectedValue(new Error('Test error'));

      const result = await fetchPhotoById('test-api-key', 'photo-1');

      expect(result).toBeNull();
    });
  });
});