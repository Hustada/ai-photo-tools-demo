// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import type { CamIntellectSuggestion } from '../types/camintellect';

interface CamIntellectNotificationProps {
  suggestion: CamIntellectSuggestion;
  onAccept: (suggestionId: string) => Promise<void> | void;
  onReject: (suggestionId: string) => Promise<void> | void;
  onDismiss: (suggestionId: string) => void;
  onViewDetails: (suggestion: CamIntellectSuggestion) => void;
}

export const CamIntellectNotification: React.FC<CamIntellectNotificationProps> = ({
  suggestion,
  onAccept,
  onReject,
  onDismiss,
  onViewDetails
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleReject = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onReject(suggestion.id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      data-testid="camintellect-notification"
      role="alert"
      aria-label={`CamIntellect suggestion: ${suggestion.message}`}
      className={`
        ${styling.bgColor} ${styling.borderColor}
        border rounded-lg p-4 shadow-sm animate-fade-in
        transition-all duration-300 hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {/* CamIntellect Logo/Icon */}
          <div className={`${styling.iconColor} flex-shrink-0`}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          
          {/* Brand Name */}
          <div className="flex items-center space-x-2">
            <h3 className={`font-semibold ${styling.statusColor}`}>
              CamIntellect
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

      {/* Action Buttons */}
      {suggestion.actionable && suggestion.status === 'pending' && (
        <div className="flex items-center space-x-3">
          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="
              px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md
              hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            "
          >
            {isProcessing ? 'Processing...' : 'Accept'}
          </button>

          {/* View Details Button */}
          <button
            onClick={() => onViewDetails(suggestion)}
            disabled={isProcessing}
            className="
              px-4 py-2 bg-white text-sky-600 text-sm font-medium rounded-md border border-sky-200
              hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            "
          >
            View Details
          </button>

          {/* Not Now Button */}
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="
              px-3 py-2 text-gray-600 text-sm font-medium rounded-md
              hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            "
          >
            Not Now
          </button>

          {/* Dismiss Button */}
          <button
            onClick={() => onDismiss(suggestion.id)}
            disabled={isProcessing}
            className="
              ml-auto p-2 text-gray-400 rounded-md
              hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            "
            aria-label="Dismiss suggestion"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="text-gray-600 text-sm font-medium">
            Processing...
          </div>
        </div>
      )}
    </div>
  );
};