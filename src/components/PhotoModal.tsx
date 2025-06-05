// src/components/PhotoModal.tsx
// 2025 Mark Hustad — MIT License
import React, { useState, useEffect, useCallback } from 'react';
import type { Photo, Tag } from '../types';
import { companyCamService } from '../services/companyCamService';

import type { PhotoCardAiSuggestionState } from './PhotoCard'; // Import the shared state type

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  apiKey: string;
  onAddTagToCompanyCam: (photoId: string, tagDisplayValue: string) => void | Promise<void>;
  aiSuggestionData?: PhotoCardAiSuggestionState;
  onFetchAiSuggestions: (photoId: string, photoUrl: string, projectId?: string) => Promise<void>;
  onSaveAiDescription: (photoId: string, description: string) => Promise<void>;
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
    if (!apiKey) {
      setModalAiError('API key is missing. Cannot add tag.'); // Use modal-specific error state
      return;
    }
    setAddingTag(suggestedTagValue);
    try {
      const allCompanyCamTags = await companyCamService.listCompanyCamTags(apiKey);
      let targetTag = allCompanyCamTags.find((t: Tag) => t.display_value.toLowerCase() === suggestedTagValue.toLowerCase());
      if (!targetTag) {
        targetTag = await companyCamService.createCompanyCamTagDefinition(apiKey, suggestedTagValue);
      }
      if (targetTag) {
        await companyCamService.addTagsToPhoto(apiKey, photo.id, [targetTag.id]);
        // Call the prop from HomePage to handle tag addition, which will update CompanyCam and then local state
        await onAddTagToCompanyCam(photo.id, suggestedTagValue);
        // No longer need to manually update local aiSuggestedTags, 
        // as filteredAiSuggestedTags will re-calculate based on props and photo.tags
      } else {
        throw new Error('Failed to find or create the tag.');
      }
    } catch (error: unknown) {
      console.error(`Error adding AI tag '${suggestedTagValue}':`, error);
      // Type guard for error message
      let message = `Failed to add tag '${suggestedTagValue}'. Unknown error`;
      if (error instanceof Error) {
        message = `Failed to add tag '${suggestedTagValue}'. ${error.message}`;
      } else if (typeof error === 'string') {
        message = `Failed to add tag '${suggestedTagValue}'. ${error}`;
      }
      setModalAiError(message); // Use modal-specific error state
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

  if (!photo) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[1000]" 
      onClick={onClose} // Click on backdrop to close
    >
      <div 
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl sm:rounded-lg sm:max-h-[90vh] max-sm:h-screen max-sm:max-w-full max-sm:rounded-none"
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click from triggering when clicking on modal content
      >
        {/* Header / Counter / Close Button */}
        <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50">
          {/* Counter */}
          <div className="flex items-center">
            {totalPhotos > 0 && (
              <span className="text-sm text-gray-600">
                {currentIndex + 1} / {totalPhotos}
              </span>
            )}
          </div>

          {/* Title (Optional - can be removed if too cluttered) */}
          {/* <h2 className="text-lg font-semibold text-gray-800 truncate hidden sm:block">{photo.description || 'Photo Details'}</h2> */}

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Image Container with Navigation Arrows */}
        <div className="relative w-full aspect-video overflow-hidden bg-gray-100 group">
          {mainImageUri ? (
            <img src={mainImageUri} alt={photo.description || 'Photo'} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">No image available</div>
          )}

          {/* Previous Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onShowPreviousPhoto(); }}
            disabled={!canNavigatePrevious}
            className="absolute top-1/2 left-2 sm:left-4 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-30 hover:bg-opacity-50 text-white rounded-full disabled:opacity-0 disabled:cursor-not-allowed transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Previous photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          {/* Next Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onShowNextPhoto(); }}
            disabled={!canNavigateNext}
            className="absolute top-1/2 right-2 sm:right-4 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-30 hover:bg-opacity-50 text-white rounded-full disabled:opacity-0 disabled:cursor-not-allowed transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Next photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Scrollable Info Section */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Captured By:</span> {photo.creator_name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Captured On:</span> {formatDate(photo.captured_at)}
            </p>
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-1">Description:</h3>
            {photo.description ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{photo.description}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">No description provided.</p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-2">Tags:</h3>
            {photo.tags && photo.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {photo.tags.map((tag) => {
                  const isAiTag = tag.isAiEnhanced;
                  const tagStyle = isAiTag
                    ? 'bg-teal-100 text-teal-700 border border-teal-300'
                    : 'bg-gray-200 text-gray-700';
                  return (
                    <span key={tag.id} className={`px-3 py-1 rounded-full text-sm ${tagStyle}`}>
                      {tag.display_value}{isAiTag ? ' (AI)' : ''}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No tags yet.</p>
            )}
          </div>
          
          <hr className="my-3"/>

          <div>
            {/* Loading State for New AI Suggestions (Ephemeral) */}
            {aiSuggestionData?.isSuggesting && (
              <div className="mt-2 flex items-center justify-center text-gray-500 py-1.5">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Getting Suggestions...</span>
              </div>
            )}

            {/* Button to initiate NEW suggestions (shown if not suggesting AND (no successful new data yet OR new suggestion error)) */}
            {(!aiSuggestionData?.isSuggesting && 
                ((!aiSuggestionData?.suggestedDescription && !(aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0)) || aiSuggestionData?.suggestionError)
              ) && (
              <button 
                onClick={handleFetchAiSuggestionsFromProp} 
                className="w-full sm:w-auto mt-1 px-5 py-2.5 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                <span>Get AI Suggestions</span>
              </button>
            )}

            {/* Display error from fetching new suggestions */}
            {aiSuggestionData?.suggestionError && !aiSuggestionData?.isSuggesting && (
              <p className="text-red-500 text-sm mt-2">Error fetching suggestions: {aiSuggestionData.suggestionError}</p>
            )}
            
            {/* Display error from adding a tag (modal specific) */}
            {modalAiError && <p className="text-red-500 text-sm mt-2">Error: {modalAiError}</p>}

            {/* Editable Description Section (Unified) */}
            {!aiSuggestionData?.isSuggesting && (
              <div className="mt-3">
                <h4 className="text-md font-semibold text-gray-700 mb-1">
                  Edit Description:
                </h4>
                <textarea
                  value={editableDescription}
                  onChange={(e) => setEditableDescription(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] bg-white"
                  placeholder="Enter or edit description..."
                  rows={3}
                />
                <button
                  onClick={async () => {
                    setIsSavingDescription(true);
                    try {
                      await onSaveAiDescription(photo.id, editableDescription);
                    } catch (error) {
                      console.error('Error saving description from modal:', error);
                      // Optionally set a modal-specific error state here
                    }
                    setIsSavingDescription(false);
                  }}
                  disabled={isSavingDescription || editableDescription === (photo.description || '')}
                  className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 transition-colors text-sm"
                >
                  {isSavingDescription ? 'Saving...' : 'Save Description'}
                </button>
              </div>
            )}

            {/* Display Filtered New AI Suggested Tags */}
            {filteredAiSuggestedTags.length > 0 && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
              <div className="mt-3">
                <h4 className="text-md font-semibold text-gray-700 mb-1">AI Suggested Tags (click to add):</h4>
                <div className="flex flex-wrap gap-2">
                  {filteredAiSuggestedTags.map((tag, index) => (
                    <button
                      key={`ai-modal-tag-${index}`}
                      onClick={() => handleAddAiTag(tag)}
                      disabled={addingTag === tag}
                      className="px-3 py-1 bg-teal-500 text-white rounded-full text-sm hover:bg-teal-600 disabled:bg-gray-400 transition-colors"
                    >
                      {addingTag === tag ? 'Adding...' : tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoModal;