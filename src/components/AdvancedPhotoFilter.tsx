// © 2025 Mark Hustad — MIT License
// Advanced photo filtering component with multiple filter criteria

import React, { useState, useCallback } from 'react';

export interface FilterCriteria {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  fileSize: {
    min: number;
    max: number;
  };
  dimensions: {
    minWidth: number;
    minHeight: number;
  };
  tags: string[];
  searchQuery: string;
}

interface AdvancedPhotoFilterProps {
  onFiltersChange: (filters: FilterCriteria) => void;
  totalPhotos: number;
  filteredCount: number;
}

const AdvancedPhotoFilter: React.FC<AdvancedPhotoFilterProps> = ({
  onFiltersChange,
  totalPhotos,
  filteredCount
}) => {
  const [filters, setFilters] = useState<FilterCriteria>({
    dateRange: { start: null, end: null },
    fileSize: { min: 0, max: 100 }, // MB
    dimensions: { minWidth: 0, minHeight: 0 },
    tags: [],
    searchQuery: ''
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = useCallback((newFilters: Partial<FilterCriteria>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  }, [filters, onFiltersChange]);

  const resetFilters = useCallback(() => {
    const defaultFilters: FilterCriteria = {
      dateRange: { start: null, end: null },
      fileSize: { min: 0, max: 100 },
      dimensions: { minWidth: 0, minHeight: 0 },
      tags: [],
      searchQuery: ''
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  }, [onFiltersChange]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
          <div className="text-sm text-gray-500">
            {filteredCount} of {totalPhotos} photos
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={resetFilters}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg 
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Basic Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search photos..."
          value={filters.searchQuery}
          onChange={(e) => updateFilters({ searchQuery: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-6 pt-4 border-t border-gray-200">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => updateFilters({
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value ? new Date(e.target.value) : null
                  }
                })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="date"
                value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => updateFilters({
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value ? new Date(e.target.value) : null
                  }
                })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* File Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Size (MB): {filters.fileSize.min} - {filters.fileSize.max}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={filters.fileSize.min}
                onChange={(e) => updateFilters({
                  fileSize: { ...filters.fileSize, min: parseInt(e.target.value) }
                })}
                className="w-full"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={filters.fileSize.max}
                onChange={(e) => updateFilters({
                  fileSize: { ...filters.fileSize, max: parseInt(e.target.value) }
                })}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedPhotoFilter;