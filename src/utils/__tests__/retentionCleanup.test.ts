// © 2025 Mark Hustad — MIT License

import { describe, it, expect } from 'vitest';
import {
  processRetentionCleanup,
  calculateDeletionDate,
  getDaysUntilDeletion,
  getRetentionStatus,
} from '../retentionCleanup';
import type { Photo, RetentionPolicy } from '../../types';

const createMockPhoto = (
  id: string,
  archiveState?: 'active' | 'archived' | 'pending_deletion',
  archivedAt?: number
): Photo => ({
  id,
  company_id: 'test-company',
  creator_id: 'test-creator',
  creator_type: 'user',
  creator_name: 'Test Creator',
  project_id: 'test-project',
  processing_status: 'processed',
  coordinates: [],
  uris: [],
  hash: 'test-hash',
  description: 'Test photo',
  internal: false,
  photo_url: 'https://example.com/photo.jpg',
  captured_at: Date.now() - 86400000, // 1 day ago
  created_at: Date.now() - 86400000,
  updated_at: Date.now() - 86400000,
  archive_state: archiveState,
  archived_at: archivedAt,
});

const defaultRetentionPolicy: RetentionPolicy = {
  archiveRetentionDays: 30,
  deletionGraceDays: 7,
  notificationDaysBefore: 3,
  enabled: true,
};

describe('retentionCleanup', () => {
  describe('processRetentionCleanup', () => {
    it('should return empty result when retention policy is disabled', () => {
      const photos = [createMockPhoto('1', 'archived', Date.now() - 40 * 24 * 60 * 60 * 1000)];
      const policy = { ...defaultRetentionPolicy, enabled: false };
      
      const result = processRetentionCleanup(photos, policy, []);
      
      expect(result.photosMarkedForDeletion).toHaveLength(0);
      expect(result.notificationsCreated).toHaveLength(0);
      expect(result.photosScheduledForRemoval).toHaveLength(0);
    });

    it('should mark archived photos for deletion after retention period', () => {
      const now = Date.now();
      const archivedAt = now - 35 * 24 * 60 * 60 * 1000; // 35 days ago
      const photos = [createMockPhoto('1', 'archived', archivedAt)];
      
      const result = processRetentionCleanup(photos, defaultRetentionPolicy, []);
      
      expect(result.photosMarkedForDeletion).toHaveLength(1);
      expect(result.photosMarkedForDeletion[0].archive_state).toBe('pending_deletion');
      expect(result.notificationsCreated).toHaveLength(1);
      expect(result.notificationsCreated[0].type).toBe('deletion_scheduled');
    });

    it('should create warning notifications for photos approaching deletion', () => {
      const now = Date.now();
      const archivedAt = now - 28 * 24 * 60 * 60 * 1000; // 28 days ago (2 days until deletion)
      const photos = [createMockPhoto('1', 'archived', archivedAt)];
      
      const result = processRetentionCleanup(photos, defaultRetentionPolicy, []);
      
      expect(result.photosMarkedForDeletion).toHaveLength(0);
      expect(result.notificationsCreated).toHaveLength(1);
      expect(result.notificationsCreated[0].type).toBe('deletion_warning');
    });

    it('should schedule photos for removal after grace period', () => {
      const now = Date.now();
      const archivedAt = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago (beyond retention + grace)
      const photos = [createMockPhoto('1', 'pending_deletion', archivedAt)];
      
      const result = processRetentionCleanup(photos, defaultRetentionPolicy, []);
      
      expect(result.photosScheduledForRemoval).toHaveLength(1);
      expect(result.photosScheduledForRemoval[0].id).toBe('1');
    });

    it('should not create duplicate warning notifications', () => {
      const now = Date.now();
      const archivedAt = now - 28 * 24 * 60 * 60 * 1000; // 28 days ago
      const photos = [createMockPhoto('1', 'archived', archivedAt)];
      const existingNotifications = [{
        id: 'existing-warning',
        photoId: '1',
        type: 'deletion_warning' as const,
        scheduledDeletionDate: now + 1000,
        createdAt: now - 1000,
        dismissed: false,
      }];
      
      const result = processRetentionCleanup(photos, defaultRetentionPolicy, existingNotifications);
      
      expect(result.notificationsCreated).toHaveLength(0);
    });
  });

  describe('calculateDeletionDate', () => {
    it('should calculate correct deletion date', () => {
      const archivedAt = Date.now();
      const deletionDate = calculateDeletionDate(archivedAt, defaultRetentionPolicy);
      const expectedDate = archivedAt + (30 + 7) * 24 * 60 * 60 * 1000;
      
      expect(deletionDate).toBe(expectedDate);
    });
  });

  describe('getDaysUntilDeletion', () => {
    it('should calculate correct days until deletion', () => {
      const now = Date.now();
      const archivedAt = now - 20 * 24 * 60 * 60 * 1000; // 20 days ago
      const daysUntilDeletion = getDaysUntilDeletion(archivedAt, defaultRetentionPolicy);
      
      expect(daysUntilDeletion).toBe(17); // 37 total days - 20 elapsed = 17 remaining
    });

    it('should return 0 for expired photos', () => {
      const now = Date.now();
      const archivedAt = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago (expired)
      const daysUntilDeletion = getDaysUntilDeletion(archivedAt, defaultRetentionPolicy);
      
      expect(daysUntilDeletion).toBe(0);
    });
  });

  describe('getRetentionStatus', () => {
    it('should return active status for active photos', () => {
      const photo = createMockPhoto('1', 'active');
      const status = getRetentionStatus(photo, defaultRetentionPolicy);
      
      expect(status.status).toBe('active');
      expect(status.daysUntilDeletion).toBeUndefined();
    });

    it('should return archived status with days until deletion', () => {
      const now = Date.now();
      const archivedAt = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const photo = createMockPhoto('1', 'archived', archivedAt);
      const status = getRetentionStatus(photo, defaultRetentionPolicy);
      
      expect(status.status).toBe('archived');
      expect(status.daysUntilDeletion).toBe(27); // 37 total - 10 elapsed = 27 remaining
      expect(status.scheduledDeletionDate).toBeDefined();
    });

    it('should return pending_deletion status', () => {
      const now = Date.now();
      const archivedAt = now - 32 * 24 * 60 * 60 * 1000; // 32 days ago
      const photo = createMockPhoto('1', 'pending_deletion', archivedAt);
      const status = getRetentionStatus(photo, defaultRetentionPolicy);
      
      expect(status.status).toBe('pending_deletion');
      expect(status.daysUntilDeletion).toBe(5); // 37 total - 32 elapsed = 5 remaining
    });

    it('should return expired status for photos past deletion date', () => {
      const now = Date.now();
      const archivedAt = now - 40 * 24 * 60 * 60 * 1000; // 40 days ago (expired)
      const photo = createMockPhoto('1', 'pending_deletion', archivedAt);
      const status = getRetentionStatus(photo, defaultRetentionPolicy);
      
      expect(status.status).toBe('expired');
      expect(status.daysUntilDeletion).toBe(0);
    });

    it('should handle photos without archived_at timestamp', () => {
      const photo = createMockPhoto('1', 'archived');
      const status = getRetentionStatus(photo, defaultRetentionPolicy);
      
      expect(status.status).toBe('archived');
      expect(status.daysUntilDeletion).toBeUndefined();
    });
  });
});