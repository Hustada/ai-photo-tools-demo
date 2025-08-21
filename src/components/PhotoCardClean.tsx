// src/components/PhotoCardClean.tsx
// 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo, Tag as CompanyCamTag } from '../types';
import { useUserContext } from '../contexts/UserContext';

interface MockTag {
  id: string;
  display_value: string;
}

export interface PhotoCardAiSuggestionState {
  suggestedTags: string[];
  suggestedDescription: string;
  isSuggesting: boolean;
  suggestionError: string | null;
  persistedDescription?: string;
  persistedAcceptedTags?: string[];
  isLoadingPersisted: boolean;
  persistedError?: string | null;
}

interface PhotoCardProps {
  photo: Photo;
  mockTagsData?: MockTag[];
  onPhotoClick: (photo: Photo) => void;
  onTagClick?: (tagId: CompanyCamTag['id']) => void;
  onAddTagToCompanyCam: (photoId: Photo['id'], tagDisplayValue: string) => Promise<void>;
  onAddAiTag: (photoId: string, tagDisplayValue: string, photo?: Photo) => Promise<void>;
  onRemoveTag?: (photoId: string, tagId: string) => Promise<void>;
  activeTagIds?: CompanyCamTag['id'][];
  aiSuggestionData?: PhotoCardAiSuggestionState;
  onFetchAiSuggestions: (photoId: string, photoUrl: string) => Promise<void>;
  onUnarchivePhoto?: (photoId: string) => void;
}

const PhotoCardClean: React.FC<PhotoCardProps> = ({
  photo,
  onPhotoClick,
  onTagClick,
  onAddAiTag,
  onRemoveTag,
  activeTagIds,
  aiSuggestionData,
  onFetchAiSuggestions,
  onUnarchivePhoto,
}) => {
  const { userSettings } = useUserContext();
  const thumbnailUrl = photo.uris.find((uri) => uri.type === 'thumbnail')?.uri 
                    || photo.uris.find((uri) => uri.type === 'web')?.uri
                    || photo.uris.find((uri) => uri.type === 'original')?.uri;
  
  const handleSuggestAiTags = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const webUri = photo.uris.find((uri) => uri.type === 'web')?.uri;
    const originalUri = photo.uris.find((uri) => uri.type === 'original')?.uri;
    const imageUrlToSend = webUri || originalUri || photo.photo_url;

    if (!imageUrlToSend) {
      console.error('A suitable photo URL could not be found for AI suggestions.');
      return;
    }
    onFetchAiSuggestions(photo.id, imageUrlToSend);
  };

  const isArchived = photo.archive_state === 'archived';
  
  // Check if we have AI suggestions to display
  const hasAiSuggestions = aiSuggestionData && (
    (aiSuggestionData.suggestedDescription && aiSuggestionData.suggestedDescription.trim()) ||
    (aiSuggestionData.suggestedTags && aiSuggestionData.suggestedTags.some(tag => tag.trim()))
  );

  return (
    <div className="group relative h-full flex flex-col bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
      {/* Card Container with fixed structure */}
      <div
        className={`flex flex-col h-full cursor-pointer ${isArchived ? 'opacity-70' : ''}`}
        onClick={() => onPhotoClick(photo)}
      >
        {/* Archived Badge */}
        {isArchived && (
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
            <span className="bg-red-500 text-white px-2 py-1 text-xs font-bold rounded">
              ARCHIVED
            </span>
            {onUnarchivePhoto && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchivePhoto(photo.id);
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-xs font-bold rounded transition-colors"
              >
                RESTORE
              </button>
            )}
          </div>
        )}

        {/* Image Container - 16:9 aspect ratio */}
        <div className="relative aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={photo.description || `Photo by ${photo.creator_name}`}
              className={`w-full h-full object-cover ${isArchived ? 'grayscale' : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col p-3">
          {/* Creator & Description */}
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {photo.creator_name || 'Unknown'}
            </h3>
            {photo.description && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {photo.description}
              </p>
            )}
          </div>

          {/* Tags Container - Scrollable if needed */}
          <div className="flex-1 min-h-[32px]">
            {photo.tags && photo.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {photo.tags.map((tag: CompanyCamTag) => {
                  if (!tag) return null;
                  const isActive = activeTagIds?.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTagClick) onTagClick(tag.id);
                      }}
                      className={`
                        px-2 py-0.5 text-xs rounded-full transition-all
                        ${tag.isAiEnhanced ? 'ring-1 ring-purple-300' : ''}
                        ${isActive 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {tag.display_value}
                      {onRemoveTag && (
                        <span
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onRemoveTag(photo.id, tag.id);
                          }}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">No tags</span>
            )}
          </div>
        </div>

        {/* AI Button - Fixed at bottom */}
        <div className="border-t border-gray-100">
          {aiSuggestionData?.isSuggesting ? (
            <div className="h-11 bg-orange-500 flex items-center justify-center text-white text-xs font-medium">
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </div>
          ) : (
            <button
              onClick={handleSuggestAiTags}
              className="w-full h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs font-medium transition-colors rounded-b-lg flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Suggest AI Tags
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestions Overlay - Appears below card */}
      {hasAiSuggestions && !aiSuggestionData.isSuggesting && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {aiSuggestionData.suggestedDescription?.trim() && (
            <div className="mb-2">
              <p className="text-xs">
                <span className="font-medium text-gray-700">Description: </span>
                <span className="text-gray-600">{aiSuggestionData.suggestedDescription}</span>
              </p>
            </div>
          )}
          
          {aiSuggestionData.suggestedTags?.filter(tag => tag.trim()).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Add Tags:</p>
              <div className="flex flex-wrap gap-1">
                {aiSuggestionData.suggestedTags.filter(tag => tag.trim()).map((tag, index) => (
                  <button
                    key={index}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onAddAiTag(photo.id, tag, photo);
                    }}
                    className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoCardClean;