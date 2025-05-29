// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect, useMemo } from 'react'; 
import { companyCamService } from '../services/companyCamService';
import type { Photo, Tag } from '../types'; 
import PhotoModal from '../components/PhotoModal';
import PhotoCard from '../components/PhotoCard';

const HomePage: React.FC = () => {
  const [apiKey] = useState<string>(import.meta.env.VITE_APP_COMPANYCAM_API_KEY || '');
  const [photos, setPhotos] = useState<Photo[]>([]); 
  const [allFetchedPhotos, setAllFetchedPhotos] = useState<Photo[]>([]); 
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePhotos, setHasMorePhotos] = useState<boolean>(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]); 

  const fetchPhotosAndTheirTags = async (pageToFetch: number) => {
    console.log('[HomePage] fetchPhotosAndTheirTags called for page:', pageToFetch);
    if (!apiKey) {
      setError('Please enter an API Key.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedPhotosData = await companyCamService.getPhotos(apiKey, pageToFetch, 20);
      console.log('[HomePage] Fetched photos raw from API:', fetchedPhotosData);
      
      const photosWithRealTags = await Promise.all(
        fetchedPhotosData.map(async (photo) => {
          try {
            const tagsFromApi = await companyCamService.getPhotoTags(apiKey, photo.id);
            return { ...photo, tags: tagsFromApi || [] }; 
          } catch (tagError) {
            console.warn(`Failed to fetch tags for photo ${photo.id}. It will be shown with no tags.`, tagError);
            return { ...photo, tags: [] }; 
          }
        })
      );

      console.log('[HomePage] Photos processed with their actual CompanyCam tags:', photosWithRealTags);
      
      setAllFetchedPhotos(prevAllPhotos => 
        pageToFetch === 1 ? photosWithRealTags : [...prevAllPhotos, ...photosWithRealTags]
      );
      setCurrentPage(pageToFetch);
      setHasMorePhotos(fetchedPhotosData.length === 20);

    } catch (err) {
      console.error('[HomePage] Error in fetchPhotosAndTheirTags:', err);
      setError('Failed to fetch photos. Check API Key and console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagClick = (tagId: string) => {
    setActiveTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const applyClientSideFilters = () => {
    if (activeTagIds.length === 0) {
      setPhotos(allFetchedPhotos);
      return;
    }
    const filtered = allFetchedPhotos.filter(photo => 
      activeTagIds.every(filterTagId => 
        photo.tags?.some(photoTag => photoTag.id === filterTagId)
      )
    );
    setPhotos(filtered);
  };

  useEffect(() => {
    applyClientSideFilters();
  }, [activeTagIds, allFetchedPhotos]);

  const uniqueFilterableTags = useMemo(() => {
    const allTagsWithDuplicates = allFetchedPhotos.flatMap(photo => photo.tags || []);
    const uniqueTagsMap = new Map<string, Tag>();
    allTagsWithDuplicates.forEach(tag => {
      if (tag && tag.id && !uniqueTagsMap.has(tag.id)) {
        uniqueTagsMap.set(tag.id, tag);
      }
    });
    return Array.from(uniqueTagsMap.values()).sort((a,b) => a.display_value.localeCompare(b.display_value));
  }, [allFetchedPhotos]);

  const handleLoadMore = () => {
    if (hasMorePhotos && !isLoading) {
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
  }, [apiKey]);

  return (
    <div className="p-5 font-sans">
      <h1 className="text-3xl font-bold mb-5 text-center">CompanyCam AI Photo Inspirations</h1>
      
      {uniqueFilterableTags.length > 0 && (
        <div className="mb-5 p-4 border rounded bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">Filter by Tags:</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {uniqueFilterableTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.id)}
                className={`px-3 py-1 rounded-full text-sm transition-colors 
                  ${activeTagIds.includes(tag.id) 
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {tag.display_value} ({allFetchedPhotos.filter(p => p.tags?.some(t => t.id === tag.id)).length})
              </button>
            ))}
          </div>
          {activeTagIds.length > 0 && (
            <div className="mt-2">
              <span className="text-sm font-medium">Active filters: </span>
              {activeTagIds.map(tagId => {
                const tag = uniqueFilterableTags.find(t => t.id === tagId);
                return (
                  <span key={tagId} className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs mr-1 mb-1">
                    {tag ? tag.display_value : tagId} 
                  </span>
                );
              })}
              <button 
                onClick={() => setActiveTagIds([])} 
                className="ml-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

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
            onTagClick={handleTagClick} 
            activeTagIds={activeTagIds} 
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
