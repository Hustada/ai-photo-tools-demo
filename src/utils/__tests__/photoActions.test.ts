// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Photo, PhotoAction, CurationActionResult } from '../../types';
import type { CurationRecommendation } from '../../types/camintellect';
import { 
  applyCurationActions, 
  createActionsFromRecommendation,
  archivePhoto,
  restorePhoto,
  filterPhotosByArchiveState
} from '../photoActions';

// Mock photos for testing
const createMockPhoto = (id: string, overrides: Partial<Photo> = {}): Photo => ({
  id,
  company_id: 'company-1',
  creator_id: 'user-1',
  creator_type: 'user',
  creator_name: 'John Doe',
  project_id: 'project-1',
  processing_status: 'processed',
  coordinates: [{ latitude: 40.7128, longitude: -74.0060 }],
  uris: [{ type: 'original', uri: `https://example.com/${id}.jpg`, url: `https://example.com/${id}.jpg` }],
  hash: `hash-${id}`,
  description: `Photo ${id}`,
  internal: false,
  photo_url: `https://example.com/${id}.jpg`,
  captured_at: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  archive_state: 'active',
  ...overrides
});

const mockPhotos = [
  createMockPhoto('photo-1'),
  createMockPhoto('photo-2'),
  createMockPhoto('photo-3'),
  createMockPhoto('photo-4')
];

const mockRecommendation: CurationRecommendation = {
  group: {
    id: 'group-1',
    photos: [mockPhotos[0], mockPhotos[1], mockPhotos[2]],
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
  },
  keep: [mockPhotos[0]],
  archive: [mockPhotos[1], mockPhotos[2]],
  rationale: 'Keep the best quality photo and archive similar attempts',
  estimatedTimeSaved: 2,
  confidence: 0.9
};

describe('photoActions', () => {
  describe('createActionsFromRecommendation', () => {
    it('should create correct actions from a curation recommendation', () => {
      const actions = createActionsFromRecommendation(mockRecommendation);
      
      expect(actions).toHaveLength(3);
      
      // Should have one keep action
      const keepActions = actions.filter(a => a.type === 'keep');
      expect(keepActions).toHaveLength(1);
      expect(keepActions[0].photoId).toBe('photo-1');
      expect(keepActions[0].reason).toContain('recommended to keep');
      
      // Should have two archive actions
      const archiveActions = actions.filter(a => a.type === 'archive');
      expect(archiveActions).toHaveLength(2);
      expect(archiveActions.map(a => a.photoId)).toEqual(['photo-2', 'photo-3']);
      expect(archiveActions[0].reason).toContain('similar to kept photo');
    });

    it('should include group metadata in actions', () => {
      const actions = createActionsFromRecommendation(mockRecommendation);
      
      actions.forEach(action => {
        expect(action.metadata).toEqual({
          groupId: 'group-1',
          groupType: 'retry_shots',
          confidence: 0.9,
          rationale: mockRecommendation.rationale
        });
      });
    });
  });

  describe('applyCurationActions', () => {
    let mockPhotoUpdateCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockPhotoUpdateCallback = vi.fn();
    });

    it('should successfully apply archive and keep actions', async () => {
      const actions: PhotoAction[] = [
        { type: 'keep', photoId: 'photo-1', reason: 'Best quality' },
        { type: 'archive', photoId: 'photo-2', reason: 'Duplicate' }
      ];

      const result = await applyCurationActions(actions, mockPhotos, mockPhotoUpdateCallback);

      expect(result.success).toBe(true);
      expect(result.appliedActions).toHaveLength(2);
      expect(result.failedActions).toHaveLength(0);
      expect(result.updatedPhotos).toHaveLength(2);

      // Check that photos were updated correctly
      const archivedPhoto = result.updatedPhotos.find(p => p.id === 'photo-2');
      expect(archivedPhoto?.archive_state).toBe('archived');
      expect(archivedPhoto?.archive_reason).toBe('Duplicate');
      expect(archivedPhoto?.archived_at).toBeTypeOf('number');

      const keptPhoto = result.updatedPhotos.find(p => p.id === 'photo-1');
      expect(keptPhoto?.archive_state).toBe('active');

      // Check that callback was called for each updated photo
      expect(mockPhotoUpdateCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle missing photos gracefully', async () => {
      const actions: PhotoAction[] = [
        { type: 'archive', photoId: 'nonexistent-photo', reason: 'Test' },
        { type: 'keep', photoId: 'photo-1', reason: 'Keep this one' }
      ];

      const result = await applyCurationActions(actions, mockPhotos, mockPhotoUpdateCallback);

      expect(result.success).toBe(false);
      expect(result.appliedActions).toHaveLength(1); // Only photo-1 succeeded
      expect(result.failedActions).toHaveLength(1); // nonexistent-photo failed
      expect(result.failedActions[0].photoId).toBe('nonexistent-photo');
      expect(result.error).toContain('Some actions failed');
    });

    it('should handle empty actions array', async () => {
      const result = await applyCurationActions([], mockPhotos, mockPhotoUpdateCallback);

      expect(result.success).toBe(true);
      expect(result.appliedActions).toHaveLength(0);
      expect(result.failedActions).toHaveLength(0);
      expect(result.updatedPhotos).toHaveLength(0);
      expect(mockPhotoUpdateCallback).not.toHaveBeenCalled();
    });
  });

  describe('archivePhoto', () => {
    let mockPhotoUpdateCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockPhotoUpdateCallback = vi.fn();
    });

    it('should archive a photo with the given reason', async () => {
      await archivePhoto('photo-1', 'Duplicate content', mockPhotos, mockPhotoUpdateCallback);

      expect(mockPhotoUpdateCallback).toHaveBeenCalledTimes(1);
      const updatedPhoto = mockPhotoUpdateCallback.mock.calls[0][0];
      
      expect(updatedPhoto.id).toBe('photo-1');
      expect(updatedPhoto.archive_state).toBe('archived');
      expect(updatedPhoto.archive_reason).toBe('Duplicate content');
      expect(updatedPhoto.archived_at).toBeTypeOf('number');
    });

    it('should throw error for nonexistent photo', async () => {
      await expect(
        archivePhoto('nonexistent', 'Test', mockPhotos, mockPhotoUpdateCallback)
      ).rejects.toThrow('Photo not found: nonexistent');

      expect(mockPhotoUpdateCallback).not.toHaveBeenCalled();
    });
  });

  describe('restorePhoto', () => {
    let mockPhotoUpdateCallback: ReturnType<typeof vi.fn>;
    let archivedPhotos: Photo[];

    beforeEach(() => {
      mockPhotoUpdateCallback = vi.fn();
      archivedPhotos = [
        createMockPhoto('photo-1', { 
          archive_state: 'archived', 
          archived_at: Date.now(), 
          archive_reason: 'Test archive' 
        })
      ];
    });

    it('should restore an archived photo', async () => {
      await restorePhoto('photo-1', archivedPhotos, mockPhotoUpdateCallback);

      expect(mockPhotoUpdateCallback).toHaveBeenCalledTimes(1);
      const updatedPhoto = mockPhotoUpdateCallback.mock.calls[0][0];
      
      expect(updatedPhoto.id).toBe('photo-1');
      expect(updatedPhoto.archive_state).toBe('active');
      expect(updatedPhoto.archived_at).toBeUndefined();
      expect(updatedPhoto.archive_reason).toBeUndefined();
    });

    it('should throw error for nonexistent photo', async () => {
      await expect(
        restorePhoto('nonexistent', archivedPhotos, mockPhotoUpdateCallback)
      ).rejects.toThrow('Photo not found: nonexistent');

      expect(mockPhotoUpdateCallback).not.toHaveBeenCalled();
    });
  });

  describe('filterPhotosByArchiveState', () => {
    const mixedPhotos = [
      createMockPhoto('active-1', { archive_state: 'active' }),
      createMockPhoto('archived-1', { archive_state: 'archived', archived_at: Date.now() }),
      createMockPhoto('pending-1', { archive_state: 'pending_deletion' }),
      createMockPhoto('active-2', { archive_state: 'active' }),
      createMockPhoto('archived-2', { archive_state: 'archived', archived_at: Date.now() })
    ];

    it('should filter active photos', () => {
      const activePhotos = filterPhotosByArchiveState(mixedPhotos, 'active');
      
      expect(activePhotos).toHaveLength(2);
      expect(activePhotos.map(p => p.id)).toEqual(['active-1', 'active-2']);
    });

    it('should filter archived photos', () => {
      const archivedPhotos = filterPhotosByArchiveState(mixedPhotos, 'archived');
      
      expect(archivedPhotos).toHaveLength(2);
      expect(archivedPhotos.map(p => p.id)).toEqual(['archived-1', 'archived-2']);
    });

    it('should filter pending deletion photos', () => {
      const pendingPhotos = filterPhotosByArchiveState(mixedPhotos, 'pending_deletion');
      
      expect(pendingPhotos).toHaveLength(1);
      expect(pendingPhotos[0].id).toBe('pending-1');
    });

    it('should return empty array for no matches', () => {
      const activeOnlyPhotos = [createMockPhoto('active-1', { archive_state: 'active' })];
      const archivedResults = filterPhotosByArchiveState(activeOnlyPhotos, 'archived');
      
      expect(archivedResults).toHaveLength(0);
    });

    it('should handle photos without archive_state (default to active)', () => {
      const noArchiveStatePhotos = [
        createMockPhoto('photo-1'),  // No archive_state field
        createMockPhoto('photo-2', { archive_state: 'active' })
      ];
      
      const activePhotos = filterPhotosByArchiveState(noArchiveStatePhotos, 'active');
      expect(activePhotos).toHaveLength(2);
    });
  });
});