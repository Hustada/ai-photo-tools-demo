// © 2025 Mark Hustad — MIT License
import { describe, it, expect } from 'vitest'
import type { 
  Photo, 
  Tag, 
  CurrentUser, 
  ImageURI,
  Coordinate,
  Project,
  CompanyDetails,
  UserContextType,
  Address,
} from '../types'

describe('Types', () => {
  describe('Photo interface', () => {
    it('should define Photo interface correctly', () => {
      const photo: Photo = {
        id: 'photo-1',
        company_id: 'company-1',
        creator_id: 'user-1',
        creator_type: 'user',
        creator_name: 'John Doe',
        project_id: 'project-1',
        processing_status: 'processed',
        coordinates: [],
        uris: [],
        hash: 'abc123',
        description: 'Test photo',
        internal: false,
        photo_url: 'https://example.com/photo.jpg',
        captured_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        tags: [],
      }

      expect(photo.id).toBe('photo-1')
      expect(photo.company_id).toBe('company-1')
      expect(typeof photo.captured_at).toBe('number')
    })
  })

  describe('Tag interface', () => {
    it('should define Tag interface correctly', () => {
      const tag: Tag = {
        id: 'tag-1',
        company_id: 'company-1',
        display_value: 'Test Tag',
        value: 'test-tag',
        created_at: Date.now(),
        updated_at: Date.now(),
        isAiEnhanced: true,
      }

      expect(tag.id).toBe('tag-1')
      expect(tag.isAiEnhanced).toBe(true)
    })
  })

  describe('CurrentUser interface', () => {
    it('should define CurrentUser interface correctly', () => {
      const user: CurrentUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
      }

      expect(user.id).toBe('user-1')
      expect(user.email).toBe('test@example.com')
    })
  })

  describe('ImageURI interface', () => {
    it('should define ImageURI interface correctly', () => {
      const uri: ImageURI = {
        type: 'web',
        uri: 'https://example.com/photo.jpg',
        url: 'https://example.com/photo.jpg',
      }

      expect(uri.type).toBe('web')
      expect(uri.uri).toBe('https://example.com/photo.jpg')
    })
  })

  describe('Coordinate interface', () => {
    it('should define Coordinate interface correctly', () => {
      const coordinate: Coordinate = {
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: 100,
      }

      expect(coordinate.latitude).toBe(40.7128)
      expect(coordinate.longitude).toBe(-74.0060)
      expect(coordinate.altitude).toBe(100)
    })
  })

  describe('Project interface', () => {
    it('should define Project interface correctly', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        company_id: 'company-1',
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      expect(project.id).toBe('project-1')
      expect(project.name).toBe('Test Project')
    })
  })

  describe('CompanyDetails interface', () => {
    it('should define CompanyDetails interface correctly', () => {
      const company: CompanyDetails = {
        id: 'company-1',
        name: 'Test Company',
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      expect(company.id).toBe('company-1')
      expect(company.name).toBe('Test Company')
    })
  })

  describe('Address interface', () => {
    it('should define Address interface correctly', () => {
      const address: Address = {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      }

      expect(address.street).toBe('123 Main St')
      expect(address.city).toBe('New York')
      expect(address.state).toBe('NY')
      expect(address.zip).toBe('10001')
      expect(address.country).toBe('USA')
    })
  })

  describe('UserContextType interface', () => {
    it('should define UserContextType interface correctly', () => {
      const userContext: UserContextType = {
        currentUser: null,
        companyDetails: null,
        projects: [],
        loading: false,
        error: null,
        fetchUserContext: async () => {},
      }

      expect(userContext.currentUser).toBeNull()
      expect(userContext.companyDetails).toBeNull()
      expect(userContext.projects).toEqual([])
      expect(userContext.loading).toBe(false)
      expect(userContext.error).toBeNull()
      expect(typeof userContext.fetchUserContext).toBe('function')
    })
  })

  describe('Optional properties', () => {
    it('should handle optional properties correctly', () => {
      // Test with minimal required properties
      const minimalPhoto: Photo = {
        id: 'photo-1',
        company_id: 'company-1',
        creator_id: 'user-1',
        creator_type: 'user',
        creator_name: 'John Doe',
        project_id: 'project-1',
        processing_status: 'processed',
        coordinates: [],
        uris: [],
        hash: 'abc123',
        description: null,
        internal: false,
        photo_url: 'https://example.com/photo.jpg',
        captured_at: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
        tags: undefined, // Optional
      }

      expect(minimalPhoto.description).toBeNull()
      expect(minimalPhoto.tags).toBeUndefined()
    })

    it('should handle coordinate with optional altitude', () => {
      const coordinateWithoutAltitude: Coordinate = {
        latitude: 40.7128,
        longitude: -74.0060,
        // altitude is optional
      }

      expect(coordinateWithoutAltitude.latitude).toBe(40.7128)
      expect(coordinateWithoutAltitude.longitude).toBe(-74.0060)
      expect(coordinateWithoutAltitude.altitude).toBeUndefined()
    })
  })
})