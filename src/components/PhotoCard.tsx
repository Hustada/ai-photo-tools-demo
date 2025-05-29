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

  // Note: The outer 'key' prop is handled when PhotoCard is used in a list (e.g., in HomePage.tsx).
  // We will replace inline styles with Tailwind classes in the next step.
  return (
    <div
      style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', cursor: 'pointer' }}
      onClick={() => onPhotoClick(photo)} // Use the onPhotoClick prop
    >
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={photo.description || `Photo ${photo.id}`}
          style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
        />
      )}
      <h3 style={{ fontSize: '1em', margin: '10px 0 5px' }}>{photo.description || `Photo ID: ${photo.id}`}</h3>
      <p style={{ fontSize: '0.8em', color: '#555' }}>By: {photo.creator_name}</p>
      <div style={{ marginTop: '10px' }}>
        {photo.tags && photo.tags.length > 0 ? (
          photo.tags.map((tag) => ( // TypeScript should infer 'tag' type from 'photo.tags'
            <span 
              key={tag.id} // Inner key for list of tags
              style={{ backgroundColor: '#e0e0e0', color: '#333', padding: '3px 8px', borderRadius: '12px', marginRight: '5px', marginBottom: '5px', fontSize: '0.75em', display: 'inline-block' }}
            >
              {tag.display_value}
            </span>
          ))
        ) : (
          <span style={{ fontSize: '0.75em', color: '#777' }}>No tags</span>
        )}
      </div>
    </div>
  );
};

export default PhotoCard;
