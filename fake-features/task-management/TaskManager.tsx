// © 2025 Mark Hustad — MIT License
// FAKE FEATURE: Advanced Task Management System
// This is a standalone fake feature for testing CodeCraft blog generation

import React, { useState, useCallback, useMemo } from 'react';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  assignedTo?: string;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}

export interface TaskFilter {
  status?: Task['status'][];
  priority?: Task['priority'][];
  assignedTo?: string;
  tags?: string[];
  dueDateRange?: { start?: Date; end?: Date };
}

export interface TaskManagerProps {
  initialTasks?: Task[];
  onTaskCreate?: (task: Task) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (taskId: string) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({
  initialTasks = [],
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete
}) => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<TaskFilter>({});
  const [sortBy, setSortBy] = useState<keyof Task>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply filters
    if (filter.status?.length) {
      filtered = filtered.filter(task => filter.status!.includes(task.status));
    }

    if (filter.priority?.length) {
      filtered = filtered.filter(task => filter.priority!.includes(task.priority));
    }

    if (filter.assignedTo) {
      filtered = filtered.filter(task => task.assignedTo === filter.assignedTo);
    }

    if (filter.tags?.length) {
      filtered = filtered.filter(task =>
        filter.tags!.some(filterTag =>
          task.tags.some(taskTag => taskTag.toLowerCase().includes(filterTag.toLowerCase()))
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tasks, filter, sortBy, sortOrder]);

  const handleCreateTask = useCallback((taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setTasks(prev => [...prev, newTask]);
    onTaskCreate?.(newTask);
  }, [onTaskCreate]);

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, ...updates, updatedAt: new Date() }
        : task
    ));
    onTaskUpdate?.(taskId, updates);
  }, [onTaskUpdate]);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    onTaskDelete?.(taskId);
  }, [onTaskDelete]);

  // Task statistics
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const overdue = tasks.filter(t => 
      t.dueDate && t.dueDate < new Date() && t.status !== 'completed'
    ).length;

    return { total, completed, inProgress, pending, overdue };
  }, [tasks]);

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Task Management System</h1>
        <p className="text-gray-600">Organize and track your project tasks efficiently</p>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-gray-900">{taskStats.total}</div>
          <div className="text-sm text-gray-600">Total Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">{taskStats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-yellow-600">{taskStats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-red-600">{taskStats.overdue}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tasks ({filteredTasks.length})</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Task
            </button>
          </div>
        </div>

        <div className="divide-y">
          {filteredTasks.map(task => (
            <div key={task.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-medium text-gray-900">{task.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{task.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Created: {task.createdAt.toLocaleDateString()}</span>
                    {task.dueDate && (
                      <span>Due: {task.dueDate.toLocaleDateString()}</span>
                    )}
                    {task.assignedTo && (
                      <span>Assigned: {task.assignedTo}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpdateTask(task.id, { 
                      status: task.status === 'completed' ? 'pending' : 'completed' 
                    })}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {task.status === 'completed' ? 'Reopen' : 'Complete'}
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskManager;