// © 2025 Mark Hustad — MIT License
// FAKE FEATURE: Team collaboration and notification system
// This is part of the standalone fake feature for testing CodeCraft blog generation

import React, { useState, useCallback, useEffect } from 'react';
import type { Task } from './TaskManager';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'member';
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  edited?: boolean;
  editedAt?: Date;
  mentions?: string[]; // User IDs mentioned in comment
}

export interface TaskNotification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'comment_added' | 'due_date_approaching' | 'task_overdue';
  taskId: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

export interface TeamCollaborationProps {
  tasks: Task[];
  currentUserId: string;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onNotificationRead?: (notificationId: string) => void;
}

interface ActivityFeedItem {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'comment_added' | 'assignment_changed';
  taskId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'user1',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'admin',
    status: 'online',
    lastSeen: new Date()
  },
  {
    id: 'user2',
    name: 'Mike Chen',
    email: 'mike@company.com',
    role: 'manager',
    status: 'away',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
  },
  {
    id: 'user3',
    name: 'Emily Davis',
    email: 'emily@company.com',
    role: 'member',
    status: 'online',
    lastSeen: new Date()
  },
  {
    id: 'user4',
    name: 'Alex Rodriguez',
    email: 'alex@company.com',
    role: 'member',
    status: 'offline',
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  }
];

const TeamCollaboration: React.FC<TeamCollaborationProps> = ({
  tasks,
  currentUserId,
  onTaskUpdate,
  onNotificationRead
}) => {
  const [teamMembers] = useState<TeamMember[]>(MOCK_TEAM_MEMBERS);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'team' | 'activity' | 'notifications'>('team');

  // Generate mock activity feed
  useEffect(() => {
    const generateActivityFeed = () => {
      const activities: ActivityFeedItem[] = [];
      const now = new Date();

      // Generate some mock activities
      tasks.slice(0, 10).forEach((task, index) => {
        const user = teamMembers[index % teamMembers.length];
        const timestamp = new Date(now.getTime() - (index * 30 * 60 * 1000)); // Spread over last few hours

        activities.push({
          id: `activity-${task.id}-${index}`,
          type: 'task_created',
          taskId: task.id,
          userId: user.id,
          userName: user.name,
          message: `created task "${task.title}"`,
          timestamp,
          metadata: { priority: task.priority }
        });

        if (task.status === 'completed') {
          activities.push({
            id: `activity-completed-${task.id}`,
            type: 'task_completed',
            taskId: task.id,
            userId: user.id,
            userName: user.name,
            message: `completed task "${task.title}"`,
            timestamp: new Date(timestamp.getTime() + 60 * 60 * 1000),
            metadata: { completionTime: '2 hours' }
          });
        }
      });

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivityFeed(activities.slice(0, 20));
    };

    generateActivityFeed();
  }, [tasks, teamMembers]);

  // Generate mock notifications
  useEffect(() => {
    const generateNotifications = () => {
      const notifs: TaskNotification[] = [];
      const now = new Date();

      tasks.forEach((task, index) => {
        // Due date approaching notifications
        if (task.dueDate && task.status !== 'completed') {
          const daysUntilDue = Math.ceil((task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDue <= 1 && daysUntilDue >= 0) {
            notifs.push({
              id: `notif-due-${task.id}`,
              type: 'due_date_approaching',
              taskId: task.id,
              userId: currentUserId,
              message: `Task "${task.title}" is due ${daysUntilDue === 0 ? 'today' : 'tomorrow'}`,
              read: false,
              createdAt: new Date(now.getTime() - index * 10 * 60 * 1000)
            });
          } else if (daysUntilDue < 0) {
            notifs.push({
              id: `notif-overdue-${task.id}`,
              type: 'task_overdue',
              taskId: task.id,
              userId: currentUserId,
              message: `Task "${task.title}" is ${Math.abs(daysUntilDue)} days overdue`,
              read: false,
              createdAt: new Date(now.getTime() - index * 15 * 60 * 1000)
            });
          }
        }

        // Assignment notifications
        if (task.assignedTo === currentUserId && index < 3) {
          notifs.push({
            id: `notif-assigned-${task.id}`,
            type: 'task_assigned',
            taskId: task.id,
            userId: currentUserId,
            message: `You were assigned to task "${task.title}"`,
            read: index !== 0, // First one unread
            createdAt: new Date(now.getTime() - (index + 5) * 30 * 60 * 1000)
          });
        }
      });

      notifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNotifications(notifs.slice(0, 15));
    };

    generateNotifications();
  }, [tasks, currentUserId]);

  const handleAssignTask = useCallback((taskId: string, userId: string) => {
    const user = teamMembers.find(u => u.id === userId);
    if (!user) return;

    onTaskUpdate(taskId, { assignedTo: user.name });

    // Add activity
    const newActivity: ActivityFeedItem = {
      id: `activity-assign-${taskId}-${Date.now()}`,
      type: 'assignment_changed',
      taskId,
      userId: currentUserId,
      userName: teamMembers.find(u => u.id === currentUserId)?.name || 'Unknown',
      message: `assigned task to ${user.name}`,
      timestamp: new Date()
    };

    setActivityFeed(prev => [newActivity, ...prev].slice(0, 20));
  }, [teamMembers, currentUserId, onTaskUpdate]);

  const handleMarkNotificationRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    onNotificationRead?.(notificationId);
  }, [onNotificationRead]);

  const getStatusIcon = (status: TeamMember['status']) => {
    switch (status) {
      case 'online': return '🟢';
      case 'away': return '🟡';
      case 'offline': return '🔴';
      default: return '⚪';
    }
  };

  const getActivityIcon = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'task_created': return '✨';
      case 'task_updated': return '📝';
      case 'task_completed': return '✅';
      case 'comment_added': return '💬';
      case 'assignment_changed': return '👤';
      default: return '📋';
    }
  };

  const getNotificationIcon = (type: TaskNotification['type']) => {
    switch (type) {
      case 'task_assigned': return '👤';
      case 'task_completed': return '✅';
      case 'comment_added': return '💬';
      case 'due_date_approaching': return '⏰';
      case 'task_overdue': return '🚨';
      default: return '📢';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="border-b">
        <nav className="flex">
          {[
            { id: 'team', label: 'Team', count: teamMembers.filter(m => m.status === 'online').length },
            { id: 'activity', label: 'Activity', count: activityFeed.length },
            { id: 'notifications', label: 'Notifications', count: unreadNotifications.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4">
        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
              <span className="text-sm text-gray-500">
                {teamMembers.filter(m => m.status === 'online').length} online
              </span>
            </div>

            <div className="space-y-3">
              {teamMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {member.name.charAt(0)}
                      </div>
                      <span className="absolute -top-1 -right-1 text-sm">
                        {getStatusIcon(member.status)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-500">{member.role}</div>
                      <div className="text-xs text-gray-400">
                        Last seen: {formatTimeAgo(member.lastSeen)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      member.status === 'online' ? 'bg-green-100 text-green-800' :
                      member.status === 'away' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityFeed.map(activity => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg mt-0.5">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.userName}</span> {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadNotifications.length > 0 && (
                <button
                  onClick={() => {
                    unreadNotifications.forEach(notif => handleMarkNotificationRead(notif.id));
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    notification.read ? 'bg-gray-50' : 'bg-blue-50 border border-blue-200'
                  }`}
                  onClick={() => handleMarkNotificationRead(notification.id)}
                >
                  <span className="text-lg mt-0.5">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1">
                    <p className={`text-sm ${notification.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  )}
                </div>
              ))}
              
              {notifications.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">🔔</div>
                  <p>No notifications yet</p>
                  <p className="text-sm mt-1">You'll see task updates and mentions here</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamCollaboration;