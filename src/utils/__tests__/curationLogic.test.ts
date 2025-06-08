// © 2025 Mark Hustad — MIT License

import { describe, it, expect } from 'vitest';
import {
  generateCurationRecommendation,
  selectBestPhotos,
  generateScoutAiMessage,
  calculateTimeSavings
} from '../curationLogic';
import type { Photo } from '../../types';
import type { PhotoSimilarityGroup, CurationRecommendation, CamIntellectSuggestion } from '../../types/camintellect';

// Mock photo data for testing
const mockPhotos: Photo[] = [
  {
    id: 'photo-1',
    project_id: 'project-1',
    creator_id: 'user-1',
    creator_name: 'John Doe',
    company_id: 'company-1',
    uri: 'https://example.com/photo1.jpg',
    captured_at: '2025-01-01T10:00:00Z',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    description: 'Roofing progress - detailed view of shingles',
    tags: ['roofing', 'progress', 'shingles']
  },
  {
    id: 'photo-2',
    project_id: 'project-1',
    creator_id: 'user-1',
    creator_name: 'John Doe',
    company_id: 'company-1',
    uri: 'https://example.com/photo2.jpg',
    captured_at: '2025-01-01T10:02:00Z',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    description: 'Roofing progress',
    tags: ['roofing', 'progress']
  },
  {
    id: 'photo-3',
    project_id: 'project-1',
    creator_id: 'user-1',
    creator_name: 'John Doe',
    company_id: 'company-1',
    uri: 'https://example.com/photo3.jpg',
    captured_at: '2025-01-01T10:03:00Z',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    description: 'Roofing progress - blurry',
    tags: ['roofing']
  }
];

const mockSimilarityGroup: PhotoSimilarityGroup = {
  id: 'group-1',
  photos: mockPhotos,
  similarity: {
    visualSimilarity: 0.8,
    contentSimilarity: 0.9,
    temporalProximity: 0.95,
    spatialProximity: 0.98,
    semanticSimilarity: 0.7,
    overallSimilarity: 0.85
  },
  groupType: 'retry_shots',
  confidence: 0.9
};

