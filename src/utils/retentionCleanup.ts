// © 2025 Mark Hustad — MIT License

import type { Photo, RetentionPolicy, DeletionNotification } from '../types';

export interface CleanupResult {
  photosMarkedForDeletion: Photo[];
  notificationsCreated: DeletionNotification[];
  photosScheduledForRemoval: Photo[];
}

export const processRetentionCleanup = (
  photos: Photo[],
  retentionPolicy: RetentionPolicy,
  existingNotifications: DeletionNotification[]
): CleanupResult => {
  if (!retentionPolicy.enabled) {
    return {
      photosMarkedForDeletion: [],
      notificationsCreated: [],
      photosScheduledForRemoval: [],
    };
  }

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const archiveRetentionMs = retentionPolicy.archiveRetentionDays * msPerDay;
  const deletionGraceMs = retentionPolicy.deletionGraceDays * msPerDay;
  const notificationMs = retentionPolicy.notificationDaysBefore * msPerDay;

  const archivedPhotos = photos.filter(photo => 
    photo.archive_state === 'archived' && photo.archived_at
  );

  const pendingDeletionPhotos = photos.filter(photo => 
    photo.archive_state === 'pending_deletion' && photo.archived_at
  );

  const photosMarkedForDeletion: Photo[] = [];
  const notificationsCreated: DeletionNotification[] = [];
  const photosScheduledForRemoval: Photo[] = [];

  // Process archived photos that should be marked for deletion
  archivedPhotos.forEach(photo => {
    if (!photo.archived_at) return;

    const timeSinceArchived = now - photo.archived_at;
    
    // Mark for deletion if archive retention period has passed
    if (timeSinceArchived >= archiveRetentionMs) {
      photosMarkedForDeletion.push({
        ...photo,
        archive_state: 'pending_deletion'
      });

      // Create deletion notification
      const scheduledDeletionDate = now + deletionGraceMs;
      const notificationId = `deletion_${photo.id}_${now}`;
      
      notificationsCreated.push({
        id: notificationId,
        photoId: photo.id,
        type: 'deletion_scheduled',
        scheduledDeletionDate,
        createdAt: now,
        dismissed: false,
      });
    }
    // Create warning notification if approaching deletion
    else if (timeSinceArchived >= (archiveRetentionMs - notificationMs)) {
      const hasExistingWarning = existingNotifications.some(
        notif => notif.photoId === photo.id && 
        notif.type === 'deletion_warning' && 
        !notif.dismissed
      );

      if (!hasExistingWarning) {
        const notificationId = `warning_${photo.id}_${now}`;
        notificationsCreated.push({
          id: notificationId,
          photoId: photo.id,
          type: 'deletion_warning',
          scheduledDeletionDate: photo.archived_at + archiveRetentionMs + deletionGraceMs,
          createdAt: now,
          dismissed: false,
        });
      }
    }
  });

  // Process photos pending deletion that should be permanently removed
  pendingDeletionPhotos.forEach(photo => {
    if (!photo.archived_at) return;

    const timeSinceArchived = now - photo.archived_at;
    const totalRetentionTime = archiveRetentionMs + deletionGraceMs;

    if (timeSinceArchived >= totalRetentionTime) {
      photosScheduledForRemoval.push(photo);
    }
  });

  return {
    photosMarkedForDeletion,
    notificationsCreated,
    photosScheduledForRemoval,
  };
};

export const calculateDeletionDate = (
  archivedAt: number,
  retentionPolicy: RetentionPolicy
): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const archiveRetentionMs = retentionPolicy.archiveRetentionDays * msPerDay;
  const deletionGraceMs = retentionPolicy.deletionGraceDays * msPerDay;
  
  return archivedAt + archiveRetentionMs + deletionGraceMs;
};

export const getDaysUntilDeletion = (
  archivedAt: number,
  retentionPolicy: RetentionPolicy
): number => {
  const deletionDate = calculateDeletionDate(archivedAt, retentionPolicy);
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  return Math.max(0, Math.ceil((deletionDate - now) / msPerDay));
};

export const getRetentionStatus = (
  photo: Photo,
  retentionPolicy: RetentionPolicy
): {
  status: 'active' | 'archived' | 'pending_deletion' | 'expired';
  daysUntilDeletion?: number;
  scheduledDeletionDate?: number;
} => {
  if (!photo.archive_state || photo.archive_state === 'active') {
    return { status: 'active' };
  }

  if (!photo.archived_at) {
    return { status: photo.archive_state as any };
  }

  const daysUntilDeletion = getDaysUntilDeletion(photo.archived_at, retentionPolicy);
  const scheduledDeletionDate = calculateDeletionDate(photo.archived_at, retentionPolicy);

  if (daysUntilDeletion <= 0) {
    return { 
      status: 'expired' as const,
      daysUntilDeletion: 0,
      scheduledDeletionDate 
    };
  }

  return {
    status: photo.archive_state as 'archived' | 'pending_deletion',
    daysUntilDeletion,
    scheduledDeletionDate,
  };
};