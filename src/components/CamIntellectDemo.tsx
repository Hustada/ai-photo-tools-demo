// © 2025 Mark Hustad — MIT License

import React, { useEffect, useState } from 'react';
import { useCamIntellect } from '../contexts/CamIntellectContext';
import { CamIntellectNotification } from './CamIntellectNotification';
import type { Photo } from '../types';

interface CamIntellectDemoProps {
  photos: Photo[];
  visible: boolean;
}

export const CamIntellectDemo: React.FC<CamIntellectDemoProps> = ({ photos, visible }) => {
  const camIntellect = useCamIntellect();
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showDetails, setShowDetails] = useState<any>(null);

  // Analyze photos when they become available
  useEffect(() => {
    if (photos.length >= 2 && !hasAnalyzed && visible) {
      // Delay analysis slightly to let the UI settle
      const timer = setTimeout(() => {
        console.log('[CamIntellectDemo] Starting analysis of', photos.length, 'photos');
        camIntellect.analyzeSimilarPhotos(photos);
        setHasAnalyzed(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [photos, hasAnalyzed, visible, camIntellect]);

  // Handle manual trigger for testing
  const handleManualAnalysis = () => {
    console.log('[CamIntellectDemo] Manual analysis triggered');
    setHasAnalyzed(false);
    camIntellect.analyzeSimilarPhotos(photos);
    setHasAnalyzed(true);
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    console.log('[CamIntellectDemo] Accepting suggestion:', suggestionId);
    await camIntellect.acceptSuggestion(suggestionId);
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    console.log('[CamIntellectDemo] Rejecting suggestion:', suggestionId);
    await camIntellect.rejectSuggestion(suggestionId);
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    console.log('[CamIntellectDemo] Dismissing suggestion:', suggestionId);
    camIntellect.dismissSuggestion(suggestionId);
  };

  const handleViewDetails = (suggestion: any) => {
    console.log('[CamIntellectDemo] Viewing details for suggestion:', suggestion.id);
    setShowDetails(suggestion);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Demo Controls */}
      <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">🧪 CamIntellect Demo Controls</h3>
        <div className="flex items-center space-x-4 text-sm">
          <span className="text-gray-600">
            Photos loaded: <strong>{photos.length}</strong>
          </span>
          <span className="text-gray-600">
            Suggestions: <strong>{camIntellect.suggestions.length}</strong>
          </span>
          <span className="text-gray-600">
            Status: <strong>{camIntellect.isAnalyzing ? 'Analyzing...' : 'Ready'}</strong>
          </span>
          <button
            onClick={handleManualAnalysis}
            disabled={camIntellect.isAnalyzing || photos.length < 2}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Trigger Analysis
          </button>
        </div>
        {photos.length < 2 && (
          <p className="text-amber-600 text-sm mt-2">
            💡 Load at least 2 photos to see CamIntellect suggestions
          </p>
        )}
        {camIntellect.error && (
          <p className="text-red-600 text-sm mt-2">
            ❌ Error: {camIntellect.error}
          </p>
        )}
      </div>

      {/* CamIntellect Suggestions */}
      {camIntellect.suggestions.map((suggestion) => (
        <CamIntellectNotification
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
          onDismiss={handleDismissSuggestion}
          onViewDetails={handleViewDetails}
        />
      ))}

      {/* Details Modal (Simple) */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">CamIntellect Suggestion Details</h3>
              <button
                onClick={() => setShowDetails(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800">Message:</h4>
                <p className="text-gray-600">{showDetails.message}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800">Confidence:</h4>
                <p className="text-gray-600 capitalize">{showDetails.confidence}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800">Recommendations:</h4>
                {showDetails.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded mt-2">
                    <p><strong>Group Type:</strong> {rec.group.groupType.replace('_', ' ')}</p>
                    <p><strong>Photos:</strong> {rec.group.photos.length}</p>
                    <p><strong>Keep:</strong> {rec.keep.length}</p>
                    <p><strong>Archive:</strong> {rec.archive.length}</p>
                    <p><strong>Time Saved:</strong> {rec.estimatedTimeSaved} minutes</p>
                    <p><strong>Rationale:</strong> {rec.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};