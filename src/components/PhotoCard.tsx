// src/components/PhotoCard.tsx
// 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo, Tag as CompanyCamTag } from '../types';
import { useUserContext } from '../contexts/UserContext';
// import LazyImage from './LazyImage'; // Temporarily disabled due to positioning issues

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
  onSaveAiDescription?: (photoId: string, description: string, photo?: Photo) => Promise<void>;
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
      className="p-1 rounded-xl cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ease-out flex flex-col relative overflow-hidden w-full"
      style={{
        background: isArchived ? 'linear-gradient(to bottom, #f3f4f6, #e5e7eb)' : 'linear-gradient(to bottom, #ffffff, #f3f4f6)',
        opacity: isArchived ? 0.7 : 1,
        color: '#1f2937',
        height: '100%'
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
      
      <div className={`relative w-full rounded-lg mb-1 bg-gray-100 overflow-hidden flex items-center justify-center ${
        isArchived ? 'grayscale' : ''
      }`} style={{ height: '280px' }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.description || `Photo by ${photo.creator_name}`}
            className="w-full h-full object-cover"
            loading="lazy"
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

      <div className="flex flex-col p-2">
        {/* Header Section - Fixed height for consistency */}
        <div className="mb-2" style={{ minHeight: '36px' }}>
          <h3 className="text-xs font-semibold" style={{ color: '#111827', fontFamily: 'Space Grotesk, var(--font-heading)' }}>
            {photo.creator_name || 'Unknown Creator'}
          </h3>
          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Inter, var(--font-body)' }} title={photo.description || ''}>
            {photo.description || '\u00A0'} {/* Non-breaking space to maintain height */}
          </p>
        </div>

        {/* Tags Section - Fixed height for consistency */}
        <div className="mb-2">
          <div className="w-full flex items-center" style={{ height: '32px', overflow: 'hidden' }}>
            {photo.tags && Array.isArray(photo.tags) && photo.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 w-full">
                {photo.tags.map((tag: CompanyCamTag) => {
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
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-150 ease-in-out inline-block ${
                      onTagClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                    }`}
                    style={{
                      backgroundColor: tag.isAiEnhanced
                        ? isActive ? '#374151' : '#e5e7eb'
                        : isActive ? '#262626' : '#f3f4f6',
                      color: tag.isAiEnhanced
                        ? isActive ? '#FFFFFF' : '#1f2937'
                        : isActive ? '#FFFFFF' : '#374151',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
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
                      } else if (!tag.isAiEnhanced && !isActive) {
                        e.target.style.backgroundColor = '#f3f4f6';
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
            })}
              </div>
            ) : (
              <span className="text-xs" style={{ color: '#9ca3af', fontFamily: 'Inter, var(--font-body)' }}>No tags</span>
            )}
          </div>
        </div>

        {/* AI Suggestions Button Section - Fixed height, always visible */}
        {aiSuggestionData?.isSuggesting ? (
          <div className="w-full border-t flex items-center justify-center gap-2 text-xs font-bold italic" 
            style={{ 
              borderColor: '#e5e7eb',
              height: '48px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #262626 100%)',
              color: '#FFFFFF'
            }}>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing...</span>
          </div>
        ) : (
          <button
            onClick={handleSuggestAiTags}
            className="w-full border-t flex items-center justify-center gap-2 text-xs font-bold italic transition-all duration-300 ease-out rounded-b-xl"
            style={{ 
              borderColor: '#e5e7eb',
              height: '48px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #262626 100%)',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #262626 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #ea580c 0%, #c2410c 50%, #262626 100%)';
            }}
          >
            {/* Enhanced tag icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7V12C2 17 6.5 21.16 12 22C17.5 21.16 22 17 22 12V7L12 2Z" fill="currentColor" fillOpacity="0.9"/>
              <g className="animate-pulse">
                <circle cx="8" cy="10" r="1" fill="white" fillOpacity="0.8"/>
                <circle cx="16" cy="10" r="1" fill="white" fillOpacity="0.8"/>
                <circle cx="12" cy="14" r="1.5" fill="white" fillOpacity="0.9"/>
              </g>
              <path d="M12 8V16M8 12H16" stroke="white" strokeWidth="2" strokeLinecap="round" className="drop-shadow-sm"/>
            </svg>
            <span>Suggest Tags</span>
          </button>
        )}

        {/* Error for New Suggestions */}
        {aiSuggestionData?.suggestionError && aiSuggestionData.suggestionError.trim() && !aiSuggestionData?.isSuggesting && (
          <div className="px-3 py-2 border-t" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-xs" style={{ color: '#ef4444' }}>Error: {aiSuggestionData.suggestionError}</p>
          </div>
        )}

        {/* Display New Suggested Description */}
        {aiSuggestionData?.suggestedDescription && aiSuggestionData.suggestedDescription.trim() && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
          <div className="px-3 py-2 border-t" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-xs" style={{ color: '#374151' }}>
            <span className="font-semibold mr-1" style={{ color: '#1f2937' }}>AI Suggested Description:
            <span className="ml-1" style={{ color: '#4b5563' }}>
                {aiSuggestionData.suggestedDescription}
            </span>
            </span>
            </p>
          </div>
        )}

        {/* Display New Suggested Tags */}
        {aiSuggestionData?.suggestedTags && aiSuggestionData.suggestedTags.length > 0 && aiSuggestionData.suggestedTags.some(tag => tag.trim()) && !aiSuggestionData?.isSuggesting && !aiSuggestionData?.suggestionError && (
          <div className={`px-3 py-2 ${!aiSuggestionData?.suggestedDescription ? 'border-t' : ''}`} style={{ borderColor: '#e5e7eb' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#1f2937' }}>AI Suggested Tags:</p>
            <div className="flex flex-wrap gap-1">
              {aiSuggestionData.suggestedTags.filter((tag: string) => tag.trim()).map((tag: string, index: number) => (
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
  );
};

export default PhotoCard;

// Add global style for shimmer animation
if (typeof document !== 'undefined' && !document.getElementById('photo-card-styles')) {
  const style = document.createElement('style');
  style.id = 'photo-card-styles';
  style.textContent = `
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);
}
