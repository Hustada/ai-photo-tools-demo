// © 2025 Mark Hustad — MIT License
// FAKE FEATURE: Task persistence and storage utilities
// This is part of the standalone fake feature for testing CodeCraft blog generation

import type { Task, TaskFilter } from './TaskManager';

export interface TaskStorageOptions {
  storageKey?: string;
  autoSave?: boolean;
  syncInterval?: number;
}

export interface TaskMetrics {
  totalTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  tasksByPriority: Record<Task['priority'], number>;
  tasksByStatus: Record<Task['status'], number>;
  productivityTrend: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
}

class TaskStorage {
  private storageKey: string;
  private autoSave: boolean;
  private syncInterval: number;
  private syncTimer?: NodeJS.Timeout;

  constructor(options: TaskStorageOptions = {}) {
    this.storageKey = options.storageKey || 'task-manager-data';
    this.autoSave = options.autoSave ?? true;
    this.syncInterval = options.syncInterval || 30000; // 30 seconds

    if (this.autoSave) {
      this.startAutoSync();
    }
  }

  /**
   * Save tasks to localStorage
   */
  saveTasks(tasks: Task[]): void {
    try {
      const data = {
        tasks,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log(`[TaskStorage] Saved ${tasks.length} tasks to storage`);
    } catch (error) {
      console.error('[TaskStorage] Failed to save tasks:', error);
    }
  }

  /**
   * Load tasks from localStorage
   */
  loadTasks(): Task[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const data = JSON.parse(stored);
      const tasks = data.tasks || [];

      // Convert date strings back to Date objects
      return tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
      }));
    } catch (error) {
      console.error('[TaskStorage] Failed to load tasks:', error);
      return [];
    }
  }

  /**
   * Export tasks to JSON file
   */
  exportTasks(tasks: Task[]): void {
    try {
      const data = {
        tasks,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[TaskStorage] Failed to export tasks:', error);
    }
  }

  /**
   * Import tasks from JSON file
   */
  async importTasks(file: File): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          const tasks = data.tasks || [];

          // Convert date strings back to Date objects
          const processedTasks = tasks.map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined
          }));

          resolve(processedTasks);
        } catch (error) {
          reject(new Error('Invalid file format'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Generate task metrics and analytics
   */
  generateMetrics(tasks: Task[]): TaskMetrics {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Basic metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

    // Average completion time (for tasks completed in last 30 days)
    const recentCompletedTasks = completedTasks.filter(t => t.updatedAt >= thirtyDaysAgo);
    const averageCompletionTime = recentCompletedTasks.length > 0
      ? recentCompletedTasks.reduce((sum, task) => {
          const completionTime = task.updatedAt.getTime() - task.createdAt.getTime();
          return sum + completionTime;
        }, 0) / recentCompletedTasks.length / (24 * 60 * 60 * 1000) // Convert to days
      : 0;

    // Tasks by priority
    const tasksByPriority: Record<Task['priority'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    };
    tasks.forEach(task => {
      tasksByPriority[task.priority]++;
    });

    // Tasks by status
    const tasksByStatus: Record<Task['status'], number> = {
      pending: 0,
      'in-progress': 0,
      completed: 0,
      cancelled: 0
    };
    tasks.forEach(task => {
      tasksByStatus[task.status]++;
    });

    // Productivity trend (last 30 days)
    const productivityTrend: Array<{ date: string; completed: number; created: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const completed = tasks.filter(t => 
        t.status === 'completed' && 
        t.updatedAt.toISOString().split('T')[0] === dateStr
      ).length;
      
      const created = tasks.filter(t => 
        t.createdAt.toISOString().split('T')[0] === dateStr
      ).length;

      productivityTrend.push({ date: dateStr, completed, created });
    }

    return {
      totalTasks,
      completionRate,
      averageCompletionTime,
      tasksByPriority,
      tasksByStatus,
      productivityTrend
    };
  }

  /**
   * Search tasks with advanced criteria
   */
  searchTasks(tasks: Task[], query: string, filters: TaskFilter = {}): Task[] {
    let filtered = tasks;

    // Text search
    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
      filtered = filtered.filter(task => {
        const searchableText = [
          task.title,
          task.description,
          task.assignedTo || '',
          ...task.tags
        ].join(' ').toLowerCase();

        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    // Apply filters
    if (filters.status?.length) {
      filtered = filtered.filter(task => filters.status!.includes(task.status));
    }

    if (filters.priority?.length) {
      filtered = filtered.filter(task => filters.priority!.includes(task.priority));
    }

    if (filters.assignedTo) {
      filtered = filtered.filter(task => task.assignedTo === filters.assignedTo);
    }

    if (filters.tags?.length) {
      filtered = filtered.filter(task =>
        filters.tags!.some(filterTag =>
          task.tags.some(taskTag => taskTag.toLowerCase().includes(filterTag.toLowerCase()))
        )
      );
    }

    if (filters.dueDateRange?.start || filters.dueDateRange?.end) {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        
        if (filters.dueDateRange?.start && task.dueDate < filters.dueDateRange.start) {
          return false;
        }
        
        if (filters.dueDateRange?.end && task.dueDate > filters.dueDateRange.end) {
          return false;
        }
        
        return true;
      });
    }

    return filtered;
  }

  /**
   * Start automatic sync to localStorage
   */
  private startAutoSync(): void {
    this.syncTimer = setInterval(() => {
      // This would trigger a save in a real implementation
      console.log('[TaskStorage] Auto-sync triggered');
    }, this.syncInterval);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Clear all stored data
   */
  clearStorage(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('[TaskStorage] Storage cleared');
    } catch (error) {
      console.error('[TaskStorage] Failed to clear storage:', error);
    }
  }
}

export default TaskStorage;