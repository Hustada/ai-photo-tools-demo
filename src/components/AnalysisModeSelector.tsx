// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import type { Photo } from '../types';
import type { AnalysisMode, FilterOptions } from '../utils/photoFiltering';
import { estimateAnalysisCount, validateFilterOptions } from '../utils/photoFiltering';

interface AnalysisModeSelectorProps {
  photos: Photo[];
  isAnalyzing: boolean;
  onAnalyze: (filterOptions?: FilterOptions) => void;
  className?: string;
}

export const AnalysisModeSelector: React.FC<AnalysisModeSelectorProps> = ({
  photos,
  isAnalyzing,
  onAnalyze,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'new' | 'all'>('new');

  // Get current filter options based on selected mode
  const getFilterOptions = (): FilterOptions => {
    return selectedMode === 'new' 
      ? { mode: 'smart', newPhotoDays: 30, forceReanalysis: false }
      : { mode: 'all', forceReanalysis: false };
  };

  // Get estimated analysis count
  const getEstimate = () => {
    const options = getFilterOptions();
    return estimateAnalysisCount(photos, options);
  };

  const estimate = getEstimate();
  const validation = validateFilterOptions(getFilterOptions());

  const handleAnalyze = () => {
    if (!validation.valid) return;
    
    const options = getFilterOptions();
    onAnalyze(options);
    setIsOpen(false);
  };

  const handleQuickAnalyze = () => {
    onAnalyze(getFilterOptions());
  };

  if (photos.length < 2) {
    return (
      <div className={className}>
        <button
          disabled
          className="px-4 py-2 bg-gray-700 text-gray-400 text-sm font-medium border border-gray-600 cursor-not-allowed"
        >
          Need 2+ Photos
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Analysis Button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleQuickAnalyze}
          disabled={isAnalyzing}
          className="px-4 py-2 bg-orange-600 text-white text-sm font-medium border border-orange-500 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? 'Analyzing...' : 'Trigger Analysis'}
        </button>
        
        {/* Mode Selector Dropdown Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isAnalyzing}
          className="p-2 bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Analysis options"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-gray-800 border border-gray-600 shadow-lg z-10">
          <div className="p-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2">Analysis Mode</h4>
              
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="new"
                    checked={selectedMode === 'new'}
                    onChange={() => setSelectedMode('new')}
                    className="text-orange-600"
                  />
                  <span className="text-sm text-gray-300">New Photos (Last 30 days)</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="all"
                    checked={selectedMode === 'all'}
                    onChange={() => setSelectedMode('all')}
                    className="text-orange-600"
                  />
                  <span className="text-sm text-gray-300">All Photos</span>
                </label>
              </div>
            </div>


            {/* Estimate */}
            <div className="mb-4 p-3 bg-gray-700 border border-gray-600">
              <div className="text-sm text-gray-300">
                <div className="flex items-center justify-between">
                  <span>Will analyze:</span>
                  <span className="font-medium">{estimate.count} photos</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {estimate.description}
                </div>
              </div>
            </div>

            {/* Validation Error */}
            {!validation.valid && (
              <div className="mb-4 p-2 bg-red-900 border border-red-700">
                <p className="text-sm text-red-300">{validation.error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between space-x-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 text-gray-300 border border-gray-600 hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!validation.valid || estimate.count === 0}
                className="px-4 py-2 bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Analyze {estimate.count} Photos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};