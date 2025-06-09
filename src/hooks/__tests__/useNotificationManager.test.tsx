// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationManager } from '../useNotificationManager';
import { UserContextProvider } from '../../contexts/UserContext';
import type { DeletionNotification } from '../../types';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock UserContext
vi.mock('../../contexts/UserContext', async () => {
  const actual = await vi.importActual('../../contexts/UserContext');
  return {
    ...actual,
    useUserContext: vi.fn(),
  };
});

const mockUpdateUserSettings = vi.fn();
const defaultUserSettings = {
  retentionPolicy: {
    archiveRetentionDays: 30,
    deletionGraceDays: 7,
    notificationDaysBefore: 3,
    enabled: true,
  },
  deletionNotifications: [],
};

describe('useNotificationManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: defaultUserSettings,
      updateUserSettings: mockUpdateUserSettings,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty notifications initially', () => {
    const { result } = renderHook(() => useNotificationManager());

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.activeNotifications).toHaveLength(0);
    expect(result.current.hasActiveNotifications).toBe(false);
    expect(result.current.notificationCount).toBe(0);
  });

  it('should filter out dismissed notifications from active notifications', async () => {
    const now = Date.now();
    const notifications: DeletionNotification[] = [
      {
        id: '1',
        photoId: 'photo-1',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
      {
        id: '2',
        photoId: 'photo-2',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: true,
      },
    ];

    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: {
        ...defaultUserSettings,
        deletionNotifications: notifications,
      },
      updateUserSettings: mockUpdateUserSettings,
    });

    const { result } = renderHook(() => useNotificationManager());

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.activeNotifications).toHaveLength(1);
    expect(result.current.activeNotifications[0].id).toBe('1');
    expect(result.current.hasActiveNotifications).toBe(true);
    expect(result.current.notificationCount).toBe(1);
  });

  it('should filter out expired notifications from active notifications', async () => {
    const now = Date.now();
    const notifications: DeletionNotification[] = [
      {
        id: '1',
        photoId: 'photo-1',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000, // Future
        createdAt: now,
        dismissed: false,
      },
      {
        id: '2',
        photoId: 'photo-2',
        type: 'deletion_warning',
        scheduledDeletionDate: now - 86400000, // Past (expired)
        createdAt: now,
        dismissed: false,
      },
    ];

    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: {
        ...defaultUserSettings,
        deletionNotifications: notifications,
      },
      updateUserSettings: mockUpdateUserSettings,
    });

    const { result } = renderHook(() => useNotificationManager());

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.activeNotifications).toHaveLength(1);
    expect(result.current.activeNotifications[0].id).toBe('1');
  });

  it('should dismiss a notification', async () => {
    const now = Date.now();
    const notifications: DeletionNotification[] = [
      {
        id: '1',
        photoId: 'photo-1',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
    ];

    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: {
        ...defaultUserSettings,
        deletionNotifications: notifications,
      },
      updateUserSettings: mockUpdateUserSettings,
    });

    const { result } = renderHook(() => useNotificationManager());

    act(() => {
      result.current.dismissNotification('1');
    });

    expect(mockUpdateUserSettings).toHaveBeenCalledWith({
      deletionNotifications: [
        {
          ...notifications[0],
          dismissed: true,
        },
      ],
    });
  });

  it('should dismiss all notifications', async () => {
    const now = Date.now();
    const notifications: DeletionNotification[] = [
      {
        id: '1',
        photoId: 'photo-1',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
      {
        id: '2',
        photoId: 'photo-2',
        type: 'deletion_scheduled',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
    ];

    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: {
        ...defaultUserSettings,
        deletionNotifications: notifications,
      },
      updateUserSettings: mockUpdateUserSettings,
    });

    const { result } = renderHook(() => useNotificationManager());

    act(() => {
      result.current.dismissAllNotifications();
    });

    expect(mockUpdateUserSettings).toHaveBeenCalledWith({
      deletionNotifications: notifications.map(n => ({ ...n, dismissed: true })),
    });
  });

  it('should get notifications for a specific photo', async () => {
    const now = Date.now();
    const notifications: DeletionNotification[] = [
      {
        id: '1',
        photoId: 'photo-1',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
      {
        id: '2',
        photoId: 'photo-2',
        type: 'deletion_warning',
        scheduledDeletionDate: now + 86400000,
        createdAt: now,
        dismissed: false,
      },
    ];

    const { useUserContext } = await import('../../contexts/UserContext');
    (useUserContext as any).mockReturnValue({
      userSettings: {
        ...defaultUserSettings,
        deletionNotifications: notifications,
      },
      updateUserSettings: mockUpdateUserSettings,
    });

    const { result } = renderHook(() => useNotificationManager());

    const photoNotifications = result.current.getNotificationsForPhoto('photo-1');

    expect(photoNotifications).toHaveLength(1);
    expect(photoNotifications[0].id).toBe('1');
  });
});