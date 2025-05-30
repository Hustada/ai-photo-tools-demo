// src/components/PhotoCard.tsx
// 2025 Mark Hustad — MIT License
import React, { useState } from 'react';
import type { Photo, Tag as CompanyCamTag } from '../types'; // Renamed Tag to CompanyCamTag for clarity

// Interface for the data expected from the AI suggestions API on success
interface AiSuggestionData {
  suggestedTags: string[];
  suggestedDescription: string;
  checklistTriggers?: string[];
  debugInfo?: any; // Optional, for backend debugging information
}

// Interface for the error data expected from the AI suggestions API on failure
interface AiSuggestionErrorData {
  message: string;
  details?: any; // Optional, for additional error details
}

// Interface for mock/local tag definitions (e.g., from mockTagsData)
interface MockTag {
  id: string; // Local/mock ID (e.g., 'mock_tag_1')
  display_value: string;
}

interface PhotoCardProps {
  photo: Photo;
  mockTagsData: MockTag[]; // Added: list of available mock tags
  onPhotoClick: (photo: Photo) => void;
  onTagClick?: (tagId: CompanyCamTag['id']) => void; // tagId is a real CompanyCam tag ID
  onAddTagToCompanyCam: (photoId: Photo['id'], tagDisplayValue: string) => Promise<void>; // Changed mockTagId to tagDisplayValue
  activeTagIds?: CompanyCamTag['id'][]; // Assumed to be real CompanyCam tag IDs for filtering
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  mockTagsData, // Destructure new prop
  onPhotoClick,
  onTagClick,
  onAddTagToCompanyCam,
  activeTagIds,
}) => {
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionData | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Find a thumbnail URI from the photo's uris array
  const thumbnailUrl = photo.uris.find((uri) => uri.type === 'thumbnail')?.uri || photo.photo_url;

  const handleSuggestAiTags = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent card click when button is clicked
    if (!photo.photo_url) { // Use photo.photo_url as per Photo type
      setAiError('Photo URL is missing for AI suggestions.');
      return;
    }
    setIsAiSuggesting(true);
    setAiError(null);
    setAiSuggestions(null); // Clear previous suggestions

    try {
      const response = await fetch('/api/suggest-ai-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Use photo.photo_url for the API call
        body: JSON.stringify({ photoUrl: photo.photo_url, userId: 'user-frontend-test' }),
      });

      if (!response.ok) {
        // Try to parse error response, default to status text if parsing fails
        let errorData: AiSuggestionErrorData = { message: `HTTP error! status: ${response.status}` };
        try {
          errorData = await response.json() as AiSuggestionErrorData;
        } catch (parseError) {
          // If response is not JSON, use status text or a generic message
          console.error('Failed to parse error response as JSON:', parseError);
        }
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as AiSuggestionData;
      setAiSuggestions(data);
    } catch (err: any) {
      console.error('Failed to fetch AI suggestions:', err);
      setAiError(err.message || 'An unknown error occurred while fetching AI suggestions.');
    }
    setIsAiSuggesting(false);
  };

  return (
    <div
      className="bg-gray-800 border border-gray-700 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-200 ease-in-out flex flex-col text-gray-300"
      onClick={() => onPhotoClick(photo)}
    >
      <div className="w-full h-48 rounded-md mb-3 bg-gray-700 flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.description || `Photo by ${photo.creator_name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-500 text-sm">No Image Available</span>
        )}
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-100 mb-1 mt-2 truncate">
          {photo.description || `Photo ID: ${photo.id}`}
        </h3>
        <p className="text-sm text-gray-400 mb-2 truncate">
          By: {photo.creator_name || 'Unknown Creator'}
        </p>
        {/* Removed address display as it's not in Photo type */}

        <div className="mt-auto pt-2 flex flex-wrap gap-2 mb-3">
          {photo.tags && Array.isArray(photo.tags) && photo.tags.length > 0 ? (
            photo.tags.map((tag: CompanyCamTag) => {
              // Ensure tag and tag.id are valid before rendering
              if (!tag || typeof tag.id !== 'string') return null;

              const isActive = activeTagIds?.includes(tag.id);
              return (
                <span
                  key={tag.id}
                  onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
                    e.stopPropagation(); // Prevent card click
                    if (onTagClick) {
                      onTagClick(tag.id);
                    }
                  }}
                  className={`px-2 py-1 rounded-full text-xs transition-colors duration-150 ease-in-out 
                    ${onTagClick ? 'cursor-pointer' : 'cursor-default'} 
                    ${isActive
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : onTagClick
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  title={onTagClick ? `Filter by: ${tag.display_value}` : tag.display_value}
                >
                  {tag.display_value}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-gray-500 italic">No tags</span>
          )}
        </div>

        {/* AI Suggestions Section */}
        <div className="mt-3 pt-3 border-t border-gray-600">
          {!aiSuggestions && (
            <button
              onClick={handleSuggestAiTags}
              disabled={isAiSuggesting}
              className="mb-2 px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors duration-150"
            >
              {isAiSuggesting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Suggesting...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3.5a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-3 0v-1A1.5 1.5 0 0110 3.5zM3.188 8.044A5.5 5.5 0 0110 4.5h.008a5.5 5.5 0 016.804 3.544l.002.005.003.005a4.502 4.502 0 01-.82 4.44l-2.67 3.523a1.5 1.5 0 01-2.331.12l-2.67-3.523a4.502 4.502 0 01-.82-4.44l.002-.005.003-.005zM10 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                  </svg>
                  Suggest AI Tags
                </>
              )}
            </button>
          )}

          {aiError && <p className="text-xs text-red-500">Error: {aiError}</p>}

          {aiSuggestions && (
            <div className="text-xs mt-2">
              <p className="font-semibold text-gray-200 mb-1">AI Suggested Description:</p>
              <p className="mb-2 text-gray-400 italic leading-relaxed">{aiSuggestions.suggestedDescription}</p>

              {aiSuggestions.suggestedTags && aiSuggestions.suggestedTags.length > 0 && (
                <>
                  <p className="font-semibold text-gray-200 mb-1">AI Suggested Tags:</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {aiSuggestions.suggestedTags.map((tagText, index) => (
                      <button
                        key={`ai-tag-${index}`}
                        onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          console.log('[PhotoCard] AI Tag clicked:', tagText, 'for photo ID:', photo.id);
                          try {
                            await onAddTagToCompanyCam(photo.id, tagText);
                            console.log(`[PhotoCard] Successfully initiated adding tag '${tagText}' to photo '${photo.id}'`);
                            // Optionally, provide user feedback here (e.g., a temporary 'adding...' state for the button)
                          } catch (error) {
                            console.error(`[PhotoCard] Error calling onAddTagToCompanyCam for tag '${tagText}':`, error);
                            // Optionally, set a local error state to display to the user
                          }
                        }}
                        className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-xs rounded-full transition-colors duration-150"
                      >
                        {tagText}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {aiSuggestions.checklistTriggers && aiSuggestions.checklistTriggers.length > 0 && (
                <>
                  <p className="font-semibold text-gray-200 mb-1">AI Checklist Triggers:</p>
                  <ul className="list-disc list-inside pl-1 text-gray-400 space-y-0.5">
                    {aiSuggestions.checklistTriggers.map((trigger, index) => (
                      <li key={`ai-trigger-${index}`}>{trigger}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
