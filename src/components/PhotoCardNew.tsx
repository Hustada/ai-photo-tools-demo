// src/components/PhotoCardNew.tsx
// 2025 Mark Hustad — MIT License
import React, { useState } from 'react';
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
  onSaveAiDescription?: (photoId: string, description: string, photo?: Photo) => Promise<void>;
}

const PhotoCardNew: React.FC<PhotoCardProps> = ({
  photo,
  onPhotoClick,
  onTagClick,
  onAddAiTag,
  onRemoveTag,
  activeTagIds,
  aiSuggestionData,
  onFetchAiSuggestions,
  onUnarchivePhoto,
  onSaveAiDescription,
}) => {
  const { userSettings } = useUserContext();
  const [isSavingDescription, setIsSavingDescription] = useState(false);
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
    <div
      className="rounded-md cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ease-out flex flex-col relative overflow-hidden w-full bg-white"
      style={{
        opacity: isArchived ? 0.7 : 1,
      }}
      onClick={() => onPhotoClick(photo)}
    >
      {/* Archived Badge */}
      {isArchived && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <div className="text-white px-2 py-1 text-xs font-bold rounded bg-red-600">
            ARCHIVED
          </div>
          {onUnarchivePhoto && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnarchivePhoto(photo.id);
              }}
              className="text-white px-2 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 transition-colors"
              title="Unarchive this photo"
            >
              UNARCHIVE
            </button>
          )}
        </div>
      )}
      
      {/* Image Section - Fixed Height */}
      <div 
        className={`relative w-full bg-gray-100 ${isArchived ? 'grayscale' : ''}`}
        style={{ height: '240px' }}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.description || `Photo by ${photo.creator_name}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              console.warn(`[PhotoCard] Failed to load image for photo ${photo.id}`);
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23e5e7eb"/%3E%3Ctext x="50" y="50" font-family="sans-serif" font-size="14" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-400 text-sm">No Image Available</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1">
        {/* Header Section - Fixed Height */}
        <div className="px-3 py-2" style={{ height: '48px' }}>
          <h3 className="text-xs font-semibold text-gray-800 truncate">
            {photo.creator_name || 'Unknown Creator'}
          </h3>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {photo.description || 'No description'}
          </p>
        </div>

        {/* Tags Section - Fixed Height */}
        <div className="px-3 pb-2" style={{ minHeight: '44px' }}>
          {photo.tags && photo.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {photo.tags.slice(0, 3).map((tag: CompanyCamTag) => {
                if (!tag || typeof tag.id !== 'string') return null;
                const isActive = activeTagIds?.includes(tag.id);
                return (
                  <span
                    key={tag.id}
                    className="relative inline-block group"
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTagClick) onTagClick(tag.id);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-150 inline-block ${
                        onTagClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                      }`}
                      style={{
                        backgroundColor: tag.isAiEnhanced
                          ? isActive ? '#374151' : '#e5e7eb'
                          : isActive ? '#262626' : '#f3f4f6',
                        color: tag.isAiEnhanced
                          ? isActive ? '#FFFFFF' : '#1f2937'
                          : isActive ? '#FFFFFF' : '#374151',
                      }}
                    >
                      {tag.display_value}
                    </span>
                    {onRemoveTag && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onRemoveTag(photo.id, tag.id);
                        }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gray-500 hover:bg-red-500 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
              {photo.tags.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  +{photo.tags.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">No tags</span>
          )}
        </div>
        {/* AI Suggestions Display */}
        {hasAiSuggestions && !aiSuggestionData.isSuggesting && (
          <div className="border-t border-gray-200 bg-gray-50 p-3">
            {aiSuggestionData.suggestedDescription && aiSuggestionData.suggestedDescription.trim() && (
              <div className="mb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-600 flex-1">
                    <span className="font-semibold text-gray-700">AI Description: </span>
                    {aiSuggestionData.suggestedDescription}
                  </p>
                  {onSaveAiDescription && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setIsSavingDescription(true);
                        try {
                          await onSaveAiDescription(photo.id, aiSuggestionData.suggestedDescription, photo);
                        } catch (error) {
                          console.error('Error saving description:', error);
                        } finally {
                          setIsSavingDescription(false);
                        }
                      }}
                      disabled={isSavingDescription || photo.description === aiSuggestionData.suggestedDescription}
                      className="px-2 py-0.5 bg-white border border-gray-300 hover:border-orange-500 hover:bg-orange-50 text-xs rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {isSavingDescription ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {aiSuggestionData.suggestedTags && aiSuggestionData.suggestedTags.filter(tag => tag.trim()).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Suggested Tags:</p>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestionData.suggestedTags.filter(tag => tag.trim()).map((tag, index) => (
                    <button
                      key={`ai-tag-${index}`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onAddAiTag(photo.id, tag, photo);
                      }}
                      className="px-2 py-0.5 bg-white border border-gray-300 hover:border-orange-500 hover:bg-orange-50 text-xs rounded transition-colors duration-150"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {aiSuggestionData?.suggestionError && aiSuggestionData.suggestionError.trim() && !aiSuggestionData.isSuggesting && (
          <div className="border-t border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-600">Error: {aiSuggestionData.suggestionError}</p>
          </div>
        )}
      </div>

      {/* AI Suggestions Button - Always at Bottom */}
      <div className="mt-auto">
        {aiSuggestionData?.isSuggesting ? (
          <div className="w-full h-12 bg-gradient-to-r from-orange-500 via-orange-600 to-gray-800 flex items-center justify-center gap-2 text-white text-xs font-semibold">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing...</span>
          </div>
        ) : (
          <button
            onClick={handleSuggestAiTags}
            className="w-full h-12 bg-gradient-to-r from-orange-500 via-orange-600 to-gray-800 hover:from-orange-600 hover:via-orange-700 hover:to-gray-900 text-white flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7V12C2 17 6.5 21.16 12 22C17.5 21.16 22 17 22 12V7L12 2Z" fill="currentColor" fillOpacity="0.9"/>
              <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Suggest Tags</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default PhotoCardNew;