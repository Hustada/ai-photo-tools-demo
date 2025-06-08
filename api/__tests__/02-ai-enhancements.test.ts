// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

// Mock @vercel/kv before importing the handler
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

import handler from '../ai-enhancements'
import { kv } from '@vercel/kv'

// Type the mocked kv for better TypeScript support
const mockKv = vi.mocked(kv)

// Helper function to create mock request and response objects
function createMockReq(method: string, query: any = {}, body: any = {}): NextApiRequest {
  return {
    method,
    query,
    body,
    headers: {},
    cookies: {},
    url: '',
  } as NextApiRequest
}

function createMockRes(): NextApiResponse {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as NextApiResponse
  return res
}

describe('/api/ai-enhancements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET requests', () => {
    it('should return 400 when photoId is missing', async () => {
      const req = createMockReq('GET', {})
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid photoId' })
    })

    it('should return 400 when photoId is not a string', async () => {
      const req = createMockReq('GET', { photoId: 123 })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid photoId' })
    })

    it('should return 404 when no enhancement is found', async () => {
      mockKv.get.mockResolvedValue(null)
      
      const req = createMockReq('GET', { photoId: 'test-photo-id' })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.get).toHaveBeenCalledWith('photo_enhancement:test-photo-id')
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'No enhancements found for this photo.' })
    })

    it('should return 200 with enhancement data when found', async () => {
      const mockEnhancement = {
        photo_id: 'test-photo-id',
        user_id: 'test-user-id',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1', 'tag2'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(mockEnhancement)
      
      const req = createMockReq('GET', { photoId: 'test-photo-id' })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.get).toHaveBeenCalledWith('photo_enhancement:test-photo-id')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(mockEnhancement)
    })

    it('should return 500 when KV throws an error', async () => {
      const error = new Error('KV connection failed')
      mockKv.get.mockRejectedValue(error)
      
      const req = createMockReq('GET', { photoId: 'test-photo-id' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Failed to fetch enhancement.', 
        details: 'KV connection failed' 
      })
    })
  })

  describe('POST requests', () => {
    it('should return 400 when photoId is missing', async () => {
      const req = createMockReq('POST', {}, { userId: 'test-user' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Photo ID is required in the request body.' })
    })

    it('should return 400 when userId is missing', async () => {
      const req = createMockReq('POST', {}, { photoId: 'test-photo' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'User ID is required.' })
    })

    it('should create new enhancement when none exists', async () => {
      mockKv.get.mockResolvedValue(null)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        description: 'New description',
        suggestionSource: 'OpenAI-GPT-4o'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.get).toHaveBeenCalledWith('photo_enhancement:test-photo')
      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          photo_id: 'test-photo',
          user_id: 'test-user',
          ai_description: 'New description',
          accepted_ai_tags: [],
          suggestion_source: 'OpenAI-GPT-4o',
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should update existing enhancement', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'original-user',
        ai_description: 'Original description',
        accepted_ai_tags: ['existing-tag'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        suggestion_source: 'Original-Source'
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'new-user',
        description: 'Updated description',
        tagToAdd: 'new-tag'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          photo_id: 'test-photo',
          user_id: 'new-user',
          ai_description: 'Updated description',
          accepted_ai_tags: ['existing-tag', 'new-tag'],
          created_at: '2025-01-01T00:00:00.000Z',
          updated_at: expect.any(String),
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should not add duplicate tags', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'test-user',
        ai_description: null,
        accepted_ai_tags: ['existing-tag'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        tagToAdd: 'existing-tag'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          accepted_ai_tags: ['existing-tag'], // Should not duplicate
        })
      )
    })

    it('should handle null description explicitly', async () => {
      mockKv.get.mockResolvedValue(null)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        description: null
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          ai_description: null,
        })
      )
    })

    it('should handle acceptedAiTags array with filtering', async () => {
      mockKv.get.mockResolvedValue(null)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        acceptedAiTags: ['valid-tag', '', '  ', 'another-tag', null, 'final-tag']
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          accepted_ai_tags: ['valid-tag', 'another-tag', 'final-tag'],
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should return 500 when KV fails during POST', async () => {
      mockKv.get.mockResolvedValue(null)
      mockKv.set.mockRejectedValue(new Error('KV write failed'))
      
      const req = createMockReq('POST', {}, {
        photoId: 'test-photo',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save enhancement.' })
    })
  })

  describe('DELETE requests', () => {
    it('should return 400 when photoId is missing', async () => {
      const req = createMockReq('DELETE', {}, { userId: 'test-user' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Photo ID is required in the request body.' })
    })

    it('should return 400 when userId is missing', async () => {
      const req = createMockReq('DELETE', {}, { photoId: 'test-photo' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'User ID is required.' })
    })

    it('should return 404 when no enhancement exists', async () => {
      mockKv.get.mockResolvedValue(null)
      
      const req = createMockReq('DELETE', {}, {
        photoId: 'test-photo',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: 'No enhancements found to delete.' })
    })

    it('should remove specific tag', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'test-user',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1', 'tag2', 'tag3'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('DELETE', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        tagToRemove: 'tag2'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          accepted_ai_tags: ['tag1', 'tag3'],
          updated_at: expect.any(String),
        })
      )
      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should clear description when clearDescription is true', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'test-user',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      mockKv.set.mockResolvedValue('OK')
      
      const req = createMockReq('DELETE', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        clearDescription: true
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).toHaveBeenCalledWith(
        'photo_enhancement:test-photo',
        expect.objectContaining({
          ai_description: null,
          updated_at: expect.any(String),
        })
      )
    })

    it('should return no changes message when nothing to modify', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'test-user',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      
      const req = createMockReq('DELETE', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        tagToRemove: 'non-existent-tag'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockKv.set).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ 
        message: 'No changes made to enhancements.', 
        enhancement: existingEnhancement 
      })
    })

    it('should handle kv errors during DELETE operation', async () => {
      const existingEnhancement = {
        photo_id: 'test-photo',
        user_id: 'test-user',
        ai_description: 'Test description',
        accepted_ai_tags: ['tag1'],
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }
      
      mockKv.get.mockResolvedValue(existingEnhancement)
      mockKv.set.mockRejectedValue(new Error('KV operation failed'))
      
      const req = createMockReq('DELETE', {}, {
        photoId: 'test-photo',
        userId: 'test-user',
        tagToRemove: 'tag1'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete/clear enhancement.' })
    })
  })

  describe('Unsupported methods', () => {
    it('should return 405 for unsupported methods', async () => {
      const req = createMockReq('PUT', {}, {})
      const res = createMockRes()

      await handler(req, res)

      expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET', 'POST', 'DELETE'])
      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.end).toHaveBeenCalledWith('Method PUT Not Allowed')
    })
  })
})