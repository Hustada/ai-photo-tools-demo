// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../ai-enhancements-batch';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import { kv } from '@vercel/kv';

// Helper to create mock request
const createMockRequest = (method: string = 'POST', body: any = {}): VercelRequest => ({
  method,
  body,
  headers: {},
  query: {},
  url: '/api/ai-enhancements-batch',
} as VercelRequest);

// Helper to create mock response
const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  } as unknown as VercelResponse;
  return res;
};

describe('/api/ai-enhancements-batch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CORS and Method Handling', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const req = createMockRequest('OPTIONS');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('should return 405 for non-POST methods', async () => {
      const req = createMockRequest('GET');
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when photoIds is missing', async () => {
      const req = createMockRequest('POST', {});
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });

    it('should return 400 when photoIds is not an array', async () => {
      const req = createMockRequest('POST', { photoIds: 'not-an-array' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });

    it('should return 400 when photoIds is empty array', async () => {
      const req = createMockRequest('POST', { photoIds: [] });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });
  });

  describe('KV Store Integration', () => {
    it('should return empty enhancements when no data exists in KV store', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1', 'photo2'] });
      const res = createMockResponse();

      vi.mocked(kv.get).mockResolvedValue(null);

      await handler(req, res);

      expect(kv.get).toHaveBeenCalledWith('photo_enhancement:photo1');
      expect(kv.get).toHaveBeenCalledWith('photo_enhancement:photo2');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ enhancements: {} });
    });
  });

  describe('Enhancement Processing', () => {
    it('should successfully fetch multiple AI enhancements from KV store', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1', 'photo2'] });
      const res = createMockResponse();

      const mockEnhancement1 = {
        photo_id: 'photo1',
        user_id: 'user1',
        ai_description: 'Enhanced description 1',
        accepted_ai_tags: ['tag1', 'tag2'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        suggestion_source: 'test',
      };

      const mockEnhancement2 = {
        photo_id: 'photo2',
        user_id: 'user2',
        ai_description: 'Enhanced description 2',
        accepted_ai_tags: ['tag3'],
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        suggestion_source: 'test',
      };

      vi.mocked(kv.get).mockImplementation((key: string) => {
        if (key === 'photo_enhancement:photo1') return Promise.resolve(mockEnhancement1);
        if (key === 'photo_enhancement:photo2') return Promise.resolve(mockEnhancement2);
        return Promise.resolve(null);
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.enhancements).toHaveProperty('photo1');
      expect(responseData.enhancements).toHaveProperty('photo2');
      expect(responseData.enhancements.photo1.ai_description).toBe('Enhanced description 1');
      expect(responseData.enhancements.photo2.accepted_ai_tags).toEqual(['tag3']);
    });

    it('should handle mixed scenarios - some enhancements exist, some dont', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1', 'photo3'] });
      const res = createMockResponse();

      const mockEnhancement1 = {
        photo_id: 'photo1',
        user_id: 'user1',
        ai_description: 'Enhanced description 1',
        accepted_ai_tags: ['tag1', 'tag2'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        suggestion_source: 'test',
      };

      vi.mocked(kv.get).mockImplementation((key: string) => {
        if (key === 'photo_enhancement:photo1') return Promise.resolve(mockEnhancement1);
        return Promise.resolve(null); // photo3 doesn't exist
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.enhancements).toHaveProperty('photo1');
      expect(responseData.enhancements).not.toHaveProperty('photo3');
    });

    it('should handle KV store errors gracefully', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1'] });
      const res = createMockResponse();

      vi.mocked(kv.get).mockRejectedValue(new Error('KV connection failed'));

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.enhancements).toEqual({});
      expect(responseData.errors).toHaveProperty('photo1', 'KV connection failed');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple photos in parallel', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1', 'photo2', 'photo3'] });
      const res = createMockResponse();

      const mockEnhancement = {
        photo_id: 'photo1',
        user_id: 'user1',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        suggestion_source: 'test',
      };

      vi.mocked(kv.get).mockImplementation((key: string) => {
        if (key === 'photo_enhancement:photo1') return Promise.resolve(mockEnhancement);
        return Promise.resolve(null);
      });

      await handler(req, res);

      expect(kv.get).toHaveBeenCalledTimes(3);
      expect(kv.get).toHaveBeenCalledWith('photo_enhancement:photo1');
      expect(kv.get).toHaveBeenCalledWith('photo_enhancement:photo2');
      expect(kv.get).toHaveBeenCalledWith('photo_enhancement:photo3');
      expect(res.status).toHaveBeenCalledWith(200);
      
      const responseData = res.json.mock.calls[0][0];
      expect(Object.keys(responseData.enhancements)).toHaveLength(1);
      expect(responseData.enhancements).toHaveProperty('photo1');
    });
  });

  describe('Error Handling', () => {
    it('should handle individual photo errors gracefully', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1'] });
      const res = createMockResponse();

      // Mock an error for individual photo fetch
      vi.mocked(kv.get).mockRejectedValue(new Error('Unexpected error'));

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.enhancements).toEqual({});
      expect(responseData.errors).toHaveProperty('photo1', 'Unexpected error');
    });
  });
});