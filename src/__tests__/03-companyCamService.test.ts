// © 2025 Mark Hustad — MIT License
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { companyCamService } from '../services/companyCamService'
import type { Photo, Tag, CurrentUser, CompanyDetails, Project } from '../types'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('companyCamService', () => {
  const mockApiKey = 'test-api-key-123'
  const baseUrl = 'https://api.companycam.com/v2'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getPhotos', () => {
    it('should fetch photos with default parameters', async () => {
      const mockPhotos: Photo[] = [
        {
          id: 'photo-1',
          company_id: 'company-1',
          creator_id: 'user-1',
          creator_type: 'user',
          creator_name: 'John Doe',
          project_id: 'project-1',
          processing_status: 'processed',
          coordinates: [],
          uris: [],
          hash: 'hash123',
          description: 'Test photo',
          internal: false,
          photo_url: 'https://example.com/photo1.jpg',
          captured_at: 1640995200000,
          created_at: 1640995200000,
          updated_at: 1640995200000,
        }
      ]

      mockedAxios.get.mockResolvedValue({ data: mockPhotos })

      const result = await companyCamService.getPhotos(mockApiKey)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/photos`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            page: 1,
            per_page: 20,
          },
        }
      )
      expect(result).toEqual(mockPhotos)
    })

    it('should fetch photos with custom parameters', async () => {
      const mockPhotos: Photo[] = []
      mockedAxios.get.mockResolvedValue({ data: mockPhotos })

      await companyCamService.getPhotos(mockApiKey, 2, 50, ['tag1', 'tag2'])

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/photos`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            page: 2,
            per_page: 50,
            tag_ids: ['tag1', 'tag2'],
          },
        }
      )
    })

    it('should handle axios errors', async () => {
      const mockError = new Error('Network error')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(companyCamService.getPhotos(mockApiKey)).rejects.toThrow('Network error')
    })

    it('should handle axios error responses', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        },
        toJSON: () => ({ message: 'Axios error' })
      }
      
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(axiosError)

      await expect(companyCamService.getPhotos(mockApiKey)).rejects.toEqual(axiosError)
    })
  })

  describe('getPhotoTags', () => {
    const photoId = 'test-photo-id'

    it('should fetch photo tags successfully', async () => {
      const mockTags: Tag[] = [
        {
          id: 'tag-1',
          company_id: 'company-1',
          display_value: 'Roofing',
          value: 'roofing',
          created_at: 1640995200000,
          updated_at: 1640995200000,
        }
      ]

      mockedAxios.get.mockResolvedValue({ data: mockTags })

      const result = await companyCamService.getPhotoTags(mockApiKey, photoId)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/photos/${photoId}/tags`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      expect(result).toEqual(mockTags)
    })

    it('should return empty array for 404 errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 404 },
        toJSON: () => ({ message: 'Not found' })
      }
      
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(axiosError)

      const result = await companyCamService.getPhotoTags(mockApiKey, photoId)

      expect(result).toEqual([])
    })

    it('should throw non-404 errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 500 },
        toJSON: () => ({ message: 'Server error' })
      }
      
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(axiosError)

      await expect(companyCamService.getPhotoTags(mockApiKey, photoId)).rejects.toEqual(axiosError)
    })
  })

  describe('listCompanyCamTags', () => {
    it('should fetch all company tags', async () => {
      const mockTags: Tag[] = [
        {
          id: 'tag-1',
          company_id: 'company-1',
          display_value: 'Roofing',
          value: 'roofing',
          created_at: 1640995200000,
          updated_at: 1640995200000,
        },
        {
          id: 'tag-2',
          company_id: 'company-1',
          display_value: 'HVAC',
          value: 'hvac',
          created_at: 1640995200000,
          updated_at: 1640995200000,
        }
      ]

      mockedAxios.get.mockResolvedValue({ data: mockTags })

      const result = await companyCamService.listCompanyCamTags(mockApiKey)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/tags`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      expect(result).toEqual(mockTags)
    })

    it('should handle errors when fetching tags', async () => {
      const mockError = new Error('Failed to fetch tags')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(companyCamService.listCompanyCamTags(mockApiKey)).rejects.toThrow('Failed to fetch tags')
    })
  })

  describe('createCompanyCamTagDefinition', () => {
    it('should create a new tag definition', async () => {
      const displayValue = 'New Tag'
      const mockCreatedTag: Tag = {
        id: 'new-tag-id',
        company_id: 'company-1',
        display_value: displayValue,
        value: 'new tag',
        created_at: 1640995200000,
        updated_at: 1640995200000,
      }

      mockedAxios.post.mockResolvedValue({ data: mockCreatedTag })

      const result = await companyCamService.createCompanyCamTagDefinition(mockApiKey, displayValue)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/tags`,
        { tag: { display_value: displayValue } },
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      expect(result).toEqual(mockCreatedTag)
    })

    it('should handle errors when creating tag definition', async () => {
      const mockError = new Error('Failed to create tag')
      mockedAxios.post.mockRejectedValue(mockError)

      await expect(
        companyCamService.createCompanyCamTagDefinition(mockApiKey, 'Test Tag')
      ).rejects.toThrow('Failed to create tag')
    })
  })

  describe('addTagsToPhoto', () => {
    const photoId = 'test-photo-id'
    const tagIds = ['tag-1', 'tag-2']

    it('should add tags to photo successfully', async () => {
      mockedAxios.post.mockResolvedValue({ status: 204, data: undefined })

      await companyCamService.addTagsToPhoto(mockApiKey, photoId, tagIds)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/photos/${photoId}/tags`,
        { tag_ids: tagIds },
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('should handle empty tag array without making API call', async () => {
      await companyCamService.addTagsToPhoto(mockApiKey, photoId, [])

      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should handle errors when adding tags', async () => {
      const mockError = new Error('Failed to add tags')
      mockedAxios.post.mockRejectedValue(mockError)

      await expect(
        companyCamService.addTagsToPhoto(mockApiKey, photoId, tagIds)
      ).rejects.toThrow('Failed to add tags')
    })
  })

  describe('getCurrentUser', () => {
    it('should fetch current user successfully', async () => {
      const mockUser: CurrentUser = {
        id: 'user-1',
        company_id: 'company-1',
        email_address: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        status: 'active',
      }

      mockedAxios.get.mockResolvedValue({ data: mockUser })

      const result = await companyCamService.getCurrentUser(mockApiKey)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/users/current`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      expect(result).toEqual(mockUser)
    })

    it('should handle errors when fetching current user', async () => {
      const mockError = new Error('User not found')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(companyCamService.getCurrentUser(mockApiKey)).rejects.toThrow('User not found')
    })
  })

  describe('getCompanyDetails', () => {
    const companyId = 'company-1'

    it('should fetch company details successfully', async () => {
      const mockCompany: CompanyDetails = {
        id: companyId,
        name: 'Test Company',
        status: 'active',
        address: {
          street_address_1: '123 Main St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
        },
      }

      mockedAxios.get.mockResolvedValue({ data: mockCompany })

      const result = await companyCamService.getCompanyDetails(mockApiKey, companyId)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/companies/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      expect(result).toEqual(mockCompany)
    })

    it('should handle errors when fetching company details', async () => {
      const mockError = new Error('Company not found')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(
        companyCamService.getCompanyDetails(mockApiKey, companyId)
      ).rejects.toThrow('Company not found')
    })
  })

  describe('getProjects', () => {
    it('should fetch projects with default parameters', async () => {
      const mockProjects: Project[] = [
        {
          id: 'project-1',
          name: 'Test Project',
        }
      ]

      mockedAxios.get.mockResolvedValue({ data: mockProjects })

      const result = await companyCamService.getProjects(mockApiKey)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/projects`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            page: 1,
            per_page: 50,
          },
        }
      )
      expect(result).toEqual(mockProjects)
    })

    it('should fetch projects with custom parameters', async () => {
      const mockProjects: Project[] = []
      mockedAxios.get.mockResolvedValue({ data: mockProjects })

      await companyCamService.getProjects(mockApiKey, 3, 25)

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${baseUrl}/projects`,
        {
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            page: 3,
            per_page: 25,
          },
        }
      )
    })

    it('should handle errors when fetching projects', async () => {
      const mockError = new Error('Projects not accessible')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(companyCamService.getProjects(mockApiKey)).rejects.toThrow('Projects not accessible')
    })

    it('should handle Axios errors when fetching projects', async () => {
      const mockAxiosError = {
        isAxiosError: true,
        toJSON: vi.fn().mockReturnValue({ message: 'Network error', code: 'NETWORK_ERROR' }),
        message: 'Request failed'
      }
      // Mock axios.isAxiosError to return true
      vi.mocked(axios.isAxiosError).mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(mockAxiosError)

      await expect(companyCamService.getProjects(mockApiKey)).rejects.toThrow()
      expect(mockAxiosError.toJSON).toHaveBeenCalled()
    })

    it('should handle unknown errors when fetching projects', async () => {
      const unknownError = { someProperty: 'not an Error object' }
      mockedAxios.get.mockRejectedValue(unknownError)

      await expect(companyCamService.getProjects(mockApiKey)).rejects.toThrow()
    })
  })

  describe('Error Handling Coverage', () => {
    it('should handle Axios errors in listCompanyCamTags', async () => {
      const mockAxiosError = {
        isAxiosError: true,
        toJSON: vi.fn().mockReturnValue({ message: 'Tag fetch error', code: 'TAG_ERROR' }),
        message: 'Request failed'
      }
      // Mock axios.isAxiosError to return true
      vi.mocked(axios.isAxiosError).mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(mockAxiosError)

      await expect(companyCamService.listCompanyCamTags(mockApiKey)).rejects.toThrow()
      expect(mockAxiosError.toJSON).toHaveBeenCalled()
    })

    it('should handle generic errors in listCompanyCamTags', async () => {
      const genericError = new Error('Generic tag error')
      vi.mocked(axios.isAxiosError).mockReturnValue(false)
      mockedAxios.get.mockRejectedValue(genericError)

      await expect(companyCamService.listCompanyCamTags(mockApiKey)).rejects.toThrow('Generic tag error')
    })

    it('should handle unknown errors in listCompanyCamTags', async () => {
      const unknownError = { unknownProp: 'not an Error object' }
      vi.mocked(axios.isAxiosError).mockReturnValue(false)
      mockedAxios.get.mockRejectedValue(unknownError)

      await expect(companyCamService.listCompanyCamTags(mockApiKey)).rejects.toThrow()
    })
  })
})