// src/components/PhotoModal.tsx
// 2025 Mark Hustad — MIT License
import React, { useState } from 'react';
import type { Photo, Tag } from '../types';
import { companyCamService } from '../services/companyCamService';

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  apiKey: string;
  onTagAdded: (photoId: string, newTag: Tag) => void;
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

const PhotoModal: React.FC<PhotoModalProps> = ({ photo, onClose, apiKey, onTagAdded }) => {
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiSuggestedDescription, setAiSuggestedDescription] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState<string | null>(null);

  const mainImageUri =
    photo.uris.find(uri => uri.type === 'web')?.uri ||
    photo.uris.find(uri => uri.type === 'original')?.uri ||
    photo.uris[0]?.uri;

  const handleFetchAiSuggestions = async () => {
    if (!mainImageUri) {
      setAiError('No image URI available to send for suggestions.');
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestedTags([]);
    setAiSuggestedDescription('');
    try {
      const response = await fetch('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: mainImageUri }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        throw new Error(
          `HTTP error! status: ${response.status}, Message: ${errorData.message || response.statusText}`
        );
      }
      const data = await response.json();
      const existingTagValues = photo.tags?.map(t => t.display_value.toLowerCase()) || [];
      const filteredSuggestions = data.suggestedTags.filter(
        (tag: string) => !existingTagValues.includes(tag.toLowerCase())
      );
      setAiSuggestedTags(filteredSuggestions);
      setAiSuggestedDescription(data.suggestedDescription || '');
    } catch (error: unknown) {
      console.error('Failed to fetch AI suggestions:', error);
      // Type guard for error message
      let message = 'An unknown error occurred while fetching suggestions.';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      }
      setAiError(message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddAiTag = async (suggestedTagValue: string) => {
    if (!apiKey) {
      setAiError('API key is missing. Cannot add tag.');
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
        onTagAdded(photo.id, targetTag);
        setAiSuggestedTags(prev => prev.filter(t => t.toLowerCase() !== suggestedTagValue.toLowerCase()));
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
      setAiError(message);
    } finally {
      setAddingTag(null);
    }
  };

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
        {/* Header / Close Button */}
        <div className="flex justify-between items-center p-3 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">{photo.description || 'Photo Details'}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none bg-transparent border-none cursor-pointer p-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Image Container with Locked Aspect Ratio */}
        <div className="w-full aspect-video overflow-hidden bg-gray-100">
          {mainImageUri ? (
            <img src={mainImageUri} alt={photo.description || 'Photo'} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">No image available</div>
          )}
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
              <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{photo.description}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">No description yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-2">Tags:</h3>
            {photo.tags && photo.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {photo.tags.map((tag) => (
                  <span key={tag.id} className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                    {tag.display_value}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No tags yet.</p>
            )}
          </div>
          
          <hr className="my-3"/>

          <div>
            <button 
              onClick={handleFetchAiSuggestions} 
              disabled={isAiLoading}
              className="w-full sm:w-auto mt-1 px-5 py-2.5 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>{isAiLoading ? 'Getting Suggestions...' : 'Get AI Suggestions'}</span>
            </button>

            {aiError && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">Error: {aiError}</p>}

            {aiSuggestedDescription && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-semibold text-gray-700 mb-1">Suggested Description:</h4>
                <p className="text-sm text-gray-600 italic">{aiSuggestedDescription}</p>
              </div>
            )}

            {aiSuggestedTags.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Suggested Tags (click + to add):</h4>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestedTags.map((tag, index) => (
                    <span key={`ai-tag-${index}`} className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {tag}
                      <button 
                        onClick={() => handleAddAiTag(tag)}
                        disabled={addingTag === tag || isAiLoading}
                        className="ml-2 p-1 leading-none text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Add tag ${tag}`}
                      >
                        {addingTag === tag ? (
                          <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v6h6a1 1 0 110 2h-6v6a1 1 0 11-2 0v-6H3a1 1 0 110-2h6V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        )}
                      </button>
                    </span>
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