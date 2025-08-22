// src/components/PhotoModal.tsx
// 2025 Mark Hustad — MIT License
import React, { useState, useEffect, useCallback } from 'react';
import type { Photo } from '../types';
import { useScoutAiFeedback } from '../hooks/useScoutAiFeedback';

import type { PhotoCardAiSuggestionState } from './PhotoCard'; // Import the shared state type

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  apiKey: string;
  onAddTagToCompanyCam: (photoId: string, tagDisplayValue: string) => void | Promise<void>;
  onAddAiTag: (photoId: string, tagDisplayValue: string, photo?: Photo) => Promise<void>;
  onRemoveTag?: (photoId: string, tagId: string) => Promise<void>;
  aiSuggestionData?: PhotoCardAiSuggestionState;
  onFetchAiSuggestions: (photoId: string, photoUrl: string, projectId?: string) => Promise<void>;
  onSaveAiDescription: (photoId: string, description: string, photo?: Photo) => Promise<void>;
  // Navigation props
  onShowNextPhoto: () => void;
  onShowPreviousPhoto: () => void;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
  currentIndex: number;
  totalPhotos: number;
}

const formatDate = (timestamp: number): string => {
  if (!timestamp && timestamp !== 0) return 'N/A'; // Handle 0 as a potentially valid timestamp
  try {
    const date = new Date(timestamp);
    // Check if the date is valid after creation from timestamp
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (e) {
    // This catch might be redundant if new Date(timestamp) doesn't throw for invalid numbers but returns Invalid Date
    console.error('Error formatting date:', e);
    return 'Invalid Date';
  }
};

const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  onClose,
  apiKey,
  onAddTagToCompanyCam,
  onAddAiTag,
  onRemoveTag,
  aiSuggestionData,
  onFetchAiSuggestions,
  onSaveAiDescription,
  onShowNextPhoto,
  onShowPreviousPhoto,
  canNavigateNext,
  canNavigatePrevious,
  currentIndex,
  totalPhotos,
}) => {
  // Local state for 'addingTag' can remain if its UX is specific to the modal
  const [addingTag, setAddingTag] = useState<string | null>(null);
  // aiError specific to the modal's add tag operation can also remain if distinct from fetch errors
  const [modalAiError, setModalAiError] = useState<string | null>(null);
  const [editableDescription, setEditableDescription] = useState<string>('');
  const [isSavingDescription, setIsSavingDescription] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [imageTransition, setImageTransition] = useState<boolean>(false);
  
  // Initialize feedback hook
  const { submitPositiveFeedback, submitEditFeedback } = useScoutAiFeedback();

  useEffect(() => {
    if (photo.description) {
      setEditableDescription(photo.description);
    } else if (aiSuggestionData?.suggestedDescription) {
      // If there's an active new suggestion, prioritize it for editing if main description is empty
      setEditableDescription(aiSuggestionData.suggestedDescription);
    } else {
      setEditableDescription(''); // Default to empty
    }
  }, [photo.id, photo.description, aiSuggestionData?.suggestedDescription]);

  const mainImageUri =
    photo.uris.find(uri => uri.type === 'web')?.uri ||
    photo.uris.find(uri => uri.type === 'original')?.uri ||
    photo.uris[0]?.uri;

  const handleFetchAiSuggestionsFromProp = async () => {
    if (!mainImageUri) {
      // HomePage will set the error via onFetchAiSuggestions if photoUrl is missing
      // but good to have a local check too for immediate feedback if needed.
      console.error('[PhotoModal] No image URI available for suggestions.');
      // Optionally, set a specific modal error or rely on HomePage's error handling
      return;
    }
    onFetchAiSuggestions(photo.id, mainImageUri, photo.project_id);
  };

  // Filter AI suggested tags to exclude already existing tags on the photo
  const existingTagValues = photo.tags?.map(t => t.display_value.toLowerCase()) || [];
  const filteredAiSuggestedTags = aiSuggestionData?.suggestedTags?.filter(
    (tag: string) => !existingTagValues.includes(tag.toLowerCase())
  ) || [];

  const handleAddAiTag = async (suggestedTagValue: string) => {
    setAddingTag(suggestedTagValue);
    setModalAiError(null);
    try {
      await onAddAiTag(photo.id, suggestedTagValue, photo);
      
      // Submit positive feedback when user accepts an AI suggested tag
      submitPositiveFeedback(
        `tag-${photo.id}-${suggestedTagValue}`,
        'tag',
        {
          photoId: photo.id,
          tagValue: suggestedTagValue,
          projectId: photo.project_id,
        }
      );
    } catch (error: unknown) {
      console.error(`[PhotoModal] Error adding AI tag '${suggestedTagValue}':`, error);
      // Type guard for error message
      let message = `Failed to add tag '${suggestedTagValue}'. Unknown error`;
      if (error instanceof Error) {
        message = `Failed to add tag '${suggestedTagValue}'. ${error.message}`;
      } else if (typeof error === 'string') {
        message = `Failed to add tag '${suggestedTagValue}'. ${error}`;
      }
      setModalAiError(message);
    } finally {
      setAddingTag(null);
    }
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
    if (event.key === 'ArrowRight' && canNavigateNext) {
      onShowNextPhoto();
    }
    if (event.key === 'ArrowLeft' && canNavigatePrevious) {
      onShowPreviousPhoto();
    }
  }, [onClose, canNavigateNext, onShowNextPhoto, canNavigatePrevious, onShowPreviousPhoto]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handle image transitions
  useEffect(() => {
    setImageTransition(true);
    setImageLoading(true);
    const timer = setTimeout(() => setImageTransition(false), 150);
    return () => clearTimeout(timer);
  }, [photo.id]);

  if (!photo) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[1000] animate-fadeIn" 
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full sm:h-[92vh] sm:max-w-[92vw] flex flex-col sm:flex-row overflow-hidden bg-black sm:rounded-2xl shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 sm:p-6 bg-gradient-to-b from-black/70 to-transparent">
          {/* Counter Badge and Keyboard Hint */}
          <div className="flex items-center gap-3">
            {totalPhotos > 0 && (
              <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <span className="text-sm font-medium text-white">
                  {currentIndex + 1} / {totalPhotos}
                </span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 text-white/60 text-xs">
              <span>Use</span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-white/80">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-white/80">→</kbd>
              <span>to navigate</span>
            </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="p-2.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 transition-all duration-200 group"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Image Container - Takes up most space */}
        <div className="relative flex-1 sm:flex-[2] bg-black flex items-center justify-center group overflow-hidden">
          {/* Loading State */}
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Main Image */}
          {mainImageUri ? (
            <img 
              src={mainImageUri} 
              alt={photo.description || 'Photo'} 
              className={`max-w-full max-h-full object-contain transition-all duration-500 ${imageTransition ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>No image available</span>
            </div>
          )}

          {/* Previous Button - Glassmorphism style */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              setImageTransition(true);
              setTimeout(() => {
                onShowPreviousPhoto();
                setImageTransition(false);
              }, 150);
            }}
            disabled={!canNavigatePrevious}
            className="absolute top-1/2 left-4 sm:left-6 transform -translate-y-1/2 z-10 p-3 sm:p-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full disabled:opacity-0 disabled:cursor-not-allowed transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:scale-110 active:scale-95"
            aria-label="Previous photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next Button - Glassmorphism style */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              setImageTransition(true);
              setTimeout(() => {
                onShowNextPhoto();
                setImageTransition(false);
              }, 150);
            }}
            disabled={!canNavigateNext}
            className="absolute top-1/2 right-4 sm:right-6 transform -translate-y-1/2 z-10 p-3 sm:p-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full disabled:opacity-0 disabled:cursor-not-allowed transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:scale-110 active:scale-95"
            aria-label="Next photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Info Panel - Side panel on desktop, bottom sheet on mobile */}
        <div className="w-full sm:w-[400px] bg-white sm:bg-gray-50 h-auto sm:h-full overflow-hidden flex flex-col animate-slideInRight">
          {/* Info Panel Header - Mobile only */}
          <div className="sm:hidden bg-gradient-to-r from-orange-500 to-gray-800 p-4">
            <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-3"></div>
            <h3 className="text-white font-semibold text-center">Photo Details</h3>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Photo Info Card */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">{photo.creator_name}</span>
              </div>
              <p className="text-xs text-gray-500 pl-10">
                {formatDate(photo.captured_at)}
              </p>
            </div>

            {/* Description Section */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Description
              </h3>
              {photo.description ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{photo.description}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No description provided</p>
              )}
            </div>

            {/* Tags Section */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tags
              </h3>
              {photo.tags && photo.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photo.tags.map((tag) => {
                    const isAiTag = tag.isAiEnhanced;
                    return (
                      <span key={tag.id} className="relative inline-block group">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 inline-block ${
                          isAiTag ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {tag.display_value}
                          {isAiTag && (
                            <span className="ml-1 text-purple-500">✨</span>
                          )}
                        </span>
                        {onRemoveTag && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onRemoveTag(photo.id, tag.id);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-xs shadow-md"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No tags yet</p>
              )}
            </div>

            {/* Loading State for New AI Suggestions (Ephemeral) */}
            {aiSuggestionData?.isSuggesting && (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600">Getting AI suggestions...</span>
                </div>
              )}

            {/* AI Suggestions Card */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Suggestions
              </h3>
              
              {/* AI Suggestions Button */}
              {(!aiSuggestionData?.isSuggesting && 
                  ((!aiSuggestionData?.suggestedDescription && !(aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0)) || aiSuggestionData?.suggestionError)
                ) && (
                <button 
                  onClick={handleFetchAiSuggestionsFromProp} 
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-gray-800 hover:from-orange-600 hover:via-orange-700 hover:to-gray-900 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7V12C2 17 6.5 21.16 12 22C17.5 21.16 22 17 22 12V7L12 2Z" fill="currentColor" fillOpacity="0.9"/>
                    <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm">Get AI Suggestions</span>
                </button>
              )}

              {/* Display error from fetching new suggestions */}
              {aiSuggestionData?.suggestionError && !aiSuggestionData?.isSuggesting && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs text-red-600">Error: {aiSuggestionData.suggestionError}</p>
                </div>
              )}
              
              {/* Display error from adding a tag (modal specific) */}
              {modalAiError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs text-red-600">{modalAiError}</p>
                </div>
              )}

              {/* Editable Description Section (Unified) */}
              {!aiSuggestionData?.isSuggesting && aiSuggestionData?.suggestedDescription && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Suggested Description:
                  </h4>
                  <textarea
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-sm min-h-[60px] focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all duration-200 bg-gray-50"
                    placeholder="Edit suggested description..."
                    rows={2}
                  />
                  <button
                    onClick={async () => {
                      setIsSavingDescription(true);
                      try {
                        await onSaveAiDescription(photo.id, editableDescription, photo);
                        
                        // If the description was edited from an AI suggestion, submit edit feedback
                        if (aiSuggestionData?.suggestedDescription && 
                            editableDescription !== aiSuggestionData.suggestedDescription &&
                            editableDescription !== photo.description) {
                          submitEditFeedback(
                            `description-${photo.id}`,
                            'description',
                            editableDescription,
                            {
                              photoId: photo.id,
                              originalSuggestion: aiSuggestionData.suggestedDescription,
                              projectId: photo.project_id,
                            }
                          );
                        }
                      } catch (error) {
                        console.error('Error saving description from modal:', error);
                      }
                      setIsSavingDescription(false);
                    }}
                    disabled={isSavingDescription || editableDescription === (photo.description || '')}
                    className="mt-2 px-3 py-1.5 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-sm rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingDescription ? 'Saving...' : 'Save Description'}
                  </button>
                </div>
              )}

              {/* Display Filtered New AI Suggested Tags */}
              {filteredAiSuggestedTags.length > 0 && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Tags:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredAiSuggestedTags.map((tag, index) => (
                      <button
                        key={`ai-modal-tag-${index}`}
                        onClick={() => handleAddAiTag(tag)}
                        disabled={addingTag === tag}
                        className="px-2.5 py-1 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-xs rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addingTag === tag ? 'Adding...' : `+ ${tag}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoModal;