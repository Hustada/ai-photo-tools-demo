// src/components/PhotoCard.tsx
// 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo, Tag } from '../types'; 

interface PhotoCardProps {
  photo: Photo;
  onPhotoClick: (photo: Photo) => void;
  onTagClick?: (tagId: string) => void; 
  activeTagIds?: string[]; 
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onPhotoClick, onTagClick, activeTagIds }) => {
  const thumbnailUrl = photo.uris.find(uri => uri.type === 'thumbnail')?.uri;

  return (
    <div
      className="bg-white border border-gray-300 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-200 ease-in-out flex flex-col"
      onClick={() => onPhotoClick(photo)}
    >
      <div className="w-full h-48 rounded-md mb-3 bg-gray-100 flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.description || `Photo ${photo.id}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400 text-sm">No Image Available</span>
        )}
      </div>
      
      <div className="flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-800 mb-1 mt-2 truncate">
          {photo.description || `Photo ID: ${photo.id}`}
        </h3>
        <p className="text-sm text-gray-600 mb-2 truncate">
          By: {photo.creator_name || 'Unknown Creator'}
        </p>
        <div className="mt-auto pt-2 flex flex-wrap gap-2">
          {photo.tags && Array.isArray(photo.tags) && photo.tags.length > 0 ? (
            photo.tags.map((tag: Tag) => { 
              if (!tag || typeof tag.id === 'undefined') return null; 

              const isActive = activeTagIds?.includes(tag.id);
              return (
                <span
                  key={tag.id} 
                  onClick={(e) => {
                    e.stopPropagation(); 
                    if (onTagClick) {
                      onTagClick(tag.id); 
                    }
                  }}
                  className={`px-2 py-1 rounded-full text-xs transition-colors duration-150 ease-in-out 
                    ${onTagClick ? 'cursor-pointer' : 'cursor-default'} 
                    ${isActive 
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : onTagClick 
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-500' 
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
      </div>
    </div>
  );
};

export default PhotoCard;
