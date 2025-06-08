// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../photo-tags-batch';
import * as https from 'https';

// Mock https module
vi.mock('https');

// Helper to create mock request
const createMockRequest = (method: string = 'POST', body: any = {}): VercelRequest => ({
  method,
  body,
  headers: {},
  query: {},
  url: '/api/photo-tags-batch',
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

// Helper to create mock HTTPS request
const createMockHttpsRequest = (statusCode: number = 200, responseData: any = [], shouldError: boolean = false) => {
  const mockResponse = {
    statusCode,
    on: vi.fn((event: string, callback: Function) => {
      if (event === 'data') {
        callback(JSON.stringify(responseData));
      } else if (event === 'end') {
        callback();
      }
    }),
  };

  const mockRequest = {
    on: vi.fn((event: string, callback: Function) => {
      if (event === 'error' && shouldError) {
        callback(new Error('Network error'));
      }
    }),
    end: vi.fn(),
  };

  vi.mocked(https.request).mockImplementation((options: any, callback: Function) => {
    callback(mockResponse);
    return mockRequest as any;
  });

  return { mockRequest, mockResponse };
};

describe('/api/photo-tags-batch', () => {
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
      const req = createMockRequest('POST', { apiKey: 'test-key' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });

    it('should return 400 when photoIds is not an array', async () => {
      const req = createMockRequest('POST', { photoIds: 'not-an-array', apiKey: 'test-key' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });

    it('should return 400 when photoIds is empty array', async () => {
      const req = createMockRequest('POST', { photoIds: [], apiKey: 'test-key' });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'photoIds array is required' });
    });

    it('should return 400 when apiKey is missing', async () => {
      const req = createMockRequest('POST', { photoIds: ['photo1'] });
      const res = createMockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'apiKey is required' });
    });
  });

  describe('Successful Tag Fetching', () => {
    it('should fetch tags for multiple photos successfully', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1', 'photo2'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      const mockTags1 = [
        { id: 'tag1', display_value: 'Roofing', value: 'roofing', company_id: 'comp1', created_at: 123, updated_at: 123 },
        { id: 'tag2', display_value: 'HVAC', value: 'hvac', company_id: 'comp1', created_at: 123, updated_at: 123 }
      ];
      const mockTags2 = [
        { id: 'tag3', display_value: 'Plumbing', value: 'plumbing', company_id: 'comp1', created_at: 123, updated_at: 123 }
      ];

      let callCount = 0;
      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: Function) => {
        const mockResponse = {
          statusCode: 200,
          on: vi.fn((event: string, cb: Function) => {
            if (event === 'data') {
              const responseData = callCount === 0 ? mockTags1 : mockTags2;
              cb(JSON.stringify(responseData));
              callCount++;
            } else if (event === 'end') {
              cb();
            }
          }),
        };
        callback(mockResponse);
        return mockRequest as any;
      });

      await handler(req, res);

      expect(https.request).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags).toHaveProperty('photo1');
      expect(callArgs.photoTags).toHaveProperty('photo2');
      expect(callArgs.photoTags.photo1).toHaveLength(2);
      expect(callArgs.photoTags.photo2).toHaveLength(1);
    });

    it('should handle photos with no tags (empty arrays)', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      createMockHttpsRequest(200, []);

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 responses (photos with no tags)', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      createMockHttpsRequest(404, '');

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
    });

    it('should handle HTTP error responses', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: Function) => {
        const mockResponse = {
          statusCode: 500,
          on: vi.fn((event: string, cb: Function) => {
            if (event === 'data') {
              cb('Internal Server Error');
            } else if (event === 'end') {
              cb();
            }
          }),
        };
        callback(mockResponse);
        return mockRequest as any;
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
      expect(callArgs.errors).toHaveProperty('photo1');
    });

    it('should handle network errors', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      const mockRequest = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'error') {
            callback(new Error('Network error'));
          }
        }),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(() => {
        return mockRequest as any;
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
      expect(callArgs.errors).toHaveProperty('photo1');
      expect(callArgs.errors.photo1).toBe('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation((options: any, callback: Function) => {
        const mockResponse = {
          statusCode: 200,
          on: vi.fn((event: string, cb: Function) => {
            if (event === 'data') {
              cb('invalid json{');
            } else if (event === 'end') {
              cb();
            }
          }),
        };
        callback(mockResponse);
        return mockRequest as any;
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
    });

    it('should handle individual photo fetch errors gracefully', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      // Mock network error for individual photo fetch
      const mockRequest = {
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'error') {
            callback(new Error('Individual fetch error'));
          }
        }),
        end: vi.fn(),
      };

      vi.mocked(https.request).mockImplementation(() => {
        return mockRequest as any;
      });

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.photoTags.photo1).toEqual([]);
      expect(callArgs.errors).toHaveProperty('photo1', 'Individual fetch error');
    });
  });

  describe('API Request Details', () => {
    it('should make correct API calls to CompanyCam', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo123'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      createMockHttpsRequest(200, []);

      await handler(req, res);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.companycam.com',
          path: '/v2/photos/photo123/tags',
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'X-CompanyCam-Source': 'cc-ai-photo-inspirations-backend;vercel-serverless',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process all photos in parallel', async () => {
      const req = createMockRequest('POST', { 
        photoIds: ['photo1', 'photo2', 'photo3'], 
        apiKey: 'test-api-key' 
      });
      const res = createMockResponse();

      createMockHttpsRequest(200, []);

      await handler(req, res);

      expect(https.request).toHaveBeenCalledTimes(3);
      expect(res.status).toHaveBeenCalledWith(200);
      
      const callArgs = res.json.mock.calls[0][0];
      expect(Object.keys(callArgs.photoTags)).toHaveLength(3);
      expect(callArgs.photoTags).toHaveProperty('photo1');
      expect(callArgs.photoTags).toHaveProperty('photo2');
      expect(callArgs.photoTags).toHaveProperty('photo3');
    });
  });
});