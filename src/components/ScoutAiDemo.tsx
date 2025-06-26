// © 2025 Mark Hustad — MIT License

import React, { useEffect, useState } from 'react';
import { useScoutAi } from '../contexts/ScoutAiContext';
import { ScoutAiNotification } from './ScoutAiNotification';
import { AnalysisModeSelector } from './AnalysisModeSelector';
import type { Photo } from '../types';
import type { ScoutAiSuggestion, CurationRecommendation } from '../types/scoutai';
import type { FilterOptions } from '../utils/photoFiltering';
import scoutAiAvatar from '../assets/scout-ai-avatar-orange2.png';

interface ScoutAiDemoProps {
  photos: Photo[];
  visible: boolean;
  onPhotoUpdate: (photo: Photo) => void;
}

export const ScoutAiDemo: React.FC<ScoutAiDemoProps> = ({ photos, visible, onPhotoUpdate }) => {
  const scoutAi = useScoutAi();
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showDetails, setShowDetails] = useState<ScoutAiSuggestion | null>(null);
  const [selectedPhotoActions, setSelectedPhotoActions] = useState<{[photoId: string]: 'keep' | 'archive'}>({});
  const [executionProgress, setExecutionProgress] = useState<{[suggestionId: string]: {
    isExecuting: boolean;
    completedActions: number;
    totalActions: number;
    currentAction?: string;
  }}>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-hide suggestions after successful actions
  useEffect(() => {
    const acceptedSuggestions = scoutAi.suggestions.filter(s => s.status === 'accepted');
    if (acceptedSuggestions.length > 0 && showSuggestions) {
      // Auto-minimize after 3 seconds when suggestions are accepted
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [scoutAi.suggestions, showSuggestions]);

  // Handle manual trigger for analysis with optional filter options
  const handleManualAnalysis = async (filterOptions?: FilterOptions) => {
    console.log('[ScoutAiDemo] Manual analysis triggered with options:', filterOptions);
    setHasAnalyzed(false);
    setShowSuggestions(true);
    setIsMinimized(false);
    
    // Analyze photos and clear existing suggestions, passing filter options
    await scoutAi.analyzeSimilarPhotos(photos, true, filterOptions);
    setHasAnalyzed(true);
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    console.log('[ScoutAiDemo] Accepting suggestion:', suggestionId);
    
    const suggestion = scoutAi.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;
    
    // Calculate total actions
    const totalActions = suggestion.recommendations.reduce(
      (sum, rec) => sum + rec.archive.length + rec.keep.length, 0
    );
    
    // Initialize progress tracking
    setExecutionProgress(prev => ({
      ...prev,
      [suggestionId]: {
        isExecuting: true,
        completedActions: 0,
        totalActions,
        currentAction: 'Starting application...'
      }
    }));
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => {
          const current = prev[suggestionId];
          if (!current || current.completedActions >= current.totalActions) {
            clearInterval(progressInterval);
            return prev;
          }
          
          return {
            ...prev,
            [suggestionId]: {
              ...current,
              completedActions: Math.min(current.completedActions + 1, current.totalActions),
              currentAction: current.completedActions < current.totalActions / 2 
                ? 'Archiving photos...' 
                : 'Organizing gallery...'
            }
          };
        });
      }, 200);
      
      await scoutAi.acceptSuggestion(suggestionId, photos, onPhotoUpdate);
      
      // Complete progress and auto-minimize after success
      setTimeout(() => {
        setExecutionProgress(prev => {
          const newState = { ...prev };
          delete newState[suggestionId];
          return newState;
        });
        // Auto-minimize the Scout AI panel after successful completion
        setTimeout(() => setIsMinimized(true), 2000);
      }, 1000);
      
    } catch (error) {
      console.error('[ScoutAiDemo] Failed to accept suggestion:', error);
      setExecutionProgress(prev => {
        const newState = { ...prev };
        delete newState[suggestionId];
        return newState;
      });
    }
  };

  const handlePreviewSuggestion = (suggestion: ScoutAiSuggestion) => {
    console.log('[ScoutAiDemo] Previewing suggestion:', suggestion.id);
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

  const handleDismissSuggestion = (suggestionId: string) => {
    console.log('[ScoutAiDemo] Dismissing suggestion:', suggestionId);
    scoutAi.dismissSuggestion(suggestionId);
  };

  const handleUndoSuggestion = async (suggestionId: string) => {
    console.log('[ScoutAiDemo] Undoing suggestion:', suggestionId);
    await scoutAi.undoLastAction(photos, onPhotoUpdate);
  };


  const handlePhotoActionChange = (photoId: string, action: 'keep' | 'archive') => {
    setSelectedPhotoActions(prev => ({
      ...prev,
      [photoId]: action
    }));
  };

  const handleSelectAllArchive = () => {
    if (!showDetails) return;
    
    const allSelections: {[photoId: string]: 'keep' | 'archive'} = {};
    showDetails.recommendations.forEach(rec => {
      rec.group.photos.forEach(photo => {
        allSelections[photo.id] = 'archive';
      });
    });
    setSelectedPhotoActions(allSelections);
  };

  const handleKeepAll = () => {
    if (!showDetails) return;
    
    const allSelections: {[photoId: string]: 'keep' | 'archive'} = {};
    showDetails.recommendations.forEach(rec => {
      rec.group.photos.forEach(photo => {
        allSelections[photo.id] = 'keep';
      });
    });
    setSelectedPhotoActions(allSelections);
  };

  const handleResetToRecommended = () => {
    if (!showDetails) return;
    
    // Reset to original Scout AI recommendations
    const initialSelections: {[photoId: string]: 'keep' | 'archive'} = {};
    showDetails.recommendations.forEach(rec => {
      rec.keep.forEach(photo => {
        initialSelections[photo.id] = 'keep';
      });
      rec.archive.forEach(photo => {
        initialSelections[photo.id] = 'archive';
      });
    });
    setSelectedPhotoActions(initialSelections);
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
      
      console.log('[ScoutAiDemo] Applying modified actions:', actions);
      await scoutAi.applyCurationActions(actions, photos, onPhotoUpdate);
      
      // Mark suggestion as accepted and close modal
      await scoutAi.acceptSuggestion(showDetails.id, photos, onPhotoUpdate);
      setShowDetails(null);
    } catch (error) {
      console.error('[ScoutAiDemo] Failed to apply changes:', error);
    }
  };

  if (!visible) {
    return null;
  }

  // Show minimized state when Scout AI is not actively being used
  if (isMinimized && !showSuggestions) {
    return (
      <div className="bg-gray-800 border border-gray-600 p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={scoutAiAvatar} 
              alt="Scout AI" 
              className="w-8 h-8 object-cover"
            />
            <div>
              <h3 className="text-sm font-medium text-white">Scout AI</h3>
              <p className="text-xs text-gray-300">Ready to analyze photos</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setIsMinimized(false);
                setShowSuggestions(false);
              }}
              className="px-3 py-1 bg-orange-600 text-white text-xs border border-orange-500 hover:bg-orange-500 transition-colors"
            >
              Analyze Photos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show suggestions only when actively triggered
  const activeSuggestions = showSuggestions ? scoutAi.suggestions.filter(s => s.status === 'pending') : [];
  const completedSuggestions = scoutAi.suggestions.filter(s => s.status === 'accepted');

  return (
    <div className="space-y-4">
      {/* Scout AI Control Panel */}
      <div className="bg-gray-800 border border-gray-600 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <img 
              src={scoutAiAvatar} 
              alt="Scout AI" 
              className="w-10 h-10 object-cover shadow-sm"
            />
            <div>
              <h3 className="text-lg font-medium text-white">Scout AI</h3>
              <p className="text-sm text-gray-300">
                {scoutAi.isAnalyzing ? (
                  scoutAi.visualSimilarity && scoutAi.visualSimilarity.state.isAnalyzing ? (
                    `AI visual analysis: ${scoutAi.visualSimilarity.state.progress}% complete`
                  ) : (
                    'Analyzing photos...'
                  )
                ) : (
                  `${photos.length} photos loaded`
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {completedSuggestions.length > 0 && (
              <div className="text-xs text-green-300 bg-green-800 border border-green-600 px-2 py-1">
                ✓ {completedSuggestions.length} applied
              </div>
            )}
            <AnalysisModeSelector
              photos={photos}
              isAnalyzing={scoutAi.isAnalyzing}
              onAnalyze={handleManualAnalysis}
            />
            {showSuggestions && activeSuggestions.length === 0 && completedSuggestions.length > 0 && (
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 text-orange-400 hover:bg-gray-700 transition-colors"
                title="Minimize Scout AI"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {photos.length < 2 && (
          <p className="text-gray-300 text-sm">
            💡 Load at least 2 photos to use Scout AI analysis
          </p>
        )}
        
        {/* Visual similarity progress bar */}
        {scoutAi.visualSimilarity && scoutAi.visualSimilarity.state.isAnalyzing && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-300">AI Visual Analysis Progress</span>
              <span className="text-xs text-orange-400 font-medium">{scoutAi.visualSimilarity.state.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 h-2">
              <div 
                className="bg-orange-600 h-2 transition-all duration-300 ease-out"
                style={{ width: `${scoutAi.visualSimilarity.state.progress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">
                {scoutAi.visualSimilarity.state.progress < 20 
                  ? 'Smart filtering for potential duplicates...'
                  : scoutAi.visualSimilarity.state.progress < 70
                  ? 'AI analyzing candidate photos...'
                  : 'Comparing visual similarities...'
                }
              </span>
              {scoutAi.visualSimilarity.cancelAnalysis && (
                <button
                  onClick={scoutAi.visualSimilarity.cancelAnalysis}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500 px-2 py-1 hover:bg-red-500 hover:text-white transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {scoutAi.error && (
          <p className="text-red-300 text-sm bg-red-900 border border-red-700 p-2 mt-2">
            ❌ Error: {scoutAi.error}
          </p>
        )}
      </div>

      {/* Active Scout AI Suggestions */}
      {activeSuggestions.map((suggestion) => (
        <ScoutAiNotification
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={handleAcceptSuggestion}
          onPreview={handlePreviewSuggestion}
          onDismiss={handleDismissSuggestion}
          onUndo={handleUndoSuggestion}
          executionProgress={executionProgress[suggestion.id]}
        />
      ))}
      
      {/* Completed Suggestions Summary (if not minimized) */}
      {!isMinimized && completedSuggestions.length > 0 && activeSuggestions.length === 0 && (
        <div className="bg-green-800 border border-green-600 p-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span className="text-sm font-medium text-green-200">
                {completedSuggestions.length} Scout AI suggestion{completedSuggestions.length > 1 ? 's' : ''} applied successfully
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-xs text-green-300 hover:text-green-100 border border-green-500 px-2 py-1 hover:bg-green-500 hover:text-white transition-all"
            >
              Minimize
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Preview Modal with Photo Selection */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-light-gray p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Preview Changes</h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Keep: {getModifiedCounts().keepCount}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span>Archive: {getModifiedCounts().archiveCount}</span>
                  </div>
                  <div className="text-blue-600 font-medium">
                    Confidence: {showDetails.confidence}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-xl p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close preview"
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
              
              {/* Bulk Selection Controls */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-800">Bulk Actions</h4>
                  <div className="text-sm text-gray-600">
                    <span className="text-green-600 font-medium">Keep: {getModifiedCounts().keepCount}</span>
                    {' • '}
                    <span className="text-amber-600 font-medium">Archive: {getModifiedCounts().archiveCount}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleKeepAll}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span>Keep All</span>
                  </button>
                  <button
                    onClick={handleSelectAllArchive}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 19l-2-2v2h2zm0-4l-2-2v2h2zm0-4L5 9v2h2zm4 8l-2-2v2h2zm0-4l-2-2v2h2zm0-4L9 9v2h2zm4 8l-2-2v2h2zm0-4l-2-2v2h2zm0-4l-2-2v2h2zm4 8l-2-2v2h2zm0-4l-2-2v2h2z"/>
                    </svg>
                    <span>Archive All</span>
                  </button>
                  <button
                    onClick={handleResetToRecommended}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span>Use AI Recommendations</span>
                  </button>
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
                          {(() => {
                            const thumbnailUrl = photo.uris.find((uri) => uri.type === 'thumbnail')?.uri 
                                              || photo.uris.find((uri) => uri.type === 'web')?.uri
                                              || photo.uris.find((uri) => uri.type === 'original')?.uri;
                            return thumbnailUrl ? (
                              <img 
                                src={thumbnailUrl} 
                                alt={`Photo ${photo.id}`}
                                className="w-full h-24 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null;
                          })()}
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
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowDetails(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600">
                    {getModifiedCounts().keepCount + getModifiedCounts().archiveCount > 0 ? (
                      <span>
                        Ready to apply <span className="font-medium text-blue-600">
                          {getModifiedCounts().keepCount + getModifiedCounts().archiveCount}
                        </span> changes
                      </span>
                    ) : (
                      <span className="text-amber-600">Select actions for photos above</span>
                    )}
                  </div>
                  <button
                    onClick={handleApplyChanges}
                    disabled={getModifiedCounts().keepCount + getModifiedCounts().archiveCount === 0}
                    className="px-6 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span>Apply Changes</span>
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