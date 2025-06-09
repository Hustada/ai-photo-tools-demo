// © 2025 Mark Hustad — MIT License

import { useCallback, useMemo } from 'react';
import { useUserContext } from '../contexts/UserContext';
import type { DeletionNotification, Photo } from '../types';

export interface UseNotificationManagerReturn {
  notifications: DeletionNotification[];
  activeNotifications: DeletionNotification[];
  dismissNotification: (notificationId: string) => void;
  dismissAllNotifications: () => void;
  getNotificationsForPhoto: (photoId: string) => DeletionNotification[];
  hasActiveNotifications: boolean;
  notificationCount: number;
}

export const useNotificationManager = (): UseNotificationManagerReturn => {
  const { userSettings, updateUserSettings } = useUserContext();

  const notifications = useMemo(() => {
    return userSettings.deletionNotifications || [];
  }, [userSettings.deletionNotifications]);

  const activeNotifications = useMemo(() => {
    const now = Date.now();
    return notifications.filter(notification => {
      // Filter out dismissed notifications
      if (notification.dismissed) {
        return false;
      }

      // Filter out expired notifications (scheduled deletion date has passed)
      if (notification.scheduledDeletionDate < now) {
        return false;
      }

      return true;
    });
  }, [notifications]);

  const dismissNotification = useCallback((notificationId: string) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, dismissed: true }
        : notification
    );

    updateUserSettings({
      deletionNotifications: updatedNotifications,
    });

    console.log(`[NotificationManager] Dismissed notification: ${notificationId}`);
  }, [notifications, updateUserSettings]);

  const dismissAllNotifications = useCallback(() => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      dismissed: true,
    }));

    updateUserSettings({
      deletionNotifications: updatedNotifications,
    });

    console.log('[NotificationManager] Dismissed all notifications');
  }, [notifications, updateUserSettings]);

  const getNotificationsForPhoto = useCallback((photoId: string): DeletionNotification[] => {
    return activeNotifications.filter(notification => notification.photoId === photoId);
  }, [activeNotifications]);

  // Cleanup expired and old dismissed notifications periodically
  const cleanupOldNotifications = useCallback(() => {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds

    const cleanedNotifications = notifications.filter(notification => {
      // Keep active notifications
      if (!notification.dismissed && notification.scheduledDeletionDate > now) {
        return true;
      }

      // Keep recently dismissed notifications (within 1 week)
      if (notification.dismissed && notification.createdAt > oneWeekAgo) {
        return true;
      }

      // Remove old dismissed notifications and expired notifications
      return false;
    });

    if (cleanedNotifications.length !== notifications.length) {
      updateUserSettings({
        deletionNotifications: cleanedNotifications,
      });

      const removedCount = notifications.length - cleanedNotifications.length;
      console.log(`[NotificationManager] Cleaned up ${removedCount} old notifications`);
    }
  }, [notifications, updateUserSettings]);

  // Run cleanup periodically (this could be triggered by a useEffect in the consuming component)
  const shouldCleanup = useMemo(() => {
    const lastCleanup = localStorage.getItem('lastNotificationCleanup');
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours in milliseconds

    if (!lastCleanup || parseInt(lastCleanup) < oneDayAgo) {
      localStorage.setItem('lastNotificationCleanup', now.toString());
      return true;
    }

    return false;
  }, []);

  // Auto-cleanup if needed
  if (shouldCleanup) {
    setTimeout(cleanupOldNotifications, 1000); // Delay to avoid blocking render
  }

  return {
    notifications,
    activeNotifications,
    dismissNotification,
    dismissAllNotifications,
    getNotificationsForPhoto,
    hasActiveNotifications: activeNotifications.length > 0,
    notificationCount: activeNotifications.length,
  };
};