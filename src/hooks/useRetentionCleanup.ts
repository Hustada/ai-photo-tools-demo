// © 2025 Mark Hustad — MIT License

import { useCallback, useEffect, useRef } from 'react';
import { useUserContext } from '../contexts/UserContext';
import { processRetentionCleanup, type CleanupResult } from '../utils/retentionCleanup';
import type { Photo, DeletionNotification } from '../types';

export interface UseRetentionCleanupProps {
  photos: Photo[];
  onPhotosUpdate: (photos: Photo[]) => void;
  enabled?: boolean;
}

export interface UseRetentionCleanupReturn {
  runCleanup: () => CleanupResult;
  scheduledCleanupInterval: number | null;
  isCleanupEnabled: boolean;
}

export const useRetentionCleanup = ({
  photos,
  onPhotosUpdate,
  enabled = true,
}: UseRetentionCleanupProps): UseRetentionCleanupReturn => {
  const { userSettings, updateUserSettings } = useUserContext();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCleanupRef = useRef<number>(0);

  const runCleanup = useCallback((): CleanupResult => {
    if (!userSettings.retentionPolicy.enabled || !enabled) {
      return {
        photosMarkedForDeletion: [],
        notificationsCreated: [],
        photosScheduledForRemoval: [],
      };
    }

    console.log('[RetentionCleanup] Running cleanup process...');
    
    const result = processRetentionCleanup(
      photos,
      userSettings.retentionPolicy,
      userSettings.deletionNotifications
    );

    // Update photos that were marked for deletion
    if (result.photosMarkedForDeletion.length > 0) {
      const updatedPhotos = photos.map(photo => {
        const markedPhoto = result.photosMarkedForDeletion.find(p => p.id === photo.id);
        return markedPhoto || photo;
      });
      
      onPhotosUpdate(updatedPhotos);
      console.log(`[RetentionCleanup] Marked ${result.photosMarkedForDeletion.length} photos for deletion`);
    }

    // Remove photos scheduled for removal (simulate permanent deletion)
    if (result.photosScheduledForRemoval.length > 0) {
      const remainingPhotos = photos.filter(photo => 
        !result.photosScheduledForRemoval.some(removedPhoto => removedPhoto.id === photo.id)
      );
      
      onPhotosUpdate(remainingPhotos);
      console.log(`[RetentionCleanup] Removed ${result.photosScheduledForRemoval.length} photos permanently`);
    }

    // Update notifications
    if (result.notificationsCreated.length > 0) {
      const updatedNotifications = [
        ...userSettings.deletionNotifications,
        ...result.notificationsCreated,
      ];

      updateUserSettings({
        deletionNotifications: updatedNotifications,
      });

      console.log(`[RetentionCleanup] Created ${result.notificationsCreated.length} new notifications`);
    }

    lastCleanupRef.current = Date.now();
    return result;
  }, [photos, onPhotosUpdate, userSettings, updateUserSettings, enabled]);

  // Schedule periodic cleanup
  useEffect(() => {
    if (!userSettings.retentionPolicy.enabled || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run cleanup every hour
    const cleanupInterval = 60 * 60 * 1000; // 1 hour in milliseconds
    
    intervalRef.current = setInterval(() => {
      const timeSinceLastCleanup = Date.now() - lastCleanupRef.current;
      
      // Only run if it's been at least 1 hour since last cleanup
      if (timeSinceLastCleanup >= cleanupInterval) {
        runCleanup();
      }
    }, cleanupInterval);

    // Run initial cleanup after a short delay
    const initialTimeout = setTimeout(() => {
      runCleanup();
    }, 5000); // 5 second delay

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearTimeout(initialTimeout);
    };
  }, [runCleanup, userSettings.retentionPolicy.enabled, enabled]);

  return {
    runCleanup,
    scheduledCleanupInterval: intervalRef.current ? 60 * 60 * 1000 : null,
    isCleanupEnabled: userSettings.retentionPolicy.enabled && enabled,
  };
};