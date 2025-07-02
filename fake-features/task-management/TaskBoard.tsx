// © 2025 Mark Hustad — MIT License
// FAKE FEATURE: Kanban-style task board with drag-and-drop
// This is part of the standalone fake feature for testing CodeCraft blog generation

import React, { useState, useCallback, useRef } from 'react';
import type { Task } from './TaskManager';

export interface TaskBoardColumn {
  id: string;
  title: string;
  status: Task['status'];
  color: string;
  limit?: number;
}

export interface TaskBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskReorder: (taskId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
}

interface DragState {
  draggedTask: Task | null;
  dragOverColumn: string | null;
  placeholder: { column: string; index: number } | null;
}

const DEFAULT_COLUMNS: TaskBoardColumn[] = [
  { id: 'pending', title: 'To Do', status: 'pending', color: 'bg-gray-100 border-gray-300' },
  { id: 'in-progress', title: 'In Progress', status: 'in-progress', color: 'bg-blue-100 border-blue-300' },
  { id: 'completed', title: 'Completed', status: 'completed', color: 'bg-green-100 border-green-300' },
  { id: 'cancelled', title: 'Cancelled', status: 'cancelled', color: 'bg-red-100 border-red-300' }
];

const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  onTaskUpdate,
  onTaskReorder
}) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedTask: null,
    dragOverColumn: null,
    placeholder: null
  });

  const dragCounter = useRef(0);

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', task.id);
    
    setDragState(prev => ({
      ...prev,
      draggedTask: task
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({
      draggedTask: null,
      dragOverColumn: null,
      placeholder: null
    });
    dragCounter.current = 0;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    dragCounter.current++;
    
    setDragState(prev => ({
      ...prev,
      dragOverColumn: columnId
    }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setDragState(prev => ({
        ...prev,
        dragOverColumn: null,
        placeholder: null
      }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetColumn: TaskBoardColumn) => {
    e.preventDefault();
    
    const taskId = e.dataTransfer.getData('text/html');
    const draggedTask = tasks.find(t => t.id === taskId);
    
    if (!draggedTask || draggedTask.status === targetColumn.status) {
      handleDragEnd();
      return;
    }

    // Update task status
    onTaskUpdate(taskId, { status: targetColumn.status });
    
    // Notify about reordering (simplified - in real app would calculate exact position)
    const targetTasks = tasks.filter(t => t.status === targetColumn.status);
    onTaskReorder(taskId, draggedTask.status, targetColumn.status, targetTasks.length);
    
    handleDragEnd();
  }, [tasks, onTaskUpdate, onTaskReorder, handleDragEnd]);

  const getTasksByColumn = useCallback((status: Task['status']) => {
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const formatDueDate = (dueDate: Date) => {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, task)}
      onDragEnd={handleDragEnd}
      className={`bg-white rounded-lg shadow-sm border p-3 mb-3 cursor-grab active:cursor-grabbing transition-transform hover:scale-105 ${
        dragState.draggedTask?.id === task.id ? 'opacity-50 transform rotate-2' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{task.title}</h3>
        <span className="text-lg ml-2 flex-shrink-0">{getPriorityIcon(task.priority)}</span>
      </div>
      
      <p className="text-gray-600 text-xs mb-3 line-clamp-3">{task.description}</p>
      
      <div className="space-y-2">
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          {task.assignedTo && (
            <span className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded-full mr-1 flex items-center justify-center text-white text-xs">
                {task.assignedTo.charAt(0).toUpperCase()}
              </div>
              {task.assignedTo}
            </span>
          )}
          
          {task.dueDate && (
            <span className={`font-medium ${
              task.dueDate < new Date() ? 'text-red-600' : 
              task.dueDate.getTime() - new Date().getTime() < 24 * 60 * 60 * 1000 ? 'text-orange-600' : 
              'text-gray-500'
            }`}>
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
        
        {task.estimatedHours && (
          <div className="flex items-center text-xs text-gray-500">
            <span>Est: {task.estimatedHours}h</span>
            {task.actualHours && (
              <span className="ml-2">Actual: {task.actualHours}h</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Task Board</h2>
        <p className="text-gray-600">Drag and drop tasks between columns to update their status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {DEFAULT_COLUMNS.map(column => {
          const columnTasks = getTasksByColumn(column.status);
          const isOverColumn = dragState.dragOverColumn === column.id;
          
          return (
            <div
              key={column.id}
              className={`${column.color} rounded-lg border-2 border-dashed transition-colors ${
                isOverColumn ? 'border-blue-400 bg-blue-50' : ''
              }`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
            >
              <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                {column.limit && columnTasks.length >= column.limit && (
                  <div className="mt-2 text-xs text-orange-600 font-medium">
                    ⚠️ Column limit reached ({column.limit})
                  </div>
                )}
              </div>
              
              <div className="p-4 min-h-96 space-y-3">
                {columnTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                
                {columnTasks.length === 0 && (
                  <div className="text-center text-gray-500 text-sm py-8">
                    <div className="text-2xl mb-2">📋</div>
                    <p>No tasks in {column.title.toLowerCase()}</p>
                    <p className="text-xs mt-1">Drop tasks here to move them</p>
                  </div>
                )}
                
                {isOverColumn && dragState.draggedTask && (
                  <div className="border-2 border-dashed border-blue-400 rounded-lg p-3 bg-blue-50">
                    <div className="text-center text-blue-600 text-sm">
                      Drop here to move to {column.title}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskBoard;