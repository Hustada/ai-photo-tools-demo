// © 2025 Mark Hustad — MIT License

import { describe, it, expect } from 'vitest';
import {
  calculatePhotoSimilarity,
  calculateTemporalProximity,
  calculateSpatialProximity,
  calculateQualityMetrics,
  groupSimilarPhotos
} from '../photoSimilarity';
import type { Photo } from '../../types';
import type { SimilarityAnalysis, PhotoSimilarityGroup, PhotoQualityMetrics } from '../../types/camintellect';

// Mock photo data for testing
const mockPhoto1: Photo = {
  id: 'photo-1',
  project_id: 'project-1',
  creator_id: 'user-1',
  creator_name: 'John Doe',
  company_id: 'company-1',
  uri: 'https://example.com/photo1.jpg',
  captured_at: '2025-01-01T10:00:00Z',
  coordinates: [{ latitude: 40.7128, longitude: -74.0060 }],
  description: 'Roofing progress photo',
  tags: ['roofing', 'progress']
};

const mockPhoto2: Photo = {
  id: 'photo-2',
  project_id: 'project-1',
  creator_id: 'user-1',
  creator_name: 'John Doe',
  company_id: 'company-1',
  uri: 'https://example.com/photo2.jpg',
  captured_at: '2025-01-01T10:05:00Z', // 5 minutes later
  coordinates: [{ latitude: 40.7129, longitude: -74.0061 }], // Very close location
  description: 'Roofing progress photo - different angle',
  tags: ['roofing', 'progress']
};

const mockPhoto3: Photo = {
  id: 'photo-3',
  project_id: 'project-2',
  creator_id: 'user-2',
  creator_name: 'Jane Smith',
  company_id: 'company-1',
  uri: 'https://example.com/photo3.jpg',
  captured_at: '2025-01-02T14:00:00Z', // Next day
  coordinates: [{ latitude: 40.7500, longitude: -73.9800 }], // Different location
  description: 'HVAC installation',
  tags: ['hvac', 'installation']
};

describe('photoSimilarity utilities', () => {
  describe('calculateTemporalProximity', () => {
    it('should return high score for photos taken within minutes', () => {
      const score = calculateTemporalProximity(mockPhoto1, mockPhoto2);
      expect(score).toBeGreaterThan(0.8); // Very close in time
    });

    it('should return low score for photos taken on different days', () => {
      const score = calculateTemporalProximity(mockPhoto1, mockPhoto3);
      expect(score).toBeLessThan(0.3); // Different days
    });

    it('should return 1.0 for identical timestamps', () => {
      const score = calculateTemporalProximity(mockPhoto1, mockPhoto1);
      expect(score).toBe(1.0);
    });
  });

  describe('calculateSpatialProximity', () => {
    it('should return high score for photos taken at very close locations', () => {
      const score = calculateSpatialProximity(mockPhoto1, mockPhoto2);
      expect(score).toBeGreaterThan(0.9); // Very close coordinates
    });

    it('should return low score for photos taken at distant locations', () => {
      const score = calculateSpatialProximity(mockPhoto1, mockPhoto3);
      expect(score).toBeLessThan(0.5); // Different neighborhoods
    });

    it('should return 1.0 for identical coordinates', () => {
      const score = calculateSpatialProximity(mockPhoto1, mockPhoto1);
      expect(score).toBe(1.0);
    });

    it('should handle missing coordinates gracefully', () => {
      const photoWithoutCoords = { ...mockPhoto1, coordinates: [] };
      const score = calculateSpatialProximity(photoWithoutCoords, mockPhoto2);
      expect(score).toBe(0.0); // No spatial data available
    });
  });

  describe('calculateQualityMetrics', () => {
    it('should return quality metrics object with proper structure', () => {
      const metrics = calculateQualityMetrics(mockPhoto1);
      
      expect(metrics).toHaveProperty('sharpness');
      expect(metrics).toHaveProperty('lighting');
      expect(metrics).toHaveProperty('composition');
      expect(metrics).toHaveProperty('informationContent');
      expect(metrics).toHaveProperty('documentationValue');
      
      // All metrics should be between 0 and 1
      Object.values(metrics).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should assign higher documentation value to photos with more descriptive content', () => {
      const detailedPhoto = {
        ...mockPhoto1,
        description: 'Detailed roofing progress showing completed shingles on north side, proper flashing installation, and gutters attached',
        tags: ['roofing', 'progress', 'shingles', 'flashing', 'gutters', 'north-side']
      };
      
      const basicPhoto = {
        ...mockPhoto1,
        description: 'Photo',
        tags: ['misc']
      };
      
      const detailedMetrics = calculateQualityMetrics(detailedPhoto);
      const basicMetrics = calculateQualityMetrics(basicPhoto);
      
      expect(detailedMetrics.informationContent).toBeGreaterThan(basicMetrics.informationContent);
    });
  });

  describe('calculatePhotoSimilarity', () => {
    it('should return similarity analysis with all required properties', () => {
      const similarity = calculatePhotoSimilarity(mockPhoto1, mockPhoto2);
      
      expect(similarity).toHaveProperty('visualSimilarity');
      expect(similarity).toHaveProperty('contentSimilarity');
      expect(similarity).toHaveProperty('temporalProximity');
      expect(similarity).toHaveProperty('spatialProximity');
      expect(similarity).toHaveProperty('semanticSimilarity');
      expect(similarity).toHaveProperty('overallSimilarity');
      
      // All similarity scores should be between 0 and 1
      Object.values(similarity).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should return high overall similarity for similar photos', () => {
      const similarity = calculatePhotoSimilarity(mockPhoto1, mockPhoto2);
      expect(similarity.overallSimilarity).toBeGreaterThan(0.6); // Same project, similar time/location
    });

    it('should return low overall similarity for dissimilar photos', () => {
      const similarity = calculatePhotoSimilarity(mockPhoto1, mockPhoto3);
      expect(similarity.overallSimilarity).toBeLessThan(0.4); // Different project, time, location
    });

    it('should return perfect similarity for identical photos', () => {
      const similarity = calculatePhotoSimilarity(mockPhoto1, mockPhoto1);
      expect(similarity.overallSimilarity).toBe(1.0);
    });
  });

  describe('groupSimilarPhotos', () => {
    it('should group similar photos together', () => {
      const photos = [mockPhoto1, mockPhoto2, mockPhoto3];
      const groups = groupSimilarPhotos(photos, 0.6); // 60% similarity threshold
      
      expect(groups).toBeInstanceOf(Array);
      expect(groups.length).toBeGreaterThan(0);
      
      // Should have at least one group (photo1 and photo2 should be grouped)
      const similarGroup = groups.find(group => 
        group.photos.some(p => p.id === 'photo-1') && 
        group.photos.some(p => p.id === 'photo-2')
      );
      expect(similarGroup).toBeDefined();
    });

    it('should not group dissimilar photos', () => {
      const photos = [mockPhoto1, mockPhoto3]; // Very different photos
      const groups = groupSimilarPhotos(photos, 0.8); // High similarity threshold
      
      // Should create separate groups or no groups
      expect(groups.length).toBeLessThanOrEqual(2);
      
      // If groups exist, they should not contain both photos
      groups.forEach(group => {
        const hasPhoto1 = group.photos.some(p => p.id === 'photo-1');
        const hasPhoto3 = group.photos.some(p => p.id === 'photo-3');
        expect(hasPhoto1 && hasPhoto3).toBe(false);
      });
    });

    it('should respect similarity threshold', () => {
      const photos = [mockPhoto1, mockPhoto2];
      
      const strictGroups = groupSimilarPhotos(photos, 0.95); // Very strict
      const lenientGroups = groupSimilarPhotos(photos, 0.3); // Very lenient
      
      expect(lenientGroups.length).toBeGreaterThanOrEqual(strictGroups.length);
    });

    it('should assign appropriate group types', () => {
      const photos = [mockPhoto1, mockPhoto2]; // Same project, close time/location
      const groups = groupSimilarPhotos(photos, 0.6);
      
      if (groups.length > 0) {
        const groupTypes = ['incremental_progress', 'angle_variations', 'retry_shots', 'redundant_documentation'];
        expect(groupTypes).toContain(groups[0].groupType);
      }
    });

    it('should include confidence scores', () => {
      const photos = [mockPhoto1, mockPhoto2];
      const groups = groupSimilarPhotos(photos, 0.6);
      
      groups.forEach(group => {
        expect(group.confidence).toBeGreaterThanOrEqual(0);
        expect(group.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});