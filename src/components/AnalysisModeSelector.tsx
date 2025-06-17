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
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('smart');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to 30 days ago for better coverage
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [newPhotoDays, setNewPhotoDays] = useState(30); // Default to 30 days for better coverage
  const [forceReanalysis, setForceReanalysis] = useState(false);

  // Get current filter options based on selected mode
  const getFilterOptions = (): FilterOptions => {
    const options: FilterOptions = {
      mode: selectedMode,
      forceReanalysis
    };

    switch (selectedMode) {
      case 'smart':
        options.newPhotoDays = newPhotoDays;
        break;
      case 'date-range':
        options.startDate = new Date(startDate);
        options.endDate = new Date(endDate);
        break;
      case 'selection':
        // For now, we'll handle selection mode separately
        options.selectedPhotoIds = [];
        break;
    }

    return options;
  };

  // Get estimated analysis count
  const getEstimate = () => {
    if (selectedMode === 'selection') {
      return { count: 0, description: 'Manual selection mode (not yet implemented)' };
    }
    
    const options = getFilterOptions();
    return estimateAnalysisCount(photos, options);
  };

  const estimate = getEstimate();
  const validation = selectedMode === 'selection' 
    ? { valid: false, error: 'Manual selection mode coming soon' }
    : validateFilterOptions(getFilterOptions());

  const handleAnalyze = () => {
    if (!validation.valid) return;
    
    const options = getFilterOptions();
    onAnalyze(options);
    setIsOpen(false);
  };

  const handleQuickAnalyze = () => {
    // Quick analysis with smart mode (default 30 days)
    onAnalyze({
      mode: 'smart',
      newPhotoDays: 30,
      forceReanalysis: false
    });
  };

  if (photos.length < 2) {
    return (
      <div className={className}>
        <button
          disabled
          className="px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-md cursor-not-allowed"
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
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? 'Analyzing...' : 'Trigger Analysis'}
        </button>
        
        {/* Mode Selector Dropdown Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isAnalyzing}
          className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Analysis options"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Analysis Mode</h4>
              
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="smart"
                    checked={selectedMode === 'smart'}
                    onChange={() => setSelectedMode('smart')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Smart (New photos)</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="date-range"
                    checked={selectedMode === 'date-range'}
                    onChange={() => setSelectedMode('date-range')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Date Range</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="all"
                    checked={selectedMode === 'all'}
                    onChange={() => setSelectedMode('all')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">All Photos</span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer opacity-50">
                  <input
                    type="radio"
                    name="mode"
                    value="selection"
                    checked={selectedMode === 'selection'}
                    onChange={() => setSelectedMode('selection')}
                    disabled
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Manual Selection (Coming Soon)</span>
                </label>
              </div>
            </div>

            {/* Mode-specific Options */}
            {selectedMode === 'smart' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Photo Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newPhotoDays}
                  onChange={(e) => setNewPhotoDays(parseInt(e.target.value) || 7)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Photos from the last {newPhotoDays} day{newPhotoDays === 1 ? '' : 's'}
                </p>
              </div>
            )}

            {selectedMode === 'date-range' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Force Re-analysis Option */}
            {selectedMode !== 'all' && (
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceReanalysis}
                    onChange={(e) => setForceReanalysis(e.target.checked)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Force re-analysis of all photos</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Re-analyze photos even if they've been analyzed before
                </p>
              </div>
            )}

            {/* Estimate */}
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Will analyze:</span>
                  <span className="font-medium">{estimate.count} photos</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {estimate.description}
                </div>
              </div>
            </div>

            {/* Validation Error */}
            {!validation.valid && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{validation.error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between space-x-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!validation.valid || estimate.count === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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