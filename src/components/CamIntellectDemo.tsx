// © 2025 Mark Hustad — MIT License

import React, { useEffect, useState } from 'react';
import { useCamIntellect } from '../contexts/CamIntellectContext';
import { CamIntellectNotification } from './CamIntellectNotification';
import type { Photo } from '../types';
import type { CamIntellectSuggestion, CurationRecommendation } from '../types/camintellect';

interface CamIntellectDemoProps {
  photos: Photo[];
  visible: boolean;
  onPhotoUpdate: (photo: Photo) => void;
}

export const CamIntellectDemo: React.FC<CamIntellectDemoProps> = ({ photos, visible, onPhotoUpdate }) => {
  const camIntellect = useCamIntellect();
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showDetails, setShowDetails] = useState<CamIntellectSuggestion | null>(null);
  const [selectedPhotoActions, setSelectedPhotoActions] = useState<{[photoId: string]: 'keep' | 'archive'}>({});

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
    await camIntellect.acceptSuggestion(suggestionId, photos, onPhotoUpdate);
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    console.log('[CamIntellectDemo] Rejecting suggestion:', suggestionId);
    await camIntellect.rejectSuggestion(suggestionId);
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    console.log('[CamIntellectDemo] Dismissing suggestion:', suggestionId);
    camIntellect.dismissSuggestion(suggestionId);
  };

  const handleViewDetails = (suggestion: CamIntellectSuggestion) => {
    console.log('[CamIntellectDemo] Viewing details for suggestion:', suggestion.id);
    setShowDetails(suggestion);
    
    // Initialize photo selections based on current recommendation
    const initialSelections: {[photoId: string]: 'keep' | 'archive'} = {};
    suggestion.recommendations.forEach(rec => {
      rec.keep.forEach(photo => {
        initialSelections[photo.id] = 'keep';
      });
      rec.archive.forEach(photo => {
        initialSelections[photo.id] = 'archive';
      });
    });
    setSelectedPhotoActions(initialSelections);
  };

  const handlePhotoActionChange = (photoId: string, action: 'keep' | 'archive') => {
    setSelectedPhotoActions(prev => ({
      ...prev,
      [photoId]: action
    }));
  };

  const getModifiedCounts = () => {
    const keepCount = Object.values(selectedPhotoActions).filter(action => action === 'keep').length;
    const archiveCount = Object.values(selectedPhotoActions).filter(action => action === 'archive').length;
    return { keepCount, archiveCount };
  };

  const handleApplyChanges = async () => {
    if (!showDetails) return;
    
    try {
      // Create actions based on current selections
      const actions = Object.entries(selectedPhotoActions).map(([photoId, action]) => ({
        type: action,
        photoId,
        reason: action === 'keep' ? 'User selected to keep' : 'User selected to archive'
      }));
      
      console.log('[CamIntellectDemo] Applying modified actions:', actions);
      await camIntellect.applyCurationActions(actions, photos, onPhotoUpdate);
      
      // Mark suggestion as accepted and close modal
      await camIntellect.acceptSuggestion(showDetails.id, photos, onPhotoUpdate);
      setShowDetails(null);
    } catch (error) {
      console.error('[CamIntellectDemo] Failed to apply changes:', error);
    }
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

      {/* Enhanced Details Modal with Photo Selection */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">CamIntellect Suggestion Details</h3>
              <button
                onClick={() => setShowDetails(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Message */}
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Message:</h4>
                <p className="text-gray-600 bg-blue-50 p-3 rounded">{showDetails.message}</p>
              </div>
              
              {/* Confidence & Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-800">Confidence:</h4>
                  <p className="text-gray-600 capitalize">{showDetails.confidence}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Current Selection:</h4>
                  <div className="text-sm text-gray-600">
                    <span className="text-green-600 font-medium">Keep: {getModifiedCounts().keepCount}</span>
                    {' • '}
                    <span className="text-amber-600 font-medium">Archive: {getModifiedCounts().archiveCount}</span>
                  </div>
                </div>
              </div>

              {/* Photo Selection */}
              {showDetails.recommendations.map((rec: CurationRecommendation, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-800">
                      Group: {rec.group.groupType.replace('_', ' ')} 
                      <span className="text-sm text-gray-500 ml-2">
                        ({rec.group.photos.length} photos)
                      </span>
                    </h4>
                    <div className="text-sm text-gray-600">
                      Save ~{rec.estimatedTimeSaved} minutes
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 italic">{rec.rationale}</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {rec.group.photos.map((photo: Photo) => (
                      <div key={photo.id} className="relative">
                        <div className={`border-2 rounded-lg overflow-hidden transition-all ${
                          selectedPhotoActions[photo.id] === 'keep' 
                            ? 'border-green-500 bg-green-50' 
                            : selectedPhotoActions[photo.id] === 'archive'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200'
                        }`}>
                          {photo.photo_url && photo.photo_url.startsWith('http') ? (
                            <img 
                              src={photo.photo_url} 
                              alt={`Photo ${photo.id}`}
                              className="w-full h-24 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-24 bg-gray-200 flex items-center justify-center text-gray-500 text-xs ${photo.photo_url && photo.photo_url.startsWith('http') ? 'hidden' : ''}`}>
                            <div className="text-center">
                              <div className="text-lg mb-1">📷</div>
                              <div>Photo {photo.id.slice(-4)}</div>
                            </div>
                          </div>
                          <div className="p-2">
                            <div className="flex items-center space-x-2">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`photo-${photo.id}`}
                                  value="keep"
                                  checked={selectedPhotoActions[photo.id] === 'keep'}
                                  onChange={() => handlePhotoActionChange(photo.id, 'keep')}
                                  className="text-green-600"
                                />
                                <span className="text-xs text-green-700">Keep</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`photo-${photo.id}`}
                                  value="archive"
                                  checked={selectedPhotoActions[photo.id] === 'archive'}
                                  onChange={() => handlePhotoActionChange(photo.id, 'archive')}
                                  className="text-amber-600"
                                />
                                <span className="text-xs text-amber-700">Archive</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        
                        {/* Status indicator */}
                        <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${
                          selectedPhotoActions[photo.id] === 'keep' 
                            ? 'bg-green-500' 
                            : selectedPhotoActions[photo.id] === 'archive'
                            ? 'bg-amber-500'
                            : 'bg-gray-300'
                        }`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetails(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={handleApplyChanges}
                    className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors font-medium"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};