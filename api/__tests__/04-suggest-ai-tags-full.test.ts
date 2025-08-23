// © 2025 Mark Hustad — MIT License
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import https from 'https'

// Mock external dependencies with proper structure
const mockHttpsRequest = vi.fn()
const mockHttpsResponse = {
  statusCode: 200,
  on: vi.fn(),
}

vi.mock('https', () => ({
  default: {
    request: mockHttpsRequest,
  }
}))

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

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAIInstance)
}))

const mockPineconeIndex = {
  query: vi.fn(),
}

const mockPineconeInstance = {
  index: vi.fn(() => mockPineconeIndex),
}

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn(() => mockPineconeInstance)
}))

vi.mock('../companycam-standard-tags.json', () => ({
  default: ['roofing', 'hvac', 'plumbing', 'electrical', 'siding']
}))

// Helper functions
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
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as VercelResponse
}

// Mock https request helper
function setupMockHttpsRequest(responseData: any, statusCode: number = 200) {
  const mockRequest = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  }

  mockHttpsResponse.statusCode = statusCode
  mockHttpsResponse.on.mockImplementation((event: string, callback: Function) => {
    if (event === 'data') {
      callback(JSON.stringify(responseData))
    } else if (event === 'end') {
      callback()
    }
  })

  mockRequest.on.mockImplementation((event: string, callback: Function) => {
    // Don't call error callback unless we want to simulate an error
    return mockRequest
  })

  mockHttpsRequest.mockImplementation((options: any, callback: Function) => {
    callback(mockHttpsResponse)
    return mockRequest
  })

  return mockRequest
}

