// src/components/PhotoModal.tsx
// © 2025 Mark Hustad — MIT License
import React, { useState } from 'react';
import type { Photo, Tag } from '../types';
import { companyCamService } from '../services/companyCamService'; // Added Tag import

interface PhotoModalProps {
  photo: Photo;
  onClose: () => void;
  apiKey: string;
  onTagAdded: (photoId: string, newTag: Tag) => void;
}

const PhotoModal: React.FC<PhotoModalProps> = ({ photo, onClose, apiKey, onTagAdded }) => {
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>([]);
  const [aiSuggestedDescription, setAiSuggestedDescription] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState<string | null>(null); // To track which tag is being added

  // Define mainImageUri and base tagStyle first as they are used by other constants/functions
  const mainImageUri =
    Array.isArray(photo.uris) && photo.uris.length > 0
      ? photo.uris.find(uri => uri.type === 'large')?.uri ||
        photo.uris.find(uri => uri.type === 'original')?.uri ||
        photo.uris.find(uri => uri.type === 'medium')?.uri ||
        photo.uris[0]?.uri
      : undefined;

  const tagStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#eee',
    color: '#333',
    padding: '5px 10px',
    borderRadius: '15px',
    margin: '0 5px 5px 0',
    fontSize: '0.9rem',
  };

  // Styles and handler for AI suggestions button and display
  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '10px 15px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    opacity: isAiLoading ? 0.7 : 1, // Uses isAiLoading state
  };

  const aiTagStyle: React.CSSProperties = {
    ...tagStyle, // Inherits from tagStyle
    backgroundColor: '#d1e7dd', // Differentiate AI tags
  };

  const handleFetchAiSuggestions = async () => {
    if (!mainImageUri) {
      setAiError('Main image URI is not available.');
      return;
    }
    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestedTags([]); // Clear previous suggestions
    setAiSuggestedDescription(''); // Clear previous description

    try {
      const response = await fetch('/api/suggest-ai-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: mainImageUri }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter out tags already present on the photo (case-insensitive comparison)
      const existingTagValues = photo.tags?.map((t: Tag) => t.display_value.toLowerCase()) || [];
      const uniqueNewTags = (data.suggestedTags || []).filter(
        (tag: string) => !existingTagValues.includes(tag.toLowerCase())
      );

      setAiSuggestedTags(uniqueNewTags);
      setAiSuggestedDescription(data.suggestedDescription || '');

    } catch (error: any) {
      console.error('Failed to fetch AI suggestions:', error);
      setAiError(error.message || 'An unknown error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddAiTag = async (suggestedTagValue: string) => {
    if (!apiKey) {
      setAiError('API key is missing. Cannot add tag.');
      return;
    }
    setAddingTag(suggestedTagValue); // Set loading state for this specific tag
    try {
      // 1. List existing CompanyCam tags to find if this tag display_value already exists
      const allCompanyCamTags = await companyCamService.listCompanyCamTags(apiKey);
      let targetTag = allCompanyCamTags.find((t: Tag) => t.display_value.toLowerCase() === suggestedTagValue.toLowerCase());

      // 2. If tag doesn't exist by display_value, create it
      if (!targetTag) {
        targetTag = await companyCamService.createCompanyCamTagDefinition(apiKey, suggestedTagValue);
      }

      // 3. Add the (now existing or newly created) tag to the photo
      if (targetTag) {
        await companyCamService.addTagsToPhoto(apiKey, photo.id, [targetTag.id]);
        
        // 4. Notify HomePage (parent component)
        onTagAdded(photo.id, targetTag);

        // 5. Update local UI: remove from suggestions
        setAiSuggestedTags(prev => prev.filter(t => t.toLowerCase() !== suggestedTagValue.toLowerCase()));
      } else {
        throw new Error('Failed to find or create the tag.');
      }

    } catch (error: any) {
      console.error(`Error adding AI tag '${suggestedTagValue}':`, error);
      setAiError(`Failed to add tag '${suggestedTagValue}'. ${error.message}`);
      // Optionally, re-add to suggestions if it failed, or handle error state differently
    } finally {
      setAddingTag(null); // Clear loading state for this tag
    }
  };

  // Original modal styles (unrelated to AI suggestions directly)
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

  // JSX for the modal
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
              {photo.tags.map((tag) => (
                <span key={tag.id} style={tagStyle}>{tag.display_value}</span>
              ))}
            </div>
          </div>
        )}

        {/* AI Suggestions Section */}
        <div style={{ marginTop: '20px' }}>
          <h4>AI Suggestions</h4>
          <button 
            onClick={handleFetchAiSuggestions} 
            disabled={isAiLoading}
            style={buttonStyle} // Uses buttonStyle defined above
          >
            {isAiLoading ? 'Loading AI Suggestions...' : 'Get AI Suggestions '}
          </button>

          {aiError && <p style={{ color: 'red', marginTop: '10px' }}>Error: {aiError}</p>}

          {aiSuggestedDescription && (
            <div style={{ marginTop: '10px' }}>
              <strong>Suggested Description:</strong>
              <p>{aiSuggestedDescription}</p>
            </div>
          )}

          {aiSuggestedTags.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <strong>Suggested Tags:</strong>
              <div style={{ marginTop: '5px' }}>
                {aiSuggestedTags.map((tag, index) => (
                  <span key={`ai-tag-${index}`} style={aiTagStyle}> {/* Uses aiTagStyle defined above */}
                    {tag}
                    <button 
                      onClick={() => handleAddAiTag(tag)}
                      disabled={addingTag === tag || isAiLoading} // Disable if this tag is being added or all suggestions are loading
                      style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        border: '1px solid #007bff',
                        backgroundColor: addingTag === tag ? '#ccc' : '#e7f3ff',
                        color: addingTag === tag ? '#666' : '#007bff',
                        borderRadius: '4px',
                      }}
                    >
                      {addingTag === tag ? 'Adding...' : '+'}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoModal;