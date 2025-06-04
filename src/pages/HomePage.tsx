// 2025 Mark Hustad — MIT License

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import { companyCamService } from '../services/companyCamService';
import type { Photo, Tag } from '../types';

// Local type for the expected API response structure for AI enhancements
interface ApiPhotoEnhancement {
  photo_id: string;
  user_id: string;
  ai_description?: string; // Optional as it might not always be present
  accepted_ai_tags: string[];
  created_at: string; // Assuming string from JSON
  updated_at: string; // Assuming string from JSON
  suggestion_source?: string;
}
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
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
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
    const index = photos.findIndex(p => p.id === photo.id);
    if (index !== -1) {
      setSelectedPhotoIndex(index);
    } else {
      // Fallback for safety, though this shouldn't happen if photo is from `photos` array
      const allIndex = allFetchedPhotos.findIndex(p => p.id === photo.id);
      if (allIndex !== -1) {
        // This case is tricky because `photos` might be filtered.
        // For simplicity, we'll only allow navigation within the currently *displayed* `photos`.
        // If the clicked photo isn't in the filtered `photos` list, modal might not open or nav would be weird.
        // Best to ensure `photo` comes from the `photos` array passed to `PhotoCard`.
        console.warn('Clicked photo not found in currently displayed (filtered) photos. Modal might behave unexpectedly for navigation.');
        // Attempt to set it anyway if found in allFetchedPhotos, but navigation will be based on `photos` array.
        // This might be an edge case if a photo is clicked that's not in the current `photos` filter set.
        // A more robust solution might involve re-evaluating filters or always using allFetchedPhotos for modal index.
        // For now, prioritize index from `photos`.
        setSelectedPhotoIndex(null); // Or handle this scenario differently
      } else {
        setSelectedPhotoIndex(null);
      }
    }
  };

  const handleCloseModal = () => {
    setSelectedPhotoIndex(null);
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
    setSelectedPhotoIndex(prevIndex => {
      // The photo object at photos[prevIndex] (if prevIndex is not null)
      // will be updated automatically because the `photos` array is derived
      // from `allFetchedPhotos`, which was just updated by setAllFetchedPhotos.
      // The modal, if open and showing photos[prevIndex], will re-render
      // with the new tag information. So, we just return prevIndex.
      return prevIndex;
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

  const handleSaveAiDescription = async (photoId: string, description: string) => {
    setAiSuggestionsCache(prev => ({
      ...prev,
      [photoId]: {
        ...(prev[photoId] || {
          suggestedTags: [],
          suggestedDescription: '',
          isSuggesting: false,
          suggestionError: null,
          persistedDescription: undefined,
          persistedAcceptedTags: [],
          persistedError: null,
        }),
        isLoadingPersisted: true, // Indicate loading while saving
        persistedError: null,
      },
    }));

    try {
      const response = await fetch('/api/ai-enhancements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoId: photoId, 
          userId: currentUser?.id || 'vite_user_id_placeholder', // Fallback, ensure currentUser.id is usually present
          description,
          suggestionSource: 'user_edit_modal_v1.0'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to save AI description (status: ${response.status})`);
      }

      const savedData = await response.json(); // Expecting { photoId, description, acceptedTags? } or similar
      console.log('API response from POST /api/ai-enhancements:', savedData);

      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: {
          ...prev[photoId],
          persistedDescription: savedData.ai_description, // Use ai_description from response
          // If API also returns acceptedTags and you want to update them here, do so.
          // For now, only updating description based on this save operation.
          isLoadingPersisted: false,
          persistedError: null,
          // Optionally, clear the *suggested* description if it was just saved
          // suggestedDescription: '', 
        },
      }));
      console.log(`Successfully saved AI description for photo ${photoId}`);
    } catch (error: any) {
      console.error(`Error saving AI description for photo ${photoId}:`, error);
      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: {
          ...prev[photoId],
          isLoadingPersisted: false,
          persistedError: error.message || 'An unknown error occurred while saving description.',
        },
      }));
    }
  };

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
    console.log(`FETCH_AI_SUGGESTIONS: Called for photoId: ${photoId}, URL: ${photoUrl ? 'present' : 'missing'}`);
    if (!photoUrl) {
      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: {
          suggestedTags: [],
          suggestedDescription: '',
          isSuggesting: false,
          suggestionError: 'Photo URL is missing.',
          persistedDescription: undefined,
          persistedAcceptedTags: [],
          isLoadingPersisted: false,
          persistedError: null,
        },
      }));
      return;
    }

    // Initialize/update cache entry for loading states
    setAiSuggestionsCache(prev => ({
      ...prev,
      [photoId]: {
        ...(prev[photoId] || {
          suggestedTags: [],
          suggestedDescription: '',
          suggestionError: null,
          persistedDescription: undefined,
          persistedAcceptedTags: [],
          persistedError: null,
        }),
        isSuggesting: true,
        isLoadingPersisted: true,
        suggestionError: null, // Explicitly clear previous errors
        persistedError: null,  // Explicitly clear previous errors
      },
    }));

    try {
      const [suggestionsResult, persistedResult] = await Promise.allSettled([
        // Fetch new AI suggestions
        fetch('/api/suggest-ai-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId,
            photoUrl,
            projectId,
            userId: currentUser?.id || 'unknown_user_id',
          }),
        }).then(async res => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Failed to parse error from suggest-ai-tags.' }));
            throw new Error(`HTTP error ${res.status}: ${errorData.message || res.statusText}`);
          }
          return res.json() as unknown as { suggestedTags: string[], suggestedDescription?: string };
        }),

        // Fetch persisted AI enhancements
        fetch(`/api/ai-enhancements?photoId=${photoId}`).then(async res => {
          if (!res.ok) {
            if (res.status === 404) { // 404 means no data, not necessarily a displayable error
              return { ai_description: undefined, accepted_ai_tags: [] }; // Default empty state
            }
            const errorData = await res.json().catch(() => ({ message: 'Failed to parse error from ai-enhancements.' }));
            throw new Error(`HTTP error ${res.status}: ${errorData.message || res.statusText}`);
          }
          return (await res.json()) as ApiPhotoEnhancement;
        })
      ]);

    console.log(`FETCH_AI_SUGGESTIONS_DEBUG: For photoId ${photoId} - Persisted Result Full:`, JSON.stringify(persistedResult, null, 2));
    if (persistedResult.status === 'fulfilled') {
      console.log(`FETCH_AI_SUGGESTIONS_DEBUG: For photoId ${photoId} - Persisted Value:`, JSON.stringify(persistedResult.value, null, 2));
    } else {
      console.error(`FETCH_AI_SUGGESTIONS_DEBUG: For photoId ${photoId} - Persisted Reason:`, JSON.stringify(persistedResult.reason, null, 2));
    }

      // Process results and update cache
      setAiSuggestionsCache(prev => {
        const currentPhotoCache = prev[photoId] || {
          suggestedTags: [], suggestedDescription: '', isSuggesting: false, suggestionError: null,
          persistedDescription: undefined, persistedAcceptedTags: [], isLoadingPersisted: false, persistedError: null,
        } as PhotoCardAiSuggestionState; // Ensure type safety for initial empty state

        let newSuggestedTags = currentPhotoCache.suggestedTags;
        let newSuggestedDescription = currentPhotoCache.suggestedDescription;
        let newSuggestionError = currentPhotoCache.suggestionError;
        let newIsSuggesting = currentPhotoCache.isSuggesting;

        let newPersistedDescription = currentPhotoCache.persistedDescription;
        let newPersistedAcceptedTags = currentPhotoCache.persistedAcceptedTags;
        let newPersistedError = currentPhotoCache.persistedError;
        let newIsLoadingPersisted = currentPhotoCache.isLoadingPersisted;

        // Process suggestions result
        if (suggestionsResult.status === 'fulfilled') {
          const data = suggestionsResult.value;
          const existingPhotoTags = allFetchedPhotos.find(p => p.id === photoId)?.tags?.map(t => t.display_value.toLowerCase()) || [];
          newSuggestedTags = data.suggestedTags.filter(tag => !existingPhotoTags.includes(tag.toLowerCase()));
          newSuggestedDescription = data.suggestedDescription || '';
          newSuggestionError = null;
        } else {
          newSuggestionError = suggestionsResult.reason?.message || 'Failed to fetch AI suggestions.';
        }
        newIsSuggesting = false;

        // Process persisted enhancements result
        if (persistedResult.status === 'fulfilled') {
          newPersistedDescription = persistedResult.value.ai_description;
          newPersistedAcceptedTags = persistedResult.value.accepted_ai_tags || [];
          newPersistedError = null;
        } else {
          // Don't show an error for 404, as it just means no data saved yet
          if (!persistedResult.reason?.message?.includes('HTTP error 404')) {
            newPersistedError = persistedResult.reason?.message || 'Failed to load saved AI enhancements.';
          }
        }
        newIsLoadingPersisted = false;

        return {
          ...prev,
          [photoId]: {
            ...currentPhotoCache, // spread old values first
            suggestedTags: newSuggestedTags,
            suggestedDescription: newSuggestedDescription,
            isSuggesting: newIsSuggesting,
            suggestionError: newSuggestionError,
            persistedDescription: newPersistedDescription,
            persistedAcceptedTags: newPersistedAcceptedTags,
            isLoadingPersisted: newIsLoadingPersisted,
            persistedError: newPersistedError,
          },
        };
      });

    } catch (error) { // Catch errors from Promise.allSettled or other unexpected issues
      console.error(`Critical error in fetchAiSuggestionsForPhoto for ${photoId}:`, error);
      setAiSuggestionsCache(prev => ({
        ...prev,
        [photoId]: {
          ...(prev[photoId] || { suggestedTags: [], suggestedDescription: '', persistedDescription: undefined, persistedAcceptedTags: [] }),
          isSuggesting: false,
          isLoadingPersisted: false,
          suggestionError: prev[photoId]?.suggestionError || 'An unexpected error occurred fetching suggestions.',
          persistedError: prev[photoId]?.persistedError || 'An unexpected error occurred loading saved enhancements.',
        } as PhotoCardAiSuggestionState, // Ensure type safety for initial empty state
      }));
    }
  }, [currentUser, allFetchedPhotos, setAiSuggestionsCache]);

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

  const handleShowNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const handleShowPreviousPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center p-4 bg-gray-900 text-white space-y-4 md:space-y-0">
        {/* Left side: App Title */}
        <div className="text-center md:text-left">
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

        {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
          <PhotoModal
            onSaveAiDescription={handleSaveAiDescription}
            photo={photos[selectedPhotoIndex!]}
            onClose={handleCloseModal}
            apiKey={localStorage.getItem('companyCamApiKey') || ''}
            onAddTagToCompanyCam={handleAddTagRequest} // Corrected prop name
            aiSuggestionData={aiSuggestionsCache[photos[selectedPhotoIndex!].id]}
            onFetchAiSuggestions={fetchAiSuggestionsForPhoto}
            // Navigation props
            onShowNextPhoto={handleShowNextPhoto}
            onShowPreviousPhoto={handleShowPreviousPhoto}
            canNavigateNext={selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1}
            canNavigatePrevious={selectedPhotoIndex !== null && selectedPhotoIndex > 0}
            currentIndex={selectedPhotoIndex !== null ? selectedPhotoIndex : -1}
            totalPhotos={photos.length}
          />
        )}
      </div>
    </div>
  );
};

export default HomePage;
