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
  onAnalyze?: (mode: 'new' | 'all') => void;
  isAnalyzing?: boolean;
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
  onAnalyze,
  isAnalyzing
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'new' | 'all'>('new');
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
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
    <div className="mb-6 p-3 sm:p-4 border border-gray-600 bg-gray-800 shadow-lg -mx-5 -mt-5">
      {/* Header with photo count and refresh */}
      <div className="flex flex-col mb-4 gap-3">
        {/* Title centered on mobile, left-aligned on desktop */}
        <div className="flex items-center justify-center sm:justify-start">
          <h2 className="text-lg sm:text-xl font-medium text-white">Filter Photos</h2>
        </div>
        
        {/* Photo count and buttons - centered layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex justify-center sm:justify-start">
            <div className="text-sm text-gray-300">
              <span className="font-medium text-orange-400">{filteredCount}</span> of {totalPhotos} photos
            </div>
          </div>
          
          <div className="flex items-center justify-center sm:justify-end gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="px-3 sm:px-4 py-2 sm:py-1.5 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-orange-500 disabled:bg-gray-300 disabled:opacity-70 transition-colors text-sm min-h-[44px] sm:min-h-[auto]"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
            {onAnalyze && totalPhotos >= 2 && (
              <div className="relative">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onAnalyze(analysisMode)}
                    disabled={isAnalyzing}
                    className="px-3 sm:px-4 py-2 sm:py-1.5 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-orange-500 disabled:bg-gray-300 disabled:opacity-70 transition-colors text-sm min-h-[44px] sm:min-h-[auto]"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                  </button>
                  <button
                    onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
                    disabled={isAnalyzing}
                    className="p-2 sm:p-1.5 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-orange-500 disabled:bg-gray-300 disabled:opacity-70 transition-colors min-h-[44px] sm:min-h-[auto]"
                  >
                    <svg className="w-4 h-4 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>
                </div>
                {showAnalysisDropdown && (
                  <div className="absolute top-full mt-1 right-0 w-48 bg-gray-800 border border-gray-600 shadow-lg z-10">
                    <div className="p-2">
                      <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-700 min-h-[44px]">
                        <input
                          type="radio"
                          name="analysisMode"
                          value="new"
                          checked={analysisMode === 'new'}
                          onChange={() => setAnalysisMode('new')}
                          className="text-orange-600"
                        />
                        <span className="text-sm text-gray-300">New Photos (30 days)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-700 min-h-[44px]">
                        <input
                          type="radio"
                          name="analysisMode"
                          value="all"
                          checked={analysisMode === 'all'}
                          onChange={() => setAnalysisMode('all')}
                          className="text-orange-600"
                        />
                        <span className="text-sm text-gray-300">All Photos</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Browse Tags Button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-3 sm:py-2 bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none transition-colors text-base sm:text-sm"
          />
        </div>
        
        {/* Browse Tags Button */}
        {!searchTerm && (
          <button
            onClick={() => setIsTagPanelExpanded(!isTagPanelExpanded)}
            className="px-4 py-3 sm:py-2 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-orange-500 transition-colors text-sm font-medium min-h-[44px] sm:min-h-[auto] flex items-center justify-center gap-2"
          >
            <span>Browse Tags</span>
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isTagPanelExpanded ? 'rotate-180' : ''}`} 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
        )}
      </div>


      {/* Tag buttons - only show when searching or panel is expanded */}
      {shouldShowTags && (
        <div className="mb-4">
          {/* Mobile view - with limited tags */}
          <div className="sm:hidden">
            <div className="flex flex-wrap gap-2 mb-3">
              {mobileTagsToShow.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className={`px-3 py-3 text-sm font-medium border transition-all duration-200 min-h-[44px] ${
                    activeTags.includes(tag.display_value.toLowerCase())
                      ? 'bg-gray-800 text-white border-gray-700 shadow-md'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:border-orange-500'
                  }`}
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
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300 border border-gray-600 hover:border-gray-500 transition-colors"
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
                  className={`px-3 py-2 text-sm font-medium border transition-all duration-200 ${
                    activeTags.includes(tag.display_value.toLowerCase())
                      ? 'bg-gray-800 text-white border-gray-700 shadow-md'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:border-orange-500'
                  }`}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-gray-700 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-gray-400">Active:</span>
            <div className="flex flex-wrap gap-2">
              {activeTags.map(activeDisplayValue => {
                const tag = availableTags.find(t => t.display_value.toLowerCase() === activeDisplayValue.toLowerCase());
                return (
                  <span
                    key={activeDisplayValue}
                    className="inline-flex items-center gap-2 bg-orange-700 text-white px-3 py-2 text-sm border border-orange-600 group min-h-[36px]"
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
                      className="text-orange-200 hover:text-white transition-colors p-1"
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
            className="text-sm text-red-400 hover:text-red-300 border border-red-500 px-4 py-2 hover:bg-red-500 hover:text-white transition-all duration-200 min-h-[44px] sm:min-h-[auto]"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};