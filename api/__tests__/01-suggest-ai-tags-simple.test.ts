// © 2025 Mark Hustad — MIT License
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Helper functions to create mock request and response objects
function createMockReq(method: string, body: any = {}): VercelRequest {
  return {
    method,
    body,
    headers: {},
    query: {},
    url: '',
  } as VercelRequest
}

function createMockRes(): VercelResponse {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as VercelResponse
  return res
}

describe('/api/suggest-ai-tags - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up basic environment variables
    process.env.COMPANYCAM_API_KEY = 'test-companycam-key'
    process.env.GOOGLE_CLOUD_VISION_API_KEY = 'test-google-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  afterEach(() => {
    vi.resetAllMocks()
    delete process.env.COMPANYCAM_API_KEY
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  describe('Request validation', () => {
    // Import handler only when needed to avoid mocking issues
    it('should handle OPTIONS requests for CORS', async () => {
      const { default: handler } = await import('../suggest-ai-tags')
      
      const req = createMockReq('OPTIONS')
      const res = createMockRes()

      await handler(req, res)

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS')
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 405 for non-POST methods', async () => {
      const { default: handler } = await import('../suggest-ai-tags')
      
      const req = createMockReq('GET')
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' })
    })

    it('should return 500 when CompanyCam API key is missing', async () => {
      delete process.env.COMPANYCAM_API_KEY
      delete process.env.VITE_APP_COMPANYCAM_API_KEY

      const { default: handler } = await import('../suggest-ai-tags')
      
      const req = createMockReq('POST')
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'Server configuration error: CompanyCam API key missing.' 
      })
    })

    it('should return 500 when Google Vision API key is missing', async () => {
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY

      const { default: handler } = await import('../suggest-ai-tags')
      
      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Server configuration error: Google API key missing.' 
      })
    })

    it('should return 500 when required request body fields are missing', async () => {
      const { default: handler } = await import('../suggest-ai-tags')
      
      const req = createMockReq('POST', {
        photoUrl: 'https://example.com/photo.jpg'
        // Missing photoId
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Failed to get AI suggestions',
        details: 'Missing photoId or photoUrl in request body'
      })
    })
  })
})