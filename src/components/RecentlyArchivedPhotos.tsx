// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import type { Photo } from '../types';
import { companyCamService } from '../services/companyCamService';

export interface RecentlyArchivedPhotosProps {
  photos: Photo[];
  onPhotoUpdate: (photo: Photo) => void;
  className?: string;
}

export const RecentlyArchivedPhotos: React.FC<RecentlyArchivedPhotosProps> = ({
  photos,
  onPhotoUpdate,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState<Set<string>>(new Set());

  // Filter archived photos (excluding those already deleted from CompanyCam)
  const archivedPhotos = photos.filter(
    photo => photo.archive_state === 'archived'
  );

  const handleRestorePhoto = async (photo: Photo) => {
    setProcessingPhotos(prev => new Set(prev).add(photo.id));
    
    try {
      const restoredPhoto: Photo = {
        ...photo,
        archive_state: 'active',
        archived_at: undefined,
        archive_reason: undefined,
      };
      
      onPhotoUpdate(restoredPhoto);
      console.log(`[RecentlyArchived] Restored photo ${photo.id}`);
    } catch (error) {
      console.error(`[RecentlyArchived] Failed to restore photo ${photo.id}:`, error);
    } finally {
      setProcessingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  const handlePermanentlyDeletePhoto = async (photo: Photo) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this photo from CompanyCam?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    setProcessingPhotos(prev => new Set(prev).add(photo.id));
    
    try {
      const apiKey = localStorage.getItem('companyCamApiKey');
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const deleteResult = await companyCamService.deletePhoto(apiKey, photo.id);
      
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete photo');
      }

      // Mark as permanently deleted in local state
      const deletedPhoto: Photo = {
        ...photo,
        archive_state: 'pending_deletion',
        archive_reason: `${photo.archive_reason || 'User requested'} - Permanently deleted from CompanyCam`,
      };
      
      onPhotoUpdate(deletedPhoto);
      console.log(`[RecentlyArchived] Permanently deleted photo ${photo.id} from CompanyCam`);
    } catch (error) {
      console.error(`[RecentlyArchived] Failed to delete photo ${photo.id}:`, error);
      alert(`Failed to delete photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  if (archivedPhotos.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Recently Archived</h3>
              <p className="text-sm text-gray-500">
                {archivedPhotos.length} photo{archivedPhotos.length !== 1 ? 's' : ''} archived
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-3">
            {archivedPhotos.map((photo) => {
              const isProcessing = processingPhotos.has(photo.id);
              const thumbnailUrl = photo.uris.find((uri) => uri.type === 'thumbnail')?.uri 
                                || photo.uris.find((uri) => uri.type === 'web')?.uri
                                || photo.uris.find((uri) => uri.type === 'original')?.uri;

              return (
                <div key={photo.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={`Photo ${photo.id}`}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 ml-3">
                    <p className="text-sm font-medium text-gray-900">Photo {photo.id}</p>
                    <p className="text-sm text-gray-500">
                      {photo.archive_reason || 'Archived by Scout AI'}
                    </p>
                    {photo.archived_at && (
                      <p className="text-xs text-gray-400">
                        {new Date(photo.archived_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-3 space-x-2">
                    <button
                      onClick={() => handleRestorePhoto(photo)}
                      disabled={isProcessing}
                      className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Processing...' : 'Restore'}
                    </button>
                    <button
                      onClick={() => handlePermanentlyDeletePhoto(photo)}
                      disabled={isProcessing}
                      className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Deleting...' : 'Delete Forever'}
                    </button>
                  </div>
                </div>
              );
            })}
            
            {archivedPhotos.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <p>No archived photos to show</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};