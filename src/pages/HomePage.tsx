// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect } from 'react';
import { companyCamService } from '../services/companyCamService';
import type { Photo, Tag } from '../types'; // Ensure Tag is imported
import PhotoModal from '../components/PhotoModal';
import PhotoCard from '../components/PhotoCard';

// Define mock tags
const now = Date.now();
const mockCompanyId = 'mock_company_001';

const mockTagsData: Tag[] = [
  { id: 'mock_tag_1', company_id: mockCompanyId, display_value: 'Exterior', value: 'exterior', created_at: now, updated_at: now },
  { id: 'mock_tag_2', company_id: mockCompanyId, display_value: 'Roofing', value: 'roofing', created_at: now, updated_at: now },
  { id: 'mock_tag_3', company_id: mockCompanyId, display_value: 'Damage Assessment', value: 'damage_assessment', created_at: now, updated_at: now },
  { id: 'mock_tag_4', company_id: mockCompanyId, display_value: 'Inspection Point', value: 'inspection_point', created_at: now, updated_at: now },
  { id: 'mock_tag_5', company_id: mockCompanyId, display_value: 'Interior Detail', value: 'interior_detail', created_at: now, updated_at: now },
  { id: 'mock_tag_6', company_id: mockCompanyId, display_value: 'Plumbing Issue', value: 'plumbing_issue', created_at: now, updated_at: now },
  { id: 'mock_tag_7', company_id: mockCompanyId, display_value: 'Electrical Panel', value: 'electrical_panel', created_at: now, updated_at: now },
  { id: 'mock_tag_8', company_id: mockCompanyId, display_value: 'Foundation Crack', value: 'foundation_crack', created_at: now, updated_at: now },
  { id: 'mock_tag_9', company_id: mockCompanyId, display_value: 'Landscaping', value: 'landscaping', created_at: now, updated_at: now },
  { id: 'mock_tag_10', company_id: mockCompanyId, display_value: 'Work in Progress', value: 'work_in_progress', created_at: now, updated_at: now },
];

// Helper function to get random tags
const getRandomMockTags = (): Tag[] => {
  const numberOfTags = Math.floor(Math.random() * 4); // 0 to 3 tags
  const shuffled = [...mockTagsData].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numberOfTags);
};

const HomePage: React.FC = () => {
  const [apiKey] = useState<string>(import.meta.env.VITE_APP_COMPANYCAM_API_KEY || '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePhotos, setHasMorePhotos] = useState<boolean>(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const fetchPhotosAndTheirTags = async (pageToFetch: number) => {
    console.log('[HomePage] fetchPhotosAndTheirTags called for page:', pageToFetch);
    console.log('[HomePage] Current API Key:', apiKey ? 'Exists' : 'MISSING/EMPTY');
    if (!apiKey) {
      setError('Please enter an API Key.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedPhotos = await companyCamService.getPhotos(apiKey, pageToFetch, 20);
      console.log('[HomePage] Fetched photos response:', fetchedPhotos);
      
      const photosWithProcessedTags = await Promise.all(
        fetchedPhotos.map(async (photo, index) => {
          if (index === 0) console.log('[HomePage] Processing tags for first photo:', photo.id);
          try {
            const tagsFromApi = await companyCamService.getPhotoTags(apiKey, photo.id);
            if (index === 0) console.log(`[HomePage] Tags from API for photo ${photo.id}:`, tagsFromApi);
            // If API returns tags and they are not empty, use them.
            if (tagsFromApi && tagsFromApi.length > 0) {
              return { ...photo, tags: tagsFromApi };
            } else {
              // No tags from API or API call failed for tags, assign mock tags
              if (index === 0) console.log(`[HomePage] No tags from API for photo ${photo.id}, assigning mock tags.`);
              return { ...photo, tags: getRandomMockTags() };
            }
          } catch (tagError) {
            console.warn(`Failed to fetch tags for photo ${photo.id}, assigning mock tags.`, tagError);
            return { ...photo, tags: getRandomMockTags() }; // Assign mock tags on error
          }
        })
      );

      console.log('[HomePage] Photos with actual or mock tags processed:', photosWithProcessedTags);
      setPhotos(prevPhotos => pageToFetch === 1 ? photosWithProcessedTags : [...prevPhotos, ...photosWithProcessedTags]);
      setCurrentPage(pageToFetch);
      setHasMorePhotos(fetchedPhotos.length === 20);

    } catch (err) {
      console.error('[HomePage] Error in fetchPhotosAndTheirTags:', err);
      setError('Failed to fetch photos. Check API Key and console for details.');
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
  
  useEffect(() => {
    if (apiKey) {
      fetchPhotosAndTheirTags(1);
    } else {
      setError('API Key not found. Please ensure VITE_APP_COMPANYCAM_API_KEY is set in your .env file and you have restarted the development server.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div className="p-5 font-sans">
      <h1 className="text-3xl font-bold mb-5 text-center">CompanyCam AI Photo Inspirations</h1>
      <div className="mb-5 text-center">
        <button
          onClick={() => fetchPhotosAndTheirTags(1)}
          disabled={isLoading || !apiKey}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isLoading && photos.length === 0 ? 'Fetching...' : 'Fetch/Refresh Photos'}
        </button>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onPhotoClick={handlePhotoClick}
          />
        ))}
      </div>
      
      {photos.length > 0 && !isLoading && (
        <div className="mt-5 text-center">
          {hasMorePhotos ? (
            <button 
              onClick={handleLoadMore} 
              disabled={isLoading} 
              className="px-5 py-2 bg-green-500 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              Load More
            </button>
          ) : (
            <p className="text-gray-600 italic">All photos loaded.</p>
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
