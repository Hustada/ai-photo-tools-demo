// src/components/PhotoCard.tsx
// 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo, Tag as CompanyCamTag } from '../types';
import { useUserContext } from '../contexts/UserContext';
import { getRetentionStatus } from '../utils/retentionCleanup';

// Interface for mock/local tag definitions (e.g., from mockTagsData)
interface MockTag {
  id: string; // Local/mock ID (e.g., 'mock_tag_1')
  display_value: string;
}

export interface PhotoCardAiSuggestionState {
  // Fields for newly generated AI suggestions
  suggestedTags: string[];         // Renamed from 'tags'
  suggestedDescription: string;  // Renamed from 'description'
  isSuggesting: boolean;         // Renamed from 'isLoading' (true when fetching NEW suggestions)
  suggestionError: string | null;  // Renamed from 'error' (error related to NEW suggestions)

  // New fields for persisted data from /api/ai-enhancements
  persistedDescription?: string;    // Optional, as it might not exist in KV store
  persistedAcceptedTags?: string[]; // Optional, might be empty or not exist in KV store
  isLoadingPersisted: boolean;      // True when fetching persisted data from KV store
  persistedError?: string | null;   // Error related to fetching persisted data
}

interface PhotoCardProps {
  photo: Photo;
  mockTagsData?: MockTag[]; // Made optional as it's not directly used in PhotoCard rendering currently
  onPhotoClick: (photo: Photo) => void;
  onTagClick?: (tagId: CompanyCamTag['id']) => void;
  onAddTagToCompanyCam: (photoId: Photo['id'], tagDisplayValue: string) => Promise<void>;
  onAddAiTag: (photoId: string, tagDisplayValue: string, photo?: Photo) => Promise<void>;
  activeTagIds?: CompanyCamTag['id'][];
  aiSuggestionData?: PhotoCardAiSuggestionState;
  onFetchAiSuggestions: (photoId: string, photoUrl: string) => Promise<void>;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  // mockTagsData, // Not directly used in PhotoCard rendering logic
  onPhotoClick,
  onTagClick,
  onAddTagToCompanyCam: _onAddTagToCompanyCam,
  onAddAiTag,
  activeTagIds,
  aiSuggestionData,
  onFetchAiSuggestions,
}) => {
  const { userSettings } = useUserContext();
  const thumbnailUrl = photo.uris.find((uri) => uri.type === 'thumbnail')?.uri || photo.photo_url;
  
  const retentionStatus = getRetentionStatus(photo, userSettings.retentionPolicy);

  const handleSuggestAiTags = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const webUri = photo.uris.find((uri) => uri.type === 'web')?.uri;
    const originalUri = photo.uris.find((uri) => uri.type === 'original')?.uri;
    const imageUrlToSend = webUri || originalUri || photo.photo_url;

    if (!imageUrlToSend) {
      console.error('A suitable photo URL could not be found for AI suggestions.');
      // HomePage will handle setting the error state via onFetchAiSuggestions callback
      return;
    }
    onFetchAiSuggestions(photo.id, imageUrlToSend);
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
        <h3 className="text-lg font-semibold text-gray-100 mb-1 mt-2 truncate" title={`Photo ID: ${photo.id}`}>
          {`Photo ID: ${photo.id}`}
        </h3>
        <p className="text-sm text-gray-400 mb-1 truncate">
          By: {photo.creator_name || 'Unknown Creator'}
        </p>

        {/* Retention Status Indicator */}
        {retentionStatus.status !== 'active' && (
          <div className="mb-2">
            {retentionStatus.status === 'archived' && retentionStatus.daysUntilDeletion && (
              <div className="flex items-center text-xs">
                <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                <span className="text-yellow-400">
                  Archived • Deletion in {retentionStatus.daysUntilDeletion} day{retentionStatus.daysUntilDeletion !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {retentionStatus.status === 'pending_deletion' && retentionStatus.daysUntilDeletion && (
              <div className="flex items-center text-xs">
                <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                <span className="text-red-400">
                  Scheduled for deletion in {retentionStatus.daysUntilDeletion} day{retentionStatus.daysUntilDeletion !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {retentionStatus.status === 'expired' && (
              <div className="flex items-center text-xs">
                <span className="inline-block w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></span>
                <span className="text-red-600 font-medium">
                  Expired • Will be removed
                </span>
              </div>
            )}
          </div>
        )}

        {photo.description && (
          <p className="text-sm text-gray-300 mt-1 mb-2 line-clamp-2" title={photo.description}>
            {photo.description}
          </p>
        )}

        <div className="mt-auto pt-2 flex flex-wrap gap-2 mb-3">
          {photo.tags && Array.isArray(photo.tags) && photo.tags.length > 0 ? (
            photo.tags.map((tag: CompanyCamTag) => {
              if (!tag || typeof tag.id !== 'string') return null;
              const isActive = activeTagIds?.includes(tag.id);
              return (
                <span
                  key={tag.id}
                  onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
                    e.stopPropagation();
                    if (onTagClick) {
                      onTagClick(tag.id);
                    }
                  }}
                  className={`px-2 py-1 rounded-full text-xs transition-colors duration-150 ease-in-out 
                    ${onTagClick ? 'cursor-pointer' : 'cursor-default'} 
                    ${tag.isAiEnhanced
                      ? isActive
                        ? 'bg-teal-500 text-white hover:bg-teal-600' // AI tag + Active filter
                        : 'bg-teal-600 text-teal-100 hover:bg-teal-500' // AI tag (not active filter)
                      : isActive
                        ? 'bg-blue-500 text-white hover:bg-blue-600' // Normal tag + Active filter
                        : onTagClick
                          ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' // Normal tag (not active filter, clickable)
                          : 'bg-gray-700 text-gray-400' // Normal tag (not active filter, not clickable)
                    }`}
                  title={onTagClick ? `Filter by: ${tag.display_value}${tag.isAiEnhanced ? ' (AI)' : ''}` : `${tag.display_value}${tag.isAiEnhanced ? ' (AI)' : ''}`}
                >
                  {tag.display_value}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-gray-500 italic">No tags</span>
          )}
        </div>

        {/* AI Suggestions Section (for NEW, ephemeral suggestions) */}
        <div className="mt-3 pt-3 border-t border-gray-600">
          {/* Loading State for New Suggestions */}
          {aiSuggestionData?.isSuggesting && (
            <div className="mt-2 flex items-center justify-center text-gray-300 py-1.5">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Suggesting...</span>
            </div>
          )}

          {/* Button to initiate NEW suggestions (shown if not suggesting AND (no successful new data yet OR new suggestion error)) */}
          {!aiSuggestionData?.isSuggesting && 
            ((!aiSuggestionData?.suggestedDescription && !(aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0)) || aiSuggestionData?.suggestionError) && (
            <div className="flex justify-center">
              <button
              onClick={handleSuggestAiTags}
              className="mt-2 px-6 py-2.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center space-x-1.5 transition-colors duration-150 ease-in-out group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3.5a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-3 0v-1A1.5 1.5 0 0110 3.5zM3.188 8.044A5.5 5.5 0 0110 4.5h.008a5.5 5.5 0 016.804 3.544l.002.005.003.005a4.502 4.502 0 01-.82 4.44l-2.67 3.523a1.5 1.5 0 01-2.331.12l-2.67-3.523a4.502 4.502 0 01-.82-4.44l.002-.005.003-.005zM10 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              </svg>
              <span>Suggest AI Tags</span>
            </button>
            </div>
          )}

          {/* Error for New Suggestions */}
          {aiSuggestionData?.suggestionError && !aiSuggestionData?.isSuggesting && (
            <p className="mt-2 text-xs text-red-500">Error: {aiSuggestionData.suggestionError}</p>
          )}

          {/* Display New Suggested Description */}
          {aiSuggestionData?.suggestedDescription && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
            <div className="mt-2 py-2"> {/* Added py-2 for vertical padding */}
              <p className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-300 dark:text-gray-200 mr-1">AI Suggested Description:
              <span className="text-gray-400 dark:text-gray-100 ml-1">
                  {aiSuggestionData.suggestedDescription}
              </span>
              </span>
              </p>
            </div>
          )}

          {/* Divider between New description and New tags */}
          {aiSuggestionData?.suggestedDescription && aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0 && !aiSuggestionData.isSuggesting && !aiSuggestionData.suggestionError && (
            <hr className="my-3 border-gray-600" />
          )}

          {/* Display New Suggested Tags */}
          {aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0 && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
            <div className="mt-2 py-2"> {/* Added py-2 for vertical padding */}
              <p className="text-xs font-semibold text-gray-300 dark:text-gray-200 mb-1">AI Suggested Tags:</p>
              <div className="flex flex-wrap gap-1">
                {aiSuggestionData.suggestedTags.map((tag: string, index: number) => (
                  <button
                    key={`ai-tag-${index}`}
                    onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      try {
                        await onAddAiTag(photo.id, tag, photo);
                      } catch (err) {
                        console.error(`[PhotoCard] Error calling onAddAiTag for tag '${tag}':`, err);
                      }
                    }}
                    className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-xs rounded-full transition-colors duration-150"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
