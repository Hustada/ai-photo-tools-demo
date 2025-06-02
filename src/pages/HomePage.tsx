// 2025 Mark Hustad — MIT License

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import { companyCamService } from '../services/companyCamService';
import type { Photo, Tag } from '../types';
import PhotoModal from '../components/PhotoModal';
import PhotoCard, { type PhotoCardAiSuggestionState } from '../components/PhotoCard';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  console.log('HomePage rendering/re-rendering. API key will be retrieved from localStorage when needed.');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allFetchedPhotos, setAllFetchedPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePhotos, setHasMorePhotos] = useState<boolean>(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [aiSuggestionsCache, setAiSuggestionsCache] = useState<Record<string, PhotoCardAiSuggestionState>>({});

  const {
    currentUser,
    companyDetails,
    projects: userProjects, // Alias to avoid conflict if 'projects' is used elsewhere
    loading: userContextLoading,
    error: userContextError,
  } = useUserContext();

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  const handleTagAddedToPhoto = useCallback((photoId: string, newTag: Tag) => {
    setAllFetchedPhotos(prevPhotos =>
      prevPhotos.map(p => {
        if (p.id === photoId) {
          const existingTags = p.tags || [];
          if (!existingTags.find(t => t.id === newTag.id)) {
            return { ...p, tags: [...existingTags, newTag] };
          }
        }
        return p;
      })
    );
    setSelectedPhoto(prevSelected => {
      if (prevSelected && prevSelected.id === photoId) {
        const existingTags = prevSelected.tags || [];
        if (!existingTags.find(t => t.id === newTag.id)) {
          return { ...prevSelected, tags: [...existingTags, newTag] };
        }
      }
      return prevSelected;
    });
  }, []);

  const handleAddTagRequest = useCallback(async (photoId: string, tagDisplayValue: string): Promise<void> => {
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    if (!apiKeyFromStorage) {
      console.error('API Key is not available, cannot add tag.');
      setError('API Key is required to add tags.');
      return;
    }
    console.log(`handleAddTagRequest: Adding tag '${tagDisplayValue}' to photo '${photoId}'`);
    try {
      let targetTag: Tag | undefined;
      const existingCompanyCamTags = await companyCamService.listCompanyCamTags(apiKeyFromStorage);
      targetTag = existingCompanyCamTags.find(t => t.display_value.toLowerCase() === tagDisplayValue.toLowerCase());

      if (!targetTag) {
        console.log(`Tag '${tagDisplayValue}' not found. Creating new tag definition.`);
        targetTag = await companyCamService.createCompanyCamTagDefinition(apiKeyFromStorage, tagDisplayValue);
        console.log(`Created new tag:`, targetTag);
      }

      if (!targetTag) {
        throw new Error(`Failed to find or create tag definition for '${tagDisplayValue}'`);
      }

      await companyCamService.addTagsToPhoto(apiKeyFromStorage, photoId, [targetTag.id]);
      console.log(`Successfully added tag '${targetTag.display_value}' (ID: ${targetTag.id}) to photo '${photoId}'.`);
      handleTagAddedToPhoto(photoId, targetTag);
    } catch (err: any) {
      console.error(`Error in handleAddTagRequest for photo ${photoId} and tag ${tagDisplayValue}:`, err);
      setError(`Failed to add tag '${tagDisplayValue}'. ${err.message || ''}`);
    }
  }, [handleTagAddedToPhoto]);

  const fetchPhotosAndTheirTags = useCallback(async (pageToFetch: number) => {
    console.log('fetchPhotosAndTheirTags called for page:', pageToFetch);
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    if (!apiKeyFromStorage) {
      setError('Please enter an API Key.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedPhotosData = await companyCamService.getPhotos(apiKeyFromStorage, pageToFetch, 20);
      console.log('Fetched photos raw from API:', fetchedPhotosData);

      const photosWithRealTags = await Promise.all(
        fetchedPhotosData.map(async (photo) => {
          try {
            const tagsFromApi = await companyCamService.getPhotoTags(apiKeyFromStorage, photo.id);
            return { ...photo, tags: tagsFromApi || [] };
          } catch (tagError) {
            console.warn(`Failed to fetch tags for photo ${photo.id}. It will be shown with no tags.`, tagError);
            return { ...photo, tags: [] };
          }
        })
      );
      console.log('Photos processed with their actual CompanyCam tags:', photosWithRealTags);

      setAllFetchedPhotos(prevAllPhotos => {
        if (pageToFetch === 1) {
          return photosWithRealTags;
        }
        const existingPhotoIds = new Set(prevAllPhotos.map(p => p.id));
        const newUniquePhotos = photosWithRealTags.filter(p => !existingPhotoIds.has(p.id));
        return [...prevAllPhotos, ...newUniquePhotos];
      });
      setCurrentPage(pageToFetch);
      setHasMorePhotos(fetchedPhotosData.length === 20);
    } catch (err) {
      console.error('Error in fetchPhotosAndTheirTags:', err);
      setError('Failed to fetch photos. Check API Key and console for details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTagClick = (tagId: string) => {
    setActiveTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const applyClientSideFilters = useCallback(() => {
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
  }, [allFetchedPhotos, activeTagIds]);

  useEffect(() => {
    applyClientSideFilters();
  }, [applyClientSideFilters]);

  useEffect(() => {
    console.log('HomePage: Initial load effect triggered.');
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    if (apiKeyFromStorage) {
      console.log('HomePage: API key found in storage, fetching initial photos.');
      fetchPhotosAndTheirTags(1);
    } else {
      console.warn('HomePage: API key not found in storage for initial load. ProtectedRoute should have redirected.');
      setError("API Key not found. Please log in.");
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPhotosAndTheirTags]); // fetchPhotosAndTheirTags is memoized

  const uniqueFilterableTags = useMemo(() => {
    const allTagsWithDuplicates = allFetchedPhotos.flatMap(photo => photo.tags || []);
    const uniqueTagsMap = new Map<string, Tag>();
    allTagsWithDuplicates.forEach(tag => {
      if (tag && tag.id && !uniqueTagsMap.has(tag.id)) {
        uniqueTagsMap.set(tag.id, tag);
      }
    });
    return Array.from(uniqueTagsMap.values()).sort((a, b) => a.display_value.localeCompare(b.display_value));
  }, [allFetchedPhotos]);

  const fetchAiSuggestionsForPhoto = useCallback(async (photoId: string, photoUrl: string, projectId?: string) => {
    if (!photoUrl) {
      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: { tags: [], description: '', isLoading: false, error: 'Photo URL is missing.' },
      }));
      return;
    }

    setAiSuggestionsCache(prev => ({
      ...prev,
      [photoId]: { ...(prev[photoId] || { tags: [], description: '', error: null }), isLoading: true },
    }));

    try {
      const response = await fetch('/api/suggest-ai-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoId,
          photoUrl,
          projectId,
          userId: currentUser?.id || 'unknown_user_id', // Use ID from context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response.' })) as { message?: string };
        throw new Error(
          `HTTP error! status: ${response.status}, Message: ${errorData.message || response.statusText}`
        );
      }
      const data = await response.json() as { suggestedTags: string[], suggestedDescription?: string };
      const existingPhotoTags = allFetchedPhotos.find(p => p.id === photoId)?.tags?.map(t => t.display_value.toLowerCase()) || [];
      const filteredSuggestions = data.suggestedTags.filter(
        (tag: string) => !existingPhotoTags.includes(tag.toLowerCase())
      );

      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: {
          tags: filteredSuggestions,
          description: data.suggestedDescription || '',
          isLoading: false,
          error: null,
        },
      }));
    } catch (err: any) {
      console.error(`Error fetching AI suggestions for photo ${photoId}:`, err);
      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: { tags: [], description: '', isLoading: false, error: err.message || 'Failed to fetch AI suggestions' },
      }));
    }
  }, [allFetchedPhotos, currentUser]);

  const handleLoadMore = useCallback(() => {
    if (hasMorePhotos && !isLoading) {
      const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
      if (!apiKeyFromStorage) {
        setError("API Key not found. Cannot load more photos.");
        return;
      }
      console.log('handleLoadMore: Fetching page', currentPage + 1);
      fetchPhotosAndTheirTags(currentPage + 1);
    }
  }, [hasMorePhotos, isLoading, currentPage, fetchPhotosAndTheirTags]);

  const handleScroll = useCallback(() => {
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    if (window.innerHeight + document.documentElement.scrollTop < document.documentElement.offsetHeight - 300 || isLoading || !hasMorePhotos || !apiKeyFromStorage) {
      return;
    }
    // Debounce or throttle this if it becomes an issue, for now direct call to handleLoadMore
    handleLoadMore(); // Corrected to call handleLoadMore
  }, [isLoading, hasMorePhotos, handleLoadMore]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleRefreshPhotos = () => {
    console.log('handleRefreshPhotos: Refreshing photos');
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    if (!apiKeyFromStorage) {
      setError("API Key not found. Cannot refresh photos.");
      return;
    }
    setAiSuggestionsCache({});
    setAllFetchedPhotos([]);
    setPhotos([]);
    setCurrentPage(1);
    setHasMorePhotos(true);
    fetchPhotosAndTheirTags(1);
  };

  const handleLogout = () => {
    console.log('HomePage: Logging out.');
    localStorage.removeItem('companyCamApiKey');
    // Optionally clear context data too, though UserContext will refetch/clear on next load
    // setCurrentUser(null); // Example if you had setters from context
    // setCompanyDetails(null);
    // setProjects([]);
    console.log('HomePage: Navigating to /login.');
    navigate('/login');
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        {/* Left side: App Title */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-sky-400">CompanyCam AI Photo Inspirations</h1>
        </div>

        {/* Right side: User Info / Loading / Error */}
        <div className="text-center md:text-right">
          {userContextLoading && (
            <p className="text-md animate-pulse">Loading user...</p>
          )}
          {userContextError && !userContextLoading && (
            <div>
              <p className="text-red-400 font-semibold text-sm">User data unavailable</p>
              {/* <p className="text-red-400 text-xs mt-1">{userContextError}</p> */}
            </div>
          )}
          {currentUser && !userContextLoading && !userContextError && (
            <div>
              <h2 className="text-base sm:text-lg font-light">
                Welcome, <span className="font-semibold">{currentUser.first_name || currentUser.email_address}</span>!
              </h2>
              {companyDetails && (
                <p className="text-sm text-gray-300">
                  {companyDetails.name}
                </p>
              )}
              {userProjects.length > 0 && (
                <p className="text-xs text-gray-400">
                  {userProjects.length} project{userProjects.length === 1 ? '' : 's'}
                </p>
              )}
              <button
                onClick={handleLogout}
                className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="p-5 font-sans">
        {/* Title is now in the header */}

        {uniqueFilterableTags.length > 0 && (
          <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-sky-300">Filter by Tags:</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {uniqueFilterableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all duration-150 ease-in-out transform hover:scale-105
                    ${activeTagIds.includes(tag.id)
                      ? 'bg-sky-500 text-white shadow-lg'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'}`}
                >
                  {tag.display_value} ({allFetchedPhotos.filter(p => p.tags?.some(t => t.id === tag.id)).length})
                </button>
              ))}
            </div>
            {activeTagIds.length > 0 && (
              <div className="mt-3 flex items-center">
                <span className="text-sm font-medium text-gray-400">Active filters: </span>
                <div className="flex flex-wrap gap-1 ml-2">
                  {activeTagIds.map(tagId => {
                    const tag = uniqueFilterableTags.find(t => t.id === tagId);
                    return (
                      <span key={tagId} className="inline-block bg-sky-600 text-white px-2.5 py-1 rounded-full text-xs">
                        {tag ? tag.display_value : tagId}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => setActiveTagIds([])}
                  className="ml-3 text-xs text-red-400 hover:text-red-300 underline transition-colors duration-150"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-6 text-center">
          <button
            onClick={handleRefreshPhotos}
            disabled={isLoading || !localStorage.getItem('companyCamApiKey')}
            className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-500 disabled:bg-gray-600 disabled:opacity-70 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg transform hover:scale-105"
          >
            {isLoading && photos.length === 0 ? 'Fetching Photos...' : 'Refresh Photos'}
          </button>
        </div>

        {error && <p className="text-red-400 text-center mb-4 p-3 bg-red-900 border border-red-700 rounded-md">Error: {error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onAddTagToCompanyCam={handleAddTagRequest}
              onTagClick={handleTagClick}
              onPhotoClick={() => handlePhotoClick(photo)}
              mockTagsData={[]} // For manually adding known tags, not AI ones
              aiSuggestionData={aiSuggestionsCache[photo.id]}
              onFetchAiSuggestions={fetchAiSuggestionsForPhoto}
            />
          ))}
        </div>

        {photos.length > 0 && !isLoading && (
          <div className="mt-8 text-center">
            {hasMorePhotos ? (
              <button
                onClick={handleLoadMore} // Corrected to handleLoadMore
                disabled={isLoading || !localStorage.getItem('companyCamApiKey')}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:bg-gray-600 disabled:opacity-70 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Load More Photos
              </button>
            ) : (
              <p className="text-gray-500 italic">No more photos to load.</p>
            )}
          </div>
        )}

        {isLoading && photos.length > 0 && (
          <p className="text-center text-gray-400 mt-6 italic">Loading more photos...</p>
        )}

        {selectedPhoto && (
          <PhotoModal
            photo={selectedPhoto}
            onClose={handleCloseModal}
            apiKey={localStorage.getItem('companyCamApiKey') || ''} // Ensure string or empty string
            onTagAdded={handleTagAddedToPhoto}
            aiSuggestionData={selectedPhoto ? aiSuggestionsCache[selectedPhoto.id] : undefined}
            onFetchAiSuggestions={fetchAiSuggestionsForPhoto}
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