describe('/api/suggest-ai-tags - Full AI Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up environment variables
    process.env.COMPANYCAM_API_KEY = 'test-companycam-key'
    process.env.GOOGLE_CLOUD_VISION_API_KEY = 'test-google-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.PINECONE_API_KEY = 'test-pinecone-key'
    process.env.PINECONE_ENVIRONMENT = 'test-env'
    process.env.PINECONE_INDEX_NAME = 'test-index'
  })

  afterEach(() => {
    vi.resetAllMocks()
    // Clean up environment variables
    delete process.env.COMPANYCAM_API_KEY
    delete process.env.GOOGLE_CLOUD_VISION_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.PINECONE_API_KEY
    delete process.env.PINECONE_ENVIRONMENT
    delete process.env.PINECONE_INDEX_NAME
  })

  describe('Google Vision API Integration', () => {
    it('should successfully process Google Vision response', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      // Mock Google Vision API response
      const visionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Roof', score: 0.95 },
            { description: 'Building', score: 0.9 }
          ],
          webDetection: {
            webEntities: [
              { description: 'Construction', score: 0.8 }
            ]
          }
        }]
      }

      setupMockHttpsRequest(visionResponse)

      // Mock OpenAI responses
      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['roofing', 'building'],
              suggested_description: 'Roofing work on building structure.'
            })
          }
        }]
      })

      // Mock Pinecone response
      mockPineconeIndex.query.mockResolvedValue({
        matches: []
      })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      // Verify Google Vision was called
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'vision.googleapis.com',
          method: 'POST'
        }),
        expect.any(Function)
      )

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: ['roofing', 'building'],
          suggestedDescription: 'Roofing work on building structure.'
        })
      )
    })

    it('should handle Google Vision API errors', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      // Mock network error
      const mockRequest = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
      }

      mockRequest.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          callback(new Error('Network timeout'))
        }
        return mockRequest
      })

      mockHttpsRequest.mockImplementation(() => mockRequest)

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
        details: expect.stringContaining('Network timeout')
      })
    })

    it('should handle Google Vision error responses', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      const errorResponse = {
        responses: [{
          error: {
            code: 400,
            message: 'Invalid image format'
          }
        }]
      }

      setupMockHttpsRequest(errorResponse)

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/invalid.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to get AI suggestions',
        details: 'Vision API Error: Invalid image format (Code: 400)'
      })
    })
  })

  describe('OpenAI Integration', () => {
    beforeEach(() => {
      // Set up successful Google Vision response for these tests
      const visionResponse = {
        responses: [{
          labelAnnotations: [{ description: 'Building', score: 0.9 }]
        }]
      }
      setupMockHttpsRequest(visionResponse)
    })

    it('should generate embeddings and call GPT successfully', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['construction', 'building'],
              suggested_description: 'Construction site building work.',
              checklist_triggers: ['safety_check']
            })
          }
        }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      // Verify OpenAI calls
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: expect.stringContaining('Building')
      })

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.any(Array),
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: ['construction', 'building'],
          suggestedDescription: 'Construction site building work.',
          checklistTriggers: ['safety_check']
        })
      )
    })

    it('should handle OpenAI embeddings errors', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      mockOpenAIInstance.embeddings.create.mockRejectedValue(
        new Error('OpenAI API quota exceeded')
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
        details: expect.stringContaining('OpenAI API quota exceeded')
      })
    })

    it('should handle GPT response errors gracefully', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('Model overloaded')
      )

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

      const req = createMockReq('POST', {
        photoId: 'test-photo',
        photoUrl: 'https://example.com/photo.jpg',
        userId: 'test-user'
      })
      const res = createMockRes()

      await handler(req, res)

      // Should return fallback response instead of 500 error
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedTags: [],
          suggestedDescription: 'Error generating AI suggestions.'
        })
      )
    })

    it('should handle invalid JSON from GPT', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'This is not valid JSON!'
          }
        }]
      })

      mockPineconeIndex.query.mockResolvedValue({ matches: [] })

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

  // Pinecone tests removed - Pinecone is disabled in the implementation

  describe('Complete AI Pipeline', () => {
    it('should execute full pipeline with all services', async () => {
      const { default: handler } = await import('../suggest-ai-tags')

      // Mock all service responses
      const visionResponse = {
        responses: [{
          labelAnnotations: [
            { description: 'Roof', score: 0.95 },
            { description: 'Shingles', score: 0.9 },
            { description: 'Ladder', score: 0.85 }
          ],
          webDetection: {
            webEntities: [
              { description: 'Roofing contractor', score: 0.9 },
              { description: 'Residential construction', score: 0.8 }
            ]
          }
        }]
      }
      setupMockHttpsRequest(visionResponse)

      mockOpenAIInstance.embeddings.create.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })

      mockPineconeIndex.query.mockResolvedValue({
        matches: [
          {
            id: 'similar-project-1',
            score: 0.92,
            metadata: { text: 'Residential roof replacement with asphalt shingles completed' }
          }
        ]
      })

      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              suggested_tags: ['roofing', 'shingles', 'residential', 'installation'],
              suggested_description: 'Residential roofing installation with asphalt shingles in progress.',
              checklist_triggers: ['safety_harness_check', 'weather_conditions']
            })
          }
        }]
      })

      const req = createMockReq('POST', {
        photoId: 'roof-project-456',
        photoUrl: 'https://example.com/roofing-photo.jpg',
        userId: 'contractor-123',
        projectId: 'residential-roof-789'
      })
      const res = createMockRes()

      await handler(req, res)

      // Verify all services were called (except Pinecone which is disabled)
      expect(mockHttpsRequest).toHaveBeenCalled() // Google Vision
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalled() // OpenAI Embeddings
      // Pinecone is disabled in the implementation, so it won't be called
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalled() // GPT

      // Verify final response
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({
        suggestedTags: ['roofing', 'shingles', 'residential', 'installation'],
        suggestedDescription: 'Residential roofing installation with asphalt shingles in progress.',
        checklistTriggers: ['safety_harness_check', 'weather_conditions'],
        debugInfo: expect.objectContaining({
          gptModel: 'gpt-4o',
          rawGptResponse: expect.any(String)
        })
      })
    })
  })
})