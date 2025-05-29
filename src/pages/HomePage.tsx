// 2025 Mark Hustad — MIT License

import React, { useState, useEffect } from 'react';
import { companyCamService } from '../services/companyCamService';
import type { Photo } from '../types';
import PhotoModal from '../components/PhotoModal'; // Import the new modal component
import PhotoCard from '../components/PhotoCard'; // Import the new PhotoCard component

const HomePage: React.FC = () => {
  const [apiKey] = useState<string>(import.meta.env.VITE_APP_COMPANYCAM_API_KEY || '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePhotos, setHasMorePhotos] = useState<boolean>(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null); // State for the selected photo

  const fetchPhotosAndTheirTags = async (pageToFetch: number) => {
    console.log('[HomePage] fetchPhotosAndTheirTags called for page:', pageToFetch);
    console.log('[HomePage] Current API Key:', apiKey ? 'Exists' : 'MISSING/EMPTY');
    if (!apiKey) {
      setError('Please enter an API Key.');
      return;
    }
    setIsLoading(true);
    console.log('[HomePage] Attempting to fetch photos...');
    setError(null);
    try {
      const fetchedPhotos = await companyCamService.getPhotos(apiKey, pageToFetch, 20);
      console.log('[HomePage] Fetched photos response:', fetchedPhotos);
      const photosWithTags = await Promise.all(
        fetchedPhotos.map(async (photo, index) => {
          if (index === 0) console.log('[HomePage] Fetching tags for first photo:', photo.id);
          try {
            const tags = await companyCamService.getPhotoTags(apiKey, photo.id);
            if (index === 0) console.log(`[HomePage] Tags for photo ${photo.id}:`, tags);
            return { ...photo, tags };
          } catch (tagError) {
            console.warn(`Failed to fetch tags for photo ${photo.id}`, tagError);
            return { ...photo, tags: [] }; // Assign empty tags on error
          }
        })
      );

      console.log('[HomePage] Photos with tags processed:', photosWithTags);
      setPhotos(prevPhotos => pageToFetch === 1 ? photosWithTags : [...prevPhotos, ...photosWithTags]);
      setCurrentPage(pageToFetch);
      setHasMorePhotos(fetchedPhotos.length === 20);

    } catch (err) {
      console.error('[HomePage] Error in fetchPhotosAndTheirTags:', err);
      setError('Failed to fetch photos. Check API Key and console for details.');
      console.error(err);
    } finally {
      console.log('[HomePage] fetchPhotosAndTheirTags finally block reached.');
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMorePhotos) {
      fetchPhotosAndTheirTags(currentPage + 1);
    }
  };

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };
  
  // Initial fetch if API key exists on load and on apiKey change
  useEffect(() => {
    if (apiKey) {
      fetchPhotosAndTheirTags(1); // Reset to page 1 and fetch
    } else {
      setError('API Key not found. Please ensure VITE_APP_COMPANYCAM_API_KEY is set in your .env file and you have restarted the development server.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // apiKey dependency is correct here as it's initialized from env

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CompanyCam AI Photo Inspirations</h1>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => fetchPhotosAndTheirTags(1)} // Reset to page 1 on manual fetch
          disabled={isLoading || !apiKey}
          style={{ padding: '10px' }}
        >
          {isLoading && photos.length === 0 ? 'Fetching...' : 'Fetch/Refresh Photos'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {photos.map((photo) => {
          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onPhotoClick={handlePhotoClick}
            />
          );
        })}
      </div>
      
      {photos.length > 0 && !isLoading && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          {hasMorePhotos ? (
            <button onClick={handleLoadMore} disabled={isLoading} style={{ padding: '10px 20px' }}>
              Load More
            </button>
          ) : (
            <p style={{ color: '#555', fontStyle: 'italic' }}>All photos loaded.</p>
          )}
        </div>
      )}

      {selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default HomePage;