describe('curationLogic utilities', () => {
  describe('selectBestPhotos', () => {
    it('should select photos with highest quality scores', () => {
      const selected = selectBestPhotos(mockPhotos, 2);
      
      expect(selected).toHaveLength(2);
      expect(selected).toBeInstanceOf(Array);
      
      // Should include the photo with the most detailed description
      const hasDetailedPhoto = selected.some(photo => photo.description?.includes('detailed view'));
      expect(hasDetailedPhoto).toBe(true);
    });

    it('should handle edge case of requesting more photos than available', () => {
      const selected = selectBestPhotos(mockPhotos, 10);
      expect(selected).toHaveLength(mockPhotos.length);
    });

    it('should handle empty photo array', () => {
      const selected = selectBestPhotos([], 2);
      expect(selected).toHaveLength(0);
    });

    it('should prefer photos with more information content', () => {
      const photoWithManyTags = {
        ...mockPhotos[0],
        id: 'detailed-photo',
        description: 'Comprehensive roofing progress showing completed shingles, proper flashing, and gutter installation',
        tags: ['roofing', 'progress', 'shingles', 'flashing', 'gutters', 'completed']
      };
      
      const photosToTest = [mockPhotos[1], photoWithManyTags, mockPhotos[2]];
      const selected = selectBestPhotos(photosToTest, 1);
      
      expect(selected[0].id).toBe('detailed-photo');
    });
  });

  describe('generateCurationRecommendation', () => {
    it('should generate recommendation with proper structure', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      
      expect(recommendation).toHaveProperty('group');
      expect(recommendation).toHaveProperty('keep');
      expect(recommendation).toHaveProperty('archive');
      expect(recommendation).toHaveProperty('rationale');
      expect(recommendation).toHaveProperty('estimatedTimeSaved');
      expect(recommendation).toHaveProperty('confidence');
      
      expect(recommendation.keep).toBeInstanceOf(Array);
      expect(recommendation.archive).toBeInstanceOf(Array);
      expect(typeof recommendation.rationale).toBe('string');
      expect(typeof recommendation.estimatedTimeSaved).toBe('number');
      expect(typeof recommendation.confidence).toBe('number');
    });

    it('should recommend keeping fewer photos than total', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      
      expect(recommendation.keep.length).toBeLessThan(mockSimilarityGroup.photos.length);
      expect(recommendation.keep.length).toBeGreaterThan(0);
    });

    it('should provide meaningful rationale', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      
      expect(recommendation.rationale.length).toBeGreaterThan(20);
      expect(recommendation.rationale).toMatch(/photo|image|shot|documentation/i);
    });

    it('should calculate realistic time savings', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      
      expect(recommendation.estimatedTimeSaved).toBeGreaterThan(0);
      expect(recommendation.estimatedTimeSaved).toBeLessThan(60); // Reasonable upper bound
    });

    it('should maintain all photos across keep and archive arrays', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      
      const totalRecommended = recommendation.keep.length + recommendation.archive.length;
      expect(totalRecommended).toBe(mockSimilarityGroup.photos.length);
      
      // Ensure no duplicate photos
      const allPhotoIds = [
        ...recommendation.keep.map(p => p.id),
        ...recommendation.archive.map(p => p.id)
      ];
      const uniqueIds = new Set(allPhotoIds);
      expect(uniqueIds.size).toBe(allPhotoIds.length);
    });
  });

  describe('generateScoutAiMessage', () => {
    it('should generate conversational message for photo curation', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      const message = generateScoutAiMessage([recommendation]);
      
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(20);
      expect(message).toMatch(/I|noticed|photo|similar/i);
    });

    it('should handle multiple recommendations', () => {
      const recommendation1 = generateCurationRecommendation(mockSimilarityGroup);
      const recommendation2 = generateCurationRecommendation({
        ...mockSimilarityGroup,
        id: 'group-2',
        groupType: 'angle_variations'
      });
      
      const message = generateScoutAiMessage([recommendation1, recommendation2]);
      
      expect(message).toMatch(/\d+.*photo/i); // Should mention number of photos
    });

    it('should adapt message based on group type', () => {
      const retryGroup = { ...mockSimilarityGroup, groupType: 'retry_shots' as const };
      const progressGroup = { ...mockSimilarityGroup, groupType: 'incremental_progress' as const };
      
      const retryRecommendation = generateCurationRecommendation(retryGroup);
      const progressRecommendation = generateCurationRecommendation(progressGroup);
      
      const retryMessage = generateScoutAiMessage([retryRecommendation]);
      const progressMessage = generateScoutAiMessage([progressRecommendation]);
      
      expect(retryMessage).not.toBe(progressMessage);
    });

    it('should be encouraging and helpful in tone', () => {
      const recommendation = generateCurationRecommendation(mockSimilarityGroup);
      const message = generateScoutAiMessage([recommendation]);
      
      // Should contain helpful/encouraging words
      const encouragingWords = ['help', 'recommend', 'suggest', 'best', 'better', 'optimize', 'improve'];
      const hasEncouragingTone = encouragingWords.some(word => 
        message.toLowerCase().includes(word)
      );
      expect(hasEncouragingTone).toBe(true);
    });
  });

  describe('calculateTimeSavings', () => {
    it('should calculate time savings based on photo count reduction', () => {
      const timeSaved = calculateTimeSavings(mockPhotos.length, 1);
      
      expect(timeSaved).toBeGreaterThan(0);
      expect(typeof timeSaved).toBe('number');
    });

    it('should return higher savings for larger reductions', () => {
      const smallReduction = calculateTimeSavings(5, 4);
      const largeReduction = calculateTimeSavings(10, 2);
      
      expect(largeReduction).toBeGreaterThan(smallReduction);
    });

    it('should return zero when no photos are removed', () => {
      const timeSaved = calculateTimeSavings(5, 5);
      expect(timeSaved).toBe(0);
    });

    it('should handle edge cases gracefully', () => {
      expect(calculateTimeSavings(0, 0)).toBe(0);
      expect(calculateTimeSavings(1, 0)).toBeGreaterThan(0);
      expect(calculateTimeSavings(3, 5)).toBe(0); // Can't keep more than you have
    });
  });
});