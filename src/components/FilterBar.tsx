import React, { useState } from 'react';
import type { Tag } from '../types/api';

interface FilterBarProps {
  availableTags: Tag[];
  activeTags: string[];
  onToggleTag: (tagId: string) => void;
  onClearAll: () => void;
  totalPhotos: number;
  filteredCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

type FilterMode = 'AND' | 'OR';

export const FilterBar: React.FC<FilterBarProps> = ({
  availableTags,
  activeTags,
  onToggleTag,
  onClearAll,
  totalPhotos,
  filteredCount,
  onRefresh,
  isRefreshing
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('OR');

  const filteredTags = availableTags.filter(tag =>
    tag.display_value.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="mb-6 p-4 border border-gray-600 bg-gray-800 shadow-lg -mx-5 -mt-5">
      {/* Header with photo count and refresh */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-white">Filter Photos</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-300">
            <span className="font-medium text-orange-400">{filteredCount}</span> of {totalPhotos} photos
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-4 py-1.5 bg-sky-600 text-white border border-sky-500 hover:bg-sky-500 disabled:bg-gray-600 disabled:opacity-70 transition-colors text-sm"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Search and controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>
        
        {/* AND/OR Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('OR')}
            className={`px-6 py-2 text-sm font-medium border transition-colors ${
              filterMode === 'OR'
                ? 'bg-orange-600 text-white border-orange-500'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:text-white hover:border-orange-500'
            }`}
          >
            OR
          </button>
          <button
            onClick={() => setFilterMode('AND')}
            className={`px-6 py-2 text-sm font-medium border transition-colors ${
              filterMode === 'AND'
                ? 'bg-orange-600 text-white border-orange-500'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:text-white hover:border-orange-500'
            }`}
          >
            AND
          </button>
        </div>
      </div>

      {/* Tag buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filteredTags.map(tag => (
          <button
            key={tag.id}
            onClick={() => onToggleTag(tag.id)}
            className={`px-3 py-2 text-sm font-medium border transition-all duration-200 ${
              activeTags.includes(tag.id)
                ? 'bg-orange-600 border-orange-500 text-white shadow-md'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-500 hover:bg-gray-700'
            }`}
          >
            {tag.display_value}
          </button>
        ))}
      </div>

      {/* Active filters and clear */}
      {activeTags.length > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Active:</span>
            <div className="flex flex-wrap gap-1">
              {activeTags.map(tagId => {
                const tag = availableTags.find(t => t.id === tagId);
                return (
                  <span
                    key={tagId}
                    className="inline-block bg-orange-700 text-white px-2 py-1 text-xs border border-orange-600"
                  >
                    {tag ? tag.display_value : tagId}
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={onClearAll}
            className="text-sm text-red-400 hover:text-red-300 border border-red-500 px-3 py-1 hover:bg-red-500 hover:text-white transition-all duration-200"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};