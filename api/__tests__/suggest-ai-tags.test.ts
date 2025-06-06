// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import https from 'https'

// Mock all external dependencies before imports
vi.mock('https')

// Mock the JSON file import
vi.mock('../companycam-standard-tags.json', () => ({
  default: ['roofing', 'hvac', 'plumbing', 'electrical', 'siding']
}))

// Mock OpenAI - create the mock objects inside the factory function
vi.mock('openai', () => {
  const mockOpenAIInstance = {
    embeddings: {
      create: vi.fn(),
    },
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }
  
  return {
    default: vi.fn(() => mockOpenAIInstance)
  }
})

// Mock Pinecone - create the mock objects inside the factory function
vi.mock('@pinecone-database/pinecone', () => {
  const mockPineconeIndex = {
    query: vi.fn(),
  }

  const mockPineconeInstance = {
    index: vi.fn().mockReturnValue(mockPineconeIndex),
  }

  return {
    Pinecone: vi.fn(() => mockPineconeInstance)
  }
})

import handler from '../suggest-ai-tags'
import OpenAI from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'

// Type the mocked modules
const mockOpenAI = vi.mocked(OpenAI)
const mockPinecone = vi.mocked(Pinecone)
const mockHttps = vi.mocked(https)

// Get references to the mocked instances for easier access
let mockOpenAIInstance: any
let mockPineconeInstance: any
let mockPineconeIndex: any

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

// Mock https.request for Google Vision API
function mockHttpsRequest(responseData: any, statusCode: number = 200) {
  const mockRequest = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  }

  const mockResponse = {
    statusCode,
    on: vi.fn(),
  }

  // Set up the response data flow
  mockResponse.on.mockImplementation((event: string, callback: Function) => {
    if (event === 'data') {
      callback(JSON.stringify(responseData))
    } else if (event === 'end') {
      callback()
    }
  })

  mockRequest.on.mockImplementation((event: string, callback: Function) => {
    if (event === 'error') {
      // Don't call error callback unless we want to simulate an error
    }
    return mockRequest
  })

  mockHttps.request.mockImplementation((options: any, callback: Function) => {
    callback(mockResponse)
    return mockRequest
  })

  return { mockRequest, mockResponse }
}

describe('/api/suggest-ai-tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    process.env.COMPANYCAM_API_KEY = 'test-companycam-key'
    process.env.GOOGLE_CLOUD_VISION_API_KEY = 'test-google-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.PINECONE_API_KEY = 'test-pinecone-key'
    process.env.PINECONE_ENVIRONMENT = 'test-env'
    process.env.PINECONE_INDEX_NAME = 'test-index'

    // Get fresh mock instances for each test
    mockOpenAIInstance = new OpenAI({ apiKey: 'test' })
    mockPineconeInstance = new Pinecone()
    mockPineconeIndex = mockPineconeInstance.index('test')
  })

  afterEach(() => {
    vi.resetAllMocks()
    delete process.env.COMPANYCAM_API_KEY
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.PINECONE_API_KEY
    delete process.env.PINECONE_ENVIRONMENT
    delete process.env.PINECONE_INDEX_NAME
  })

  describe('Request validation', () => {
    it('should handle OPTIONS requests for CORS', async () => {
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
      const req = createMockReq('GET')
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' })
    })

    it('should return 500 when CompanyCam API key is missing', async () => {
      delete process.env.COMPANYCAM_API_KEY
      delete process.env.VITE_APP_COMPANYCAM_API_KEY

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

  describe('Google Vision API integration', () => {
    it('should successfully call Google Vision API', async () => {
      const mockVisionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Building', score: 0.9 },
            { description: 'Roof', score: 0.8 }
          ],
          webDetection: {
            webEntities: [
              { description: 'Construction', score: 0.7 }
            ]
          }
        }]
      }

      mockHttpsRequest(mockVisionResponse)

      // Mock OpenAI embeddings
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      // Mock Pinecone query
      mockPineconeIndex.query.mockResolvedValue({
        matches: []
      })

      // Mock OpenAI chat completion
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['building', 'roof'],
              suggested_description: 'Construction site with visible roofing work.',
              checklist_triggers: []
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockHttps.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'vision.googleapis.com',
          path: expect.stringContaining('/v1/images:annotate'),
          method: 'POST'
        }),
        expect.any(Function)
      )

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: ['building', 'roof'],
          suggestedDescription: 'Construction site with visible roofing work.'
        })
      )
    })

    it('should handle Google Vision API errors', async () => {
      const mockRequest = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        destroy: vi.fn(),
      }

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          callback(new Error('Network error'))
        }
        return mockRequest
      })

      mockHttps.request.mockImplementation((options: any, callback: Function) => {
        return mockRequest
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get AI suggestions',
        details: expect.stringContaining('Network error')
      })
    })

    it('should handle Google Vision API error responses', async () => {
      const mockErrorResponse = {
        responses: [{
          error: {
            code: 400,
            message: 'Invalid image'
          }
        }]
      }

      mockHttpsRequest(mockErrorResponse)

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get AI suggestions',
        details: 'Vision API Error: Invalid image (Code: 400)'
      })
    })
  })

  describe('OpenAI integration', () => {
    beforeEach(() => {
      // Set up successful Google Vision response
      const mockVisionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Building', score: 0.9 }
          ],
          webDetection: {
            webEntities: [
              { description: 'Construction', score: 0.7 }
            ]
          }
        }]
      }
      mockHttpsRequest(mockVisionResponse)
    })

    it('should generate embeddings successfully', async () => {
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['building'],
              suggested_description: 'Building under construction.'
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: expect.stringContaining('Building')
      })

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle OpenAI embeddings API errors', async () => {
      mockOpenAIInstance.embeddings.create.mockRejectedValue(
        new Error('OpenAI API key invalid')
      )

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get AI suggestions',
        details: expect.stringContaining('OpenAI API key invalid')
      })
    })

    it('should handle OpenAI chat completion errors', async () => {
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('Rate limit exceeded')
      )

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: [],
          suggestedDescription: 'Error generating AI suggestions.'
        })
      )
    })

    it('should handle invalid JSON from GPT', async () => {
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: [],
          suggestedDescription: 'Error generating AI suggestions.'
        })
      )
    })
  })

  describe('Pinecone vector database integration', () => {
    beforeEach(() => {
      // Set up successful Google Vision response
      const mockVisionResponse = {
        responses: [{
          labelAnnotations: [{ description: 'Building', score: 0.9 }],
          webDetection: { webEntities: [{ description: 'Construction', score: 0.7 }] }
        }]
      }
      mockHttpsRequest(mockVisionResponse)

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    })

    it('should query Pinecone successfully with matches', async () => {
      mockPineconeIndex.query.mockResolvedValue({
        matches: [
          {
            id: 'match1',
            score: 0.9,
            metadata: { text: 'Similar roofing project completion' }
          },
          {
            id: 'match2', 
            score: 0.8,
            metadata: { text: 'HVAC installation progress photo' }
          }
        ]
      })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['roofing', 'progress'],
              suggested_description: 'Roofing work in progress.'
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(mockPineconeIndex.query).toHaveBeenCalledWith({
        vector: expect.any(Array),
        topK: 5,
        includeMetadata: true
      })

      expect(res.status).toHaveBeenCalledWith(200)
    })

    it('should handle Pinecone configuration errors', async () => {
      delete process.env.PINECONE_API_KEY

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['building'],
              suggested_description: 'Building construction.'
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      // Should continue without Pinecone and still return results
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: ['building'],
          suggestedDescription: 'Building construction.'
        })
      )
    })

    it('should handle Pinecone query errors gracefully', async () => {
      mockPineconeIndex.query.mockRejectedValue(new Error('Pinecone connection failed'))

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['building'],
              suggested_description: 'Building construction.'
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      // Should continue despite Pinecone error
      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('Complete AI pipeline', () => {
    it('should execute full pipeline successfully', async () => {
      // Mock Google Vision
      const mockVisionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Roof', score: 0.95 },
            { description: 'Building', score: 0.9 }
          ],
          webDetection: {
            webEntities: [
              { description: 'Construction site', score: 0.8 }
            ]
          }
        }]
      }
      mockHttpsRequest(mockVisionResponse)

      // Mock OpenAI embeddings
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      // Mock Pinecone with relevant matches
      mockPineconeIndex.query.mockResolvedValue({
        matches: [
          {
            id: 'similar1',
            score: 0.92,
            metadata: { text: 'Completed roofing installation on residential home' }
          }
        ]
      })

      // Mock successful GPT response
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['roofing', 'installation', 'progress'],
              suggested_description: 'Roofing installation work in progress on residential building.',
              checklist_triggers: ['safety_inspection', 'material_check']
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo-123',
        photoUrl: 'https://example.com/construction-photo.jpg',
        userId: 'contractor-456',
        projectId: 'project-789'
      })
      const res = createMockRes()

      await handler(req, res)

      // Verify all services were called
      expect(mockHttps.request).toHaveBeenCalled() // Google Vision
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalled() // OpenAI embeddings
      expect(mockPineconeIndex.query).toHaveBeenCalled() // Pinecone query
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalled() // GPT completion

      // Verify successful response
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        suggestedTags: ['roofing', 'installation', 'progress'],
        suggestedDescription: 'Roofing installation work in progress on residential building.',
        checklistTriggers: ['safety_inspection', 'material_check'],
        debugInfo: expect.objectContaining({
          gptModel: 'gpt-4o',
          rawGptResponse: expect.any(String)
        })
      })
    })

    it('should filter out existing tags from suggestions', async () => {
      // Mock Vision response with tags that might already exist
      const mockVisionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Roof', score: 0.9 },
            { description: 'Building', score: 0.8 }
          ]
        }]
      }
      mockHttpsRequest(mockVisionResponse)

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      // GPT suggests tags, some of which might already exist on the photo
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['roofing', 'building', 'new-tag'],
              suggested_description: 'Building with roofing work.'
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: expect.arrayContaining(['roofing', 'building', 'new-tag']),
          suggestedDescription: 'Building with roofing work.'
        })
      )
    })
  })
})