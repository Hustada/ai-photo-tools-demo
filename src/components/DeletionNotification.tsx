// © 2025 Mark Hustad — MIT License

import React from 'react';
import type { DeletionNotification } from '../types';

export interface DeletionNotificationProps {
  notification: DeletionNotification;
  onDismiss: (notificationId: string) => void;
  onRestore?: (photoId: string) => void;
  className?: string;
}

export const DeletionNotificationComponent: React.FC<DeletionNotificationProps> = ({
  notification,
  onDismiss,
  onRestore,
  className = '',
}) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilDeletion = () => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((notification.scheduledDeletionDate - now) / msPerDay);
    return Math.max(0, daysRemaining);
  };

  const isWarning = notification.type === 'deletion_warning';
  const daysUntilDeletion = getDaysUntilDeletion();

  const getNotificationContent = () => {
    if (isWarning) {
      return {
        title: 'Photo Deletion Warning',
        message: `A photo will be permanently deleted in ${daysUntilDeletion} day${daysUntilDeletion !== 1 ? 's' : ''}.`,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-400',
        icon: '⚠️',
      };
    } else {
      return {
        title: 'Photo Scheduled for Deletion',
        message: `A photo has been marked for deletion and will be permanently removed on ${formatDate(notification.scheduledDeletionDate)}.`,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-400',
        icon: '🗑️',
      };
    }
  };

  const content = getNotificationContent();

  return (
    <div className={`${content.bgColor} ${content.borderColor} border rounded-lg p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className={`text-xl ${content.iconColor}`} role="img" aria-label={isWarning ? 'Warning' : 'Delete'}>
            {content.icon}
          </span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${content.textColor}`}>
            {content.title}
          </h3>
          <div className={`mt-1 text-sm ${content.textColor}`}>
            <p>{content.message}</p>
          </div>
          <div className="mt-3 flex space-x-3">
            {onRestore && (
              <button
                type="button"
                onClick={() => onRestore(notification.photoId)}
                className={`text-sm font-medium ${
                  isWarning 
                    ? 'text-yellow-800 hover:text-yellow-900' 
                    : 'text-red-800 hover:text-red-900'
                } underline`}
              >
                Restore Photo
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className={`text-sm font-medium ${
                isWarning 
                  ? 'text-yellow-800 hover:text-yellow-900' 
                  : 'text-red-800 hover:text-red-900'
              } underline`}
            >
              Dismiss
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className={`inline-flex ${content.textColor} hover:${content.bgColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600 rounded-md p-1.5`}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};