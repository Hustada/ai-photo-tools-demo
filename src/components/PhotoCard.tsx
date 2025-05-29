// src/components/PhotoCard.tsx
// © 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo } from '../types';

interface PhotoCardProps {
  photo: Photo;
  onPhotoClick: (photo: Photo) => void;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onPhotoClick }) => {
  const thumbnailUrl = photo.uris.find(uri => uri.type === 'thumbnail')?.uri;

  return (
    <div
      className="bg-white border border-gray-300 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-200 ease-in-out flex flex-col" // Added flex flex-col
      onClick={() => onPhotoClick(photo)}
    >
      <div className="w-full h-48 rounded-md mb-3 bg-gray-100 flex items-center justify-center overflow-hidden"> {/* Image container / placeholder */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={photo.description || `Photo ${photo.id}`}
            className="w-full h-full object-cover" // Image fills its container
          />
        ) : (
          <span className="text-gray-400 text-sm">No Image Available</span>
        )}
      </div>
      
      {/* Text content area */}
      <div className="flex flex-col flex-grow"> {/* Added flex-grow to allow this section to expand */}
        <h3 className="text-lg font-semibold text-gray-800 mb-1 mt-2 truncate">
          {photo.description || `Photo ID: ${photo.id}`}
        </h3>
        <p className="text-sm text-gray-600 mb-2 truncate">
          By: {photo.creator_name || 'Unknown Creator'}
        </p>
        <div className="mt-auto pt-2 flex flex-wrap gap-2"> {/* Pushed to bottom, added pt-2 for spacing from content above */}
          {photo.tags && photo.tags.length > 0 ? (
            photo.tags.map((tag) => (
              <span
                key={tag.id}
                className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs"
              >
                {tag.display_value}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500 italic">No tags</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCard;
