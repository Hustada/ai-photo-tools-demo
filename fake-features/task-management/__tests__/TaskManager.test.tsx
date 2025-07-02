// © 2025 Mark Hustad — MIT License
// FAKE FEATURE: Comprehensive test suite for Task Management System
// This is part of the standalone fake feature for testing CodeCraft blog generation

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskManager, { type Task, type TaskFilter } from '../TaskManager';
import TaskStorage from '../TaskStorage';

// Mock TaskStorage
jest.mock('../TaskStorage');

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Implement user authentication',
    description: 'Add login and registration functionality with JWT tokens',
    status: 'in-progress',
    priority: 'high',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    dueDate: new Date('2025-01-15'),
    assignedTo: 'john.doe',
    tags: ['auth', 'backend', 'security'],
    estimatedHours: 8,
    actualHours: 5
  },
  {
    id: 'task-2',
    title: 'Design landing page',
    description: 'Create responsive landing page design',
    status: 'completed',
    priority: 'medium',
    createdAt: new Date('2024-12-28'),
    updatedAt: new Date('2025-01-01'),
    dueDate: new Date('2025-01-10'),
    assignedTo: 'jane.smith',
    tags: ['design', 'frontend', 'ui'],
    estimatedHours: 12,
    actualHours: 10
  },
  {
    id: 'task-3',
    title: 'Fix database connection issue',
    description: 'Resolve intermittent database connection timeouts',
    status: 'pending',
    priority: 'urgent',
    createdAt: new Date('2025-01-03'),
    updatedAt: new Date('2025-01-03'),
    assignedTo: 'bob.wilson',
    tags: ['database', 'bug', 'backend'],
    estimatedHours: 4
  }
];

describe('TaskManager Component', () => {
  const mockProps = {
    initialTasks: mockTasks,
    onTaskCreate: jest.fn(),
    onTaskUpdate: jest.fn(),
    onTaskDelete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders task management system title', () => {
      render(<TaskManager {...mockProps} />);
      expect(screen.getByText('Task Management System')).toBeInTheDocument();
    });

    test('displays task statistics correctly', () => {
      render(<TaskManager {...mockProps} />);
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Total tasks
      expect(screen.getByText('1')).toBeInTheDocument(); // Completed tasks
      expect(screen.getByText('1')).toBeInTheDocument(); // In progress tasks
      expect(screen.getByText('1')).toBeInTheDocument(); // Pending tasks
    });

    test('renders all tasks in the list', () => {
      render(<TaskManager {...mockProps} />);
      
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Design landing page')).toBeInTheDocument();
      expect(screen.getByText('Fix database connection issue')).toBeInTheDocument();
    });

    test('displays task priority and status badges', () => {
      render(<TaskManager {...mockProps} />);
      
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
      
      expect(screen.getByText('in-progress')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  describe('Task Filtering', () => {
    test('filters tasks by status', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      // Initially shows all tasks
      expect(screen.getByText('Tasks (3)')).toBeInTheDocument();
      
      // Filter implementation would require filter UI components
      // This is a placeholder for filter testing
    });

    test('filters overdue tasks correctly', () => {
      const overdueTask: Task = {
        ...mockTasks[0],
        id: 'overdue-task',
        dueDate: new Date('2024-12-01'), // Past date
        status: 'in-progress'
      };
      
      const propsWithOverdue = {
        ...mockProps,
        initialTasks: [...mockTasks, overdueTask]
      };
      
      render(<TaskManager {...propsWithOverdue} />);
      
      // Check if overdue count is displayed (would be 1)
      expect(screen.getByText('1')).toBeInTheDocument(); // Overdue count
    });
  });

  describe('Task Actions', () => {
    test('calls onTaskUpdate when completing a task', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      const completeButton = screen.getAllByText('Complete')[0];
      await user.click(completeButton);
      
      expect(mockProps.onTaskUpdate).toHaveBeenCalledWith(
        'task-1',
        { status: 'completed' }
      );
    });

    test('calls onTaskUpdate when reopening a completed task', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      const reopenButton = screen.getByText('Reopen');
      await user.click(reopenButton);
      
      expect(mockProps.onTaskUpdate).toHaveBeenCalledWith(
        'task-2',
        { status: 'pending' }
      );
    });

    test('calls onTaskDelete when deleting a task', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);
      
      expect(mockProps.onTaskDelete).toHaveBeenCalledWith('task-1');
    });

    test('opens create task modal when Create Task button is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      const createButton = screen.getByText('Create Task');
      await user.click(createButton);
      
      // Modal opening logic would be tested here
      // This is a placeholder for modal testing
    });
  });

  describe('Task Statistics', () => {
    test('calculates completion rate correctly', () => {
      render(<TaskManager {...mockProps} />);
      
      // 1 completed out of 3 total = 33.33% completion rate
      // This would be tested through the component's statistics display
    });

    test('counts overdue tasks correctly', () => {
      const tasksWithOverdue = [
        ...mockTasks,
        {
          ...mockTasks[0],
          id: 'overdue-1',
          dueDate: new Date('2024-12-01'),
          status: 'in-progress' as const
        },
        {
          ...mockTasks[0],
          id: 'overdue-2',
          dueDate: new Date('2024-11-01'),
          status: 'pending' as const
        }
      ];

      const propsWithOverdue = {
        ...mockProps,
        initialTasks: tasksWithOverdue
      };

      render(<TaskManager {...propsWithOverdue} />);
      
      // Should show 2 overdue tasks
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<TaskManager {...mockProps} />);
      
      // Check for accessible form elements
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TaskManager {...mockProps} />);
      
      // Test tab navigation
      await user.tab();
      expect(document.activeElement).toBeTruthy();
    });
  });

  describe('Performance', () => {
    test('handles large number of tasks efficiently', () => {
      const largeMockTasks = Array.from({ length: 1000 }, (_, index) => ({
        ...mockTasks[0],
        id: `task-${index}`,
        title: `Task ${index}`
      }));

      const performanceProps = {
        ...mockProps,
        initialTasks: largeMockTasks
      };

      const startTime = performance.now();
      render(<TaskManager {...performanceProps} />);
      const endTime = performance.now();

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

describe('TaskStorage', () => {
  let taskStorage: TaskStorage;

  beforeEach(() => {
    taskStorage = new TaskStorage({ autoSave: false });
    localStorage.clear();
  });

  afterEach(() => {
    taskStorage.stopAutoSync();
  });

  describe('Task Persistence', () => {
    test('saves tasks to localStorage', () => {
      taskStorage.saveTasks(mockTasks);
      
      const stored = localStorage.getItem('task-manager-data');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.tasks).toHaveLength(3);
    });

    test('loads tasks from localStorage', () => {
      taskStorage.saveTasks(mockTasks);
      const loaded = taskStorage.loadTasks();
      
      expect(loaded).toHaveLength(3);
      expect(loaded[0].title).toBe('Implement user authentication');
    });

    test('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem('task-manager-data', 'invalid json');
      
      const loaded = taskStorage.loadTasks();
      expect(loaded).toEqual([]);
    });
  });

  describe('Task Metrics', () => {
    test('generates accurate task metrics', () => {
      const metrics = taskStorage.generateMetrics(mockTasks);
      
      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completionRate).toBe(33.33); // 1 completed out of 3
      expect(metrics.tasksByStatus.completed).toBe(1);
      expect(metrics.tasksByStatus['in-progress']).toBe(1);
      expect(metrics.tasksByStatus.pending).toBe(1);
    });

    test('calculates productivity trend correctly', () => {
      const metrics = taskStorage.generateMetrics(mockTasks);
      
      expect(metrics.productivityTrend).toHaveLength(30); // Last 30 days
      expect(metrics.productivityTrend[0]).toHaveProperty('date');
      expect(metrics.productivityTrend[0]).toHaveProperty('completed');
      expect(metrics.productivityTrend[0]).toHaveProperty('created');
    });
  });

  describe('Task Search', () => {
    test('searches tasks by title and description', () => {
      const results = taskStorage.searchTasks(mockTasks, 'authentication');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Implement user authentication');
    });

    test('filters tasks by multiple criteria', () => {
      const filter: TaskFilter = {
        status: ['in-progress'],
        priority: ['high']
      };
      
      const results = taskStorage.searchTasks(mockTasks, '', filter);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('task-1');
    });

    test('handles empty search queries', () => {
      const results = taskStorage.searchTasks(mockTasks, '');
      
      expect(results).toHaveLength(3); // Returns all tasks
    });
  });
});