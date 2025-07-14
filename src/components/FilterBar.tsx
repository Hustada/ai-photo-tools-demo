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
  showArchivedPhotos?: boolean;
  onToggleArchivedPhotos?: (show: boolean) => void;
  archivedCount?: number;
}


export const FilterBar: React.FC<FilterBarProps> = ({
  availableTags,
  activeTags,
  onToggleTag,
  onClearAll,
  totalPhotos,
  filteredCount,
  onRefresh,
  isRefreshing,
  showArchivedPhotos = false,
  onToggleArchivedPhotos,
  archivedCount = 0
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isTagPanelExpanded, setIsTagPanelExpanded] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  const filteredTags = availableTags.filter(tag =>
    tag.display_value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Smart tag limiting - show only first 8 tags by default on mobile
  const MAX_INITIAL_TAGS = 8;
  const shouldShowTags = searchTerm.length > 0 || isTagPanelExpanded;
  
  // Mobile logic: limit tags and show "Show More" button
  const mobileTagsToShow = showAllTags ? filteredTags : filteredTags.slice(0, MAX_INITIAL_TAGS);
  const hasMoreTagsOnMobile = filteredTags.length > MAX_INITIAL_TAGS;
  


  return (
    <div className="mb-4 p-3 border rounded-lg shadow-sm sticky top-0 z-10 backdrop-blur-sm transition-all duration-200" style={{ borderColor: '#d1d5db', backgroundColor: 'rgba(249, 250, 251, 0.95)' }}>
      {/* Compact Horizontal Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Photo Count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: '#374151' }}>Photos:</span>
          <span className="text-sm" style={{ color: '#6b7280' }}>
            <span className="font-medium" style={{ color: '#ea580c' }}>{filteredCount}</span> of {totalPhotos}
          </span>
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none transition-colors"
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#d1d5db', 
              color: '#374151'
            }}
            onFocus={(e) => e.target.style.borderColor = '#ea580c'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Browse Tags Button */}
          {!searchTerm && (
            <button
              onClick={() => setIsTagPanelExpanded(!isTagPanelExpanded)}
              className="px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium rounded-md flex items-center gap-2"
              onMouseEnter={(e) => e.target.style.borderColor = '#ea580c'}
              onMouseLeave={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              <span>Browse</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${isTagPanelExpanded ? 'rotate-180' : ''}`} 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          )}
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-300 disabled:opacity-70 transition-colors text-sm rounded-md"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          
          {/* Show Archived Photos Toggle Switch */}
          {archivedCount > 0 && onToggleArchivedPhotos && (
            <div className="flex items-center gap-3 px-3 py-2 bg-white border rounded-md" style={{ borderColor: '#d1d5db' }}>
              <span className="text-sm font-medium" style={{ color: '#374151' }}>
                Show Archived ({archivedCount})
              </span>
              <button
                onClick={() => onToggleArchivedPhotos(!showArchivedPhotos)}
                className={`relative inline-flex w-11 h-6 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  showArchivedPhotos ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                style={{
                  backgroundColor: showArchivedPhotos ? '#2563eb' : '#d1d5db'
                }}
                onMouseEnter={(e) => {
                  if (showArchivedPhotos) {
                    e.target.style.backgroundColor = '#1d4ed8';
                  } else {
                    e.target.style.backgroundColor = '#9ca3af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (showArchivedPhotos) {
                    e.target.style.backgroundColor = '#2563eb';
                  } else {
                    e.target.style.backgroundColor = '#d1d5db';
                  }
                }}
              >
                <span
                  className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform duration-200 ${
                    showArchivedPhotos ? 'translate-x-6' : 'translate-x-1'
                  }`}
                  style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
                />
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Tag buttons - only show when searching or panel is expanded */}
      {shouldShowTags && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#e5e7eb' }}>
          {/* Mobile view - with limited tags */}
          <div className="sm:hidden">
            <div className="flex flex-wrap gap-2 mb-3">
              {mobileTagsToShow.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className="px-3 py-3 text-sm font-medium border transition-all duration-200 min-h-[44px]"
                  style={{
                    backgroundColor: activeTags.includes(tag.display_value.toLowerCase()) ? '#262626' : '#FFFFFF',
                    color: activeTags.includes(tag.display_value.toLowerCase()) ? '#FFFFFF' : '#374151',
                    borderColor: activeTags.includes(tag.display_value.toLowerCase()) ? '#3f3f3f' : '#d1d5db'
                  }}
                  onMouseEnter={(e) => {
                    if (!activeTags.includes(tag.display_value.toLowerCase())) {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#ea580c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!activeTags.includes(tag.display_value.toLowerCase())) {
                      e.target.style.backgroundColor = '#FFFFFF';
                      e.target.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  {tag.display_value}
                </button>
              ))}
            </div>
            
            {/* Show More/Less button - mobile only */}
            {hasMoreTagsOnMobile && !searchTerm && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="px-4 py-2 text-sm border transition-colors"
                  style={{ 
                    color: '#9CA3AF', 
                    borderColor: '#3f3f3f',
                    '--hover-color': '#C3C3C3',
                    '--hover-border': '#6B7280'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#C3C3C3';
                    e.target.style.borderColor = '#6B7280';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#9CA3AF';
                    e.target.style.borderColor = '#3f3f3f';
                  }}
                >
                  {showAllTags ? 'Show Less' : `Show ${filteredTags.length - MAX_INITIAL_TAGS} More Tags`}
                </button>
              </div>
            )}
          </div>

          {/* Desktop view - show all tags */}
          <div className="hidden sm:block">
            <div className="flex flex-wrap gap-2">
              {filteredTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className="px-3 py-2 text-sm font-medium border transition-all duration-200"
                  style={{
                    backgroundColor: activeTags.includes(tag.display_value.toLowerCase()) ? '#262626' : '#FFFFFF',
                    color: activeTags.includes(tag.display_value.toLowerCase()) ? '#FFFFFF' : '#374151',
                    borderColor: activeTags.includes(tag.display_value.toLowerCase()) ? '#3f3f3f' : '#d1d5db'
                  }}
                  onMouseEnter={(e) => {
                    if (!activeTags.includes(tag.display_value.toLowerCase())) {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#ea580c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!activeTags.includes(tag.display_value.toLowerCase())) {
                      e.target.style.backgroundColor = '#FFFFFF';
                      e.target.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  {tag.display_value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active filters and clear */}
      {activeTags.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 mt-3 border-t gap-3" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm" style={{ color: '#9CA3AF' }}>Active:</span>
            <div className="flex flex-wrap gap-2">
              {activeTags.map(activeDisplayValue => {
                const tag = availableTags.find(t => t.display_value.toLowerCase() === activeDisplayValue.toLowerCase());
                return (
                  <span
                    key={activeDisplayValue}
                    className="inline-flex items-center gap-2 text-white px-3 py-2 text-sm border group min-h-[36px]"
                    style={{ backgroundColor: '#ea580c', borderColor: '#c2410c' }}
                  >
                    <span>{tag ? tag.display_value : activeDisplayValue}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find the tag by display value and pass its ID to onToggleTag
                        if (tag) {
                          onToggleTag(tag.id);
                        }
                      }}
                      className="hover:text-white transition-colors p-1"
                      style={{ color: '#fed7aa' }}
                      title="Remove tag"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <button
            onClick={onClearAll}
            className="text-sm text-red-600 hover:text-white border border-red-500 px-4 py-2 hover:bg-red-500 transition-all duration-200 min-h-[44px] sm:min-h-[auto]"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};