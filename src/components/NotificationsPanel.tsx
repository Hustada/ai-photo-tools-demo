// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import { DeletionNotificationComponent } from './DeletionNotification';
import { useNotificationManager } from '../hooks/useNotificationManager';
import { restorePhoto } from '../utils/photoActions';
import type { Photo } from '../types';

export interface NotificationsPanelProps {
  photos: Photo[];
  onPhotosUpdate: (photos: Photo[]) => void;
  className?: string;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  photos,
  onPhotosUpdate,
  className = '',
}) => {
  const {
    activeNotifications,
    dismissNotification,
    dismissAllNotifications,
    hasActiveNotifications,
    notificationCount,
  } = useNotificationManager();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleRestorePhoto = (photoId: string) => {
    const photoToRestore = photos.find(photo => photo.id === photoId);
    if (!photoToRestore) {
      console.error(`[NotificationsPanel] Photo not found for restoration: ${photoId}`);
      return;
    }

    const restoredPhoto = restorePhoto(photoToRestore);
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId ? restoredPhoto : photo
    );

    onPhotosUpdate(updatedPhotos);
    console.log(`[NotificationsPanel] Restored photo: ${photoId}`);

    // Dismiss related notifications
    const relatedNotifications = activeNotifications.filter(
      notification => notification.photoId === photoId
    );
    relatedNotifications.forEach(notification => {
      dismissNotification(notification.id);
    });
  };

  if (!hasActiveNotifications) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
          </div>
          <h3 className="ml-2 text-sm font-medium text-gray-900">
            Deletion Notifications
          </h3>
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {notificationCount}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={dismissAllNotifications}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            Dismiss All
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md p-1"
          >
            <span className="sr-only">{isCollapsed ? 'Expand' : 'Collapse'}</span>
            <svg
              className={`h-4 w-4 transform transition-transform ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {!isCollapsed && (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {activeNotifications.map((notification) => (
            <DeletionNotificationComponent
              key={notification.id}
              notification={notification}
              onDismiss={dismissNotification}
              onRestore={handleRestorePhoto}
            />
          ))}
        </div>
      )}

      {/* Collapsed summary */}
      {isCollapsed && (
        <div className="p-4">
          <p className="text-sm text-gray-600">
            {notificationCount} photo{notificationCount !== 1 ? 's' : ''} scheduled for deletion
          </p>
        </div>
      )}
    </div>
  );
};