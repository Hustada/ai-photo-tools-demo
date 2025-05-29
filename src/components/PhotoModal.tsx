// src/components/PhotoModal.tsx
// © 2025 Mark Hustad — MIT License
import React from 'react';
import type { Photo } from '../types';

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
}

const PhotoModal: React.FC<PhotoModalProps> = ({ photo, onClose }) => {
  const mainImageUri =
    Array.isArray(photo.uris) && photo.uris.length > 0
      ? photo.uris.find(uri => uri.type === 'large')?.uri ||
        photo.uris.find(uri => uri.type === 'original')?.uri ||
        photo.uris.find(uri => uri.type === 'medium')?.uri ||
        photo.uris[0]?.uri
      : undefined;

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '80vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    color: '#333',
  };

  const imageStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: '60vh',
    display: 'block',
    margin: '0 auto 20px auto',
    borderRadius: '4px',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'transparent',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#333',
  };

  const tagStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#eee',
    color: '#333',
    padding: '5px 10px',
    borderRadius: '15px',
    margin: '0 5px 5px 0',
    fontSize: '0.9rem',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeButtonStyle} onClick={onClose}>&times;</button>
        {mainImageUri && <img src={mainImageUri} alt={photo.description || `Photo ${photo.id}`} style={imageStyle} />}
        
        <h3>Details</h3>
        {photo.description && <p><strong>Description:</strong> {photo.description}</p>}
        <p><strong>Captured by:</strong> {photo.creator_name || 'Unknown User'}</p>
        <p><strong>Captured on:</strong> {new Date(photo.captured_at).toLocaleDateString()}</p>

        {Array.isArray(photo.tags) && photo.tags.length > 0 && (
          <div>
            <strong>Tags:</strong>
            <div style={{ marginTop: '5px' }}>
              {/* Type for 'tag' will be inferred if photo.tags is Tag[] */}
              {photo.tags.map((tag) => (
                <span key={tag.id} style={tagStyle}>{tag.display_value}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoModal;