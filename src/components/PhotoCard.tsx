// src/components/PhotoCard.tsx
// 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo, Tag as CompanyCamTag } from '../types';
import { useUserContext } from '../contexts/UserContext';
import LazyImage from './LazyImage';

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
  onRemoveTag?: (photoId: string, tagId: string) => Promise<void>;
  activeTagIds?: CompanyCamTag['id'][];
  aiSuggestionData?: PhotoCardAiSuggestionState;
  onFetchAiSuggestions: (photoId: string, photoUrl: string) => Promise<void>;
  onUnarchivePhoto?: (photoId: string) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  // mockTagsData, // Not directly used in PhotoCard rendering logic
  onPhotoClick,
  onTagClick,
  onAddTagToCompanyCam: _onAddTagToCompanyCam,
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
      // HomePage will handle setting the error state via onFetchAiSuggestions callback
      return;
    }
    onFetchAiSuggestions(photo.id, imageUrlToSend);
  };

  const isArchived = photo.archive_state === 'archived';

  return (
    <div
      className="border p-4 rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-all duration-200 ease-in-out flex flex-col relative"
      style={{
        backgroundColor: isArchived ? '#f3f4f6' : '#FFFFFF',
        borderColor: isArchived ? '#9ca3af' : '#d1d5db',
        opacity: isArchived ? 0.6 : 1,
        color: '#1f2937'
      }}
      onClick={() => onPhotoClick(photo)}
    >
      {/* Archived Badge with Unarchive Button */}
      {isArchived && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <div className="text-white px-2 py-1 text-xs font-bold rounded" style={{ backgroundColor: '#dc2626' }}>
            ARCHIVED
          </div>
          {onUnarchivePhoto && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnarchivePhoto(photo.id);
              }}
              className="text-white px-2 py-1 text-xs font-bold rounded transition-colors"
              style={{ backgroundColor: '#2563eb' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
              title="Unarchive this photo"
            >
              UNARCHIVE
            </button>
          )}
        </div>
      )}
      
      <div className={`w-full h-48 rounded-md mb-3 bg-gray-100 flex items-center justify-center overflow-hidden ${
        isArchived ? 'grayscale' : ''
      }`}>
        {thumbnailUrl ? (
          <LazyImage
            src={thumbnailUrl}
            alt={photo.description || `Photo by ${photo.creator_name}`}
            className="w-full h-full object-cover rounded-md"
            width={300}
            height={192}
            loadingThreshold={100}
            onLoad={() => {
              // Optional: track successful image loads for analytics
              console.debug(`[PhotoCard] Image loaded for photo ${photo.id}`);
            }}
            onError={() => {
              console.warn(`[PhotoCard] Failed to load image for photo ${photo.id}`);
            }}
          />
        ) : (
          <span className="text-gray-600 text-sm">No Image Available</span>
        )}
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="text-lg font-semibold mb-1 mt-2 truncate" style={{ color: '#111827', fontFamily: 'Space Grotesk, var(--font-heading)' }} title={`Photo ID: ${photo.id}`}>
          {`Photo ID: ${photo.id}`}
        </h3>
        <p className="text-sm mb-1 truncate" style={{ color: '#4b5563', fontFamily: 'Inter, var(--font-body)' }}>
          By: {photo.creator_name || 'Unknown Creator'}
        </p>


        {photo.description && (
          <p className="text-sm mt-1 mb-2 line-clamp-2" style={{ color: '#374151', fontFamily: 'Inter, var(--font-body)' }} title={photo.description}>
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
                  className="relative inline-block group"
                >
                  <span
                    onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
                      e.stopPropagation();
                      if (onTagClick) {
                        onTagClick(tag.id);
                      }
                    }}
                    className={`px-2 py-1 rounded-full text-xs transition-colors duration-150 ease-in-out inline-block ${
                      onTagClick ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    style={{
                      backgroundColor: tag.isAiEnhanced
                        ? isActive ? '#374151' : '#e5e7eb'
                        : isActive ? '#262626' : onTagClick ? '#FFFFFF' : '#f9fafb',
                      color: tag.isAiEnhanced
                        ? isActive ? '#FFFFFF' : '#1f2937'
                        : isActive ? '#FFFFFF' : onTagClick ? '#374151' : '#6b7280',
                      border: (!tag.isAiEnhanced && !isActive && onTagClick) ? '1px solid #d1d5db' : 'none'
                    }}
                    onMouseEnter={onTagClick ? (e) => {
                      if (tag.isAiEnhanced && !isActive) {
                        e.target.style.backgroundColor = '#d1d5db';
                      } else if (!tag.isAiEnhanced && isActive) {
                        e.target.style.backgroundColor = '#3f3f3f';
                      } else if (!tag.isAiEnhanced && !isActive && onTagClick) {
                        e.target.style.backgroundColor = '#f3f4f6';
                      } else if (!tag.isAiEnhanced && isActive) {
                        e.target.style.backgroundColor = '#3f3f3f';
                      }
                    } : undefined}
                    onMouseLeave={onTagClick ? (e) => {
                      if (tag.isAiEnhanced && !isActive) {
                        e.target.style.backgroundColor = '#e5e7eb';
                      } else if (!tag.isAiEnhanced && isActive) {
                        e.target.style.backgroundColor = '#262626';
                      } else if (!tag.isAiEnhanced && !isActive && onTagClick) {
                        e.target.style.backgroundColor = '#FFFFFF';
                      }
                    } : undefined}
                    title={onTagClick ? `Filter by: ${tag.display_value}${tag.isAiEnhanced ? ' (AI)' : ''}` : `${tag.display_value}${tag.isAiEnhanced ? ' (AI)' : ''}`}
                  >
                    {tag.display_value}
                  </span>
                  {onRemoveTag && (
                    <button
                      onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        try {
                          await onRemoveTag(photo.id, tag.id);
                        } catch (err) {
                          console.error(`[PhotoCard] Error removing tag '${tag.display_value}':`, err);
                        }
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-xs"
                      style={{ backgroundColor: '#6b7280' }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#ef4444'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
                      title="Remove tag"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })
          ) : (
            <span className="text-xs italic" style={{ color: '#6b7280' }}>No tags</span>
          )}
        </div>

        {/* AI Suggestions Section (for NEW, ephemeral suggestions) */}
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#d1d5db' }}>
          {/* Loading State for New Suggestions */}
          {aiSuggestionData?.isSuggesting && (
            <div className="mt-2 flex items-center justify-center py-1.5" style={{ color: '#374151' }}>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span style={{ fontFamily: 'Inter, var(--font-body)' }}>Suggesting...</span>
            </div>
          )}

          {/* Button to initiate NEW suggestions (shown if not suggesting AND (no successful new data yet OR new suggestion error)) */}
          {!aiSuggestionData?.isSuggesting && 
            ((!aiSuggestionData?.suggestedDescription && !(aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0)) || aiSuggestionData?.suggestionError) && (
            <div className="flex justify-center">
              <button
              onClick={handleSuggestAiTags}
              className="mt-2 px-6 py-2.5 border text-sm shadow-sm flex items-center justify-center space-x-1.5 transition-all duration-200 ease-out group active:translate-y-0 active:shadow-sm"
              style={{ 
                backgroundColor: '#FFFFFF', 
                color: '#374151', 
                borderColor: '#d1d5db',
                fontFamily: 'Inter, var(--font-body)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f9fafb';
                e.target.style.borderColor = '#ea580c';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#FFFFFF';
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3.5a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-3 0v-1A1.5 1.5 0 0110 3.5zM3.188 8.044A5.5 5.5 0 0110 4.5h.008a5.5 5.5 0 016.804 3.544l.002.005.003.005a4.502 4.502 0 01-.82 4.44l-2.67 3.523a1.5 1.5 0 01-2.331.12l-2.67-3.523a4.502 4.502 0 01-.82-4.44l.002-.005.003-.005zM10 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              </svg>
              <span>Suggest Tags</span>
            </button>
            </div>
          )}

          {/* Error for New Suggestions */}
          {aiSuggestionData?.suggestionError && !aiSuggestionData?.isSuggesting && (
            <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>Error: {aiSuggestionData.suggestionError}</p>
          )}

          {/* Display New Suggested Description */}
          {aiSuggestionData?.suggestedDescription && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
            <div className="mt-2 py-2"> {/* Added py-2 for vertical padding */}
              <p className="text-xs" style={{ color: '#374151' }}>
              <span className="font-semibold mr-1" style={{ color: '#1f2937' }}>AI Suggested Description:
              <span className="ml-1" style={{ color: '#4b5563' }}>
                  {aiSuggestionData.suggestedDescription}
              </span>
              </span>
              </p>
            </div>
          )}

          {/* Divider between New description and New tags */}
          {aiSuggestionData?.suggestedDescription && aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0 && !aiSuggestionData.isSuggesting && !aiSuggestionData.suggestionError && (
            <hr className="my-3" style={{ borderColor: '#d1d5db' }} />
          )}

          {/* Display New Suggested Tags */}
          {aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0 && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
            <div className="mt-2 py-2"> {/* Added py-2 for vertical padding */}
              <p className="text-xs font-semibold mb-1" style={{ color: '#1f2937' }}>AI Suggested Tags:</p>
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
                    className="px-2.5 py-1 border text-xs rounded-full transition-colors duration-150"
                    style={{ 
                      backgroundColor: '#FFFFFF', 
                      color: '#374151', 
                      borderColor: '#d1d5db' 
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f9fafb';
                      e.target.style.borderColor = '#ea580c';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#FFFFFF';
                      e.target.style.borderColor = '#d1d5db';
                    }}
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
