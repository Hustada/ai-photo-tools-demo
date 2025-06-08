// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import type { ScoutAiSuggestion } from '../types/scoutai';

interface ScoutAiNotificationProps {
  suggestion: ScoutAiSuggestion;
  onAccept: (suggestionId: string) => Promise<void> | void;
  onPreview: (suggestion: ScoutAiSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  onUndo?: (suggestionId: string) => Promise<void> | void;
  executionProgress?: {
    isExecuting: boolean;
    completedActions: number;
    totalActions: number;
    currentAction?: string;
  };
}

export const ScoutAiNotification: React.FC<ScoutAiNotificationProps> = ({
  suggestion,
  onAccept,
  onPreview,
  onDismiss,
  onUndo,
  executionProgress
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculate total photos and savings across all recommendations
  const totalPhotos = suggestion.recommendations.reduce(
    (sum, rec) => sum + rec.group.photos.length,
    0
  );
  
  const totalKeep = suggestion.recommendations.reduce(
    (sum, rec) => sum + rec.keep.length,
    0
  );
  
  const totalSavings = suggestion.recommendations.reduce(
    (sum, rec) => sum + rec.estimatedTimeSaved,
    0
  );

  // Determine styling based on suggestion status
  const getStatusStyling = () => {
    switch (suggestion.status) {
      case 'accepted':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          iconColor: 'text-green-600',
          statusText: 'Accepted',
          statusColor: 'text-green-700'
        };
      case 'rejected':
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-600',
          statusText: 'Not Applied',
          statusColor: 'text-gray-700'
        };
      case 'dismissed':
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-600',
          statusText: 'Dismissed',
          statusColor: 'text-gray-700'
        };
      default:
        return {
          bgColor: 'bg-sky-50',
          borderColor: 'border-sky-200',
          iconColor: 'text-sky-600',
          statusText: null,
          statusColor: 'text-sky-700'
        };
    }
  };

  const styling = getStatusStyling();

  const getConfidenceColor = () => {
    switch (suggestion.confidence) {
      case 'high':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleAccept = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onAccept(suggestion.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptWithAnimation = async () => {
    await handleAccept();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <div
      data-testid="camintellect-notification"
      role="alert"
      aria-label={`Scout AI suggestion: ${suggestion.message}`}
      className={`
        ${styling.bgColor} ${styling.borderColor}
        border rounded-lg p-4 shadow-sm animate-fade-in
        transition-all duration-300 hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {/* Scout AI Logo/Icon */}
          <div className="flex-shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 512 512">
              <defs>
                <radialGradient id="lensGradD" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2f4b7c"/>
                  <stop offset="100%" stopColor="#00CFB4"/>
                </radialGradient>
              </defs>
              <circle cx="256" cy="256" r="200" fill="url(#lensGradD)" />
              <g stroke="#ffffff" strokeOpacity="0.6" strokeWidth="6" fill="none">
                <path d="M256,256 C300,240 350,200 350,150" />
                <path d="M256,256 C300,272 350,312 350,362" />
                <path d="M256,256 C212,272 162,312 162,362" />
                <path d="M256,256 C212,240 162,200 162,150" />
              </g>
              <circle cx="350" cy="150" r="12" fill="#009E73" />
              <circle cx="350" cy="362" r="12" fill="#009E73" />
              <circle cx="162" cy="362" r="12" fill="#009E73" />
              <circle cx="162" cy="150" r="12" fill="#009E73" />
            </svg>
          </div>
          
          {/* Brand Name */}
          <div className="flex items-center space-x-2">
            <h3 className={`font-semibold ${styling.statusColor}`}>
              Scout AI
            </h3>
            
            {/* Confidence Indicator */}
            <span
              data-testid="confidence-indicator"
              className={`
                px-2 py-1 text-xs font-medium rounded-full
                ${getConfidenceColor()}
              `}
            >
              {suggestion.confidence.charAt(0).toUpperCase() + suggestion.confidence.slice(1)} Confidence
            </span>
          </div>
        </div>

        {/* Status Badge */}
        {styling.statusText && (
          <span className={`text-sm font-medium ${styling.statusColor}`}>
            {styling.statusText}
          </span>
        )}
      </div>

      {/* Message */}
      <div className="mb-4">
        <p className="text-gray-800 leading-relaxed">
          {suggestion.message}
        </p>
      </div>

      {/* Photo Summary */}
      <div className="mb-4 p-3 bg-white rounded-md border border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            <span className="font-medium text-gray-800">{totalPhotos}</span> photos
            {totalKeep > 0 && (
              <>
                {' → Keep '}
                <span className="font-medium text-green-600">{totalKeep}</span>
              </>
            )}
          </div>
          
          {totalSavings > 0 && (
            <div className="text-gray-600">
              Save ~<span className="font-medium text-sky-600">{totalSavings}</span> minute{totalSavings > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Execution Progress */}
      {executionProgress?.isExecuting && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-800">Applying changes...</div>
              {executionProgress.currentAction && (
                <div className="text-xs text-blue-600 mt-1">{executionProgress.currentAction}</div>
              )}
            </div>
            <div className="text-sm text-blue-600">
              {executionProgress.completedActions}/{executionProgress.totalActions}
            </div>
          </div>
          <div className="mt-2 bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(executionProgress.completedActions / executionProgress.totalActions) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success Animation */}
      {showSuccess && (
        <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200 animate-pulse">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span className="text-sm font-medium text-green-800">Changes applied successfully!</span>
          </div>
        </div>
      )}

      {/* Three-Action Pattern: Accept/Preview/Dismiss */}
      {suggestion.actionable && suggestion.status === 'pending' && !executionProgress?.isExecuting && (
        <div className="flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-3">
            {/* Accept Button */}
            <button
              onClick={handleAcceptWithAnimation}
              disabled={isProcessing}
              className="
                px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md
                hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 transform hover:scale-105
                flex items-center space-x-2
              "
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span>{isProcessing ? 'Applying...' : 'Accept'}</span>
            </button>

            {/* Preview Button */}
            <button
              onClick={() => onPreview(suggestion)}
              disabled={isProcessing}
              className="
                px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 transform hover:scale-105
                flex items-center space-x-2
              "
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              <span>Preview</span>
            </button>
          </div>

          {/* Dismiss Button */}
          <button
            onClick={() => onDismiss(suggestion.id)}
            disabled={isProcessing}
            className="
              px-4 py-2 text-gray-600 text-sm font-medium rounded-md border border-gray-300
              hover:text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
              flex items-center space-x-2
            "
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span>Dismiss</span>
          </button>
        </div>
      )}

      {/* Success State Badge */}
      {suggestion.status === 'accepted' && (
        <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span className="text-sm font-medium text-green-800">Applied successfully</span>
            {onUndo && (
              <button 
                className="ml-auto text-xs text-green-600 hover:text-green-800 underline transition-colors"
                onClick={() => onUndo(suggestion.id)}
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};