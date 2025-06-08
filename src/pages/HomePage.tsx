// © 2025 Mark Hustad — MIT License

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import type { Photo, Tag } from '../types';

// Import our extracted hooks
import { usePhotoData } from '../hooks/usePhotoData';
import { useAiEnhancements } from '../hooks/useAiEnhancements';
import { useTagManagement } from '../hooks/useTagManagement';
import { usePhotoModal } from '../hooks/usePhotoModal';
import { useTagFiltering } from '../hooks/useTagFiltering';

// Import components
import PhotoModal from '../components/PhotoModal';
import PhotoCard from '../components/PhotoCard';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    companyDetails,
    projects: userProjects,
    loading: userLoading,
    error: userError,
  } = useUserContext();

  // Initialize our hooks
  const photoData = usePhotoData();
  const aiEnhancements = useAiEnhancements(currentUser, {
    onPhotoUpdate: photoData.updatePhotoInCache,
    currentPhoto: undefined, // Will be set per photo as needed
  });
  const tagFiltering = useTagFiltering(photoData.photos);
  const tagManagement = useTagManagement(tagFiltering.filteredPhotos, currentUser, {
    onPhotoUpdate: (photoId: string, newTag: Tag, isFromAiSuggestion: boolean) => {
      // Update the photo in cache with new tag
      const photoToUpdate = photoData.allFetchedPhotos.find(p => p.id === photoId);
      if (photoToUpdate) {
        const updatedPhoto = {
          ...photoToUpdate,
          tags: [...(photoToUpdate.tags || []), newTag],
        };
        photoData.updatePhotoInCache(updatedPhoto);
      }
    },
  });
  const photoModal = usePhotoModal(tagFiltering.filteredPhotos);

  // Check for API key and redirect if missing
  useEffect(() => {
    const apiKey = localStorage.getItem('companyCamApiKey');
    if (!apiKey) {
      console.warn('[HomePage] No API key found, redirecting to login');
      navigate('/login');
      return;
    }

    // Initial photo fetch
    photoData.fetchPhotos(1);
  }, [navigate, photoData.fetchPhotos]);

  // Note: AI enhancements are already loaded and merged by usePhotoData.fetchPhotos()
  // No need for separate loading here

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        if (photoData.hasMorePhotos && !photoData.isLoading) {
          photoData.loadMore();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [photoData.hasMorePhotos, photoData.isLoading, photoData.loadMore]);

  const handleLogout = () => {
    console.log('HomePage: Logging out.');
    localStorage.removeItem('companyCamApiKey');
    navigate('/login');
  };

  const handleRefreshPhotos = () => {
    photoData.refreshPhotos();
  };

  // Handle user context loading and errors
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading user context...</div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">Error: {userError}</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">No user found. Please log in.</div>
      </div>
    );
  }

  const selectedPhoto = photoModal.selectedPhoto;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center p-4 bg-gray-900 text-white space-y-4 md:space-y-0">
        {/* Left side: App Title */}
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-sky-400">CompanyCam AI Photo Inspirations</h1>
        </div>

        {/* Right side: User Info / Loading / Error */}
        <div className="text-center md:text-right">
          {userLoading && (
            <p className="text-md animate-pulse">Loading user...</p>
          )}
          {userError && !userLoading && (
            <div>
              <p className="text-red-400 font-semibold text-sm">User data unavailable</p>
            </div>
          )}
          {currentUser && !userLoading && !userError && (
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
        {/* Filter Section */}
        {tagFiltering.availableFilterTags.length > 0 && (
          <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-800 shadow-md">
            <h2 className="text-xl font-semibold mb-3 text-sky-300">Filter by Tags:</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {tagFiltering.availableFilterTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => tagFiltering.toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all duration-150 ease-in-out transform hover:scale-105
                    ${
                      tagFiltering.activeTagIds.includes(tag.id)
                        ? 'bg-sky-500 text-white shadow-lg'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                >
                  {tag.display_value} ({photoData.allFetchedPhotos.filter(p => p.tags?.some(t => t.id === tag.id)).length})
                </button>
              ))}
            </div>
            {tagFiltering.activeTagIds.length > 0 && (
              <div className="mt-3 flex items-center">
                <span className="text-sm font-medium text-gray-400">Active filters: </span>
                <div className="flex flex-wrap gap-1 ml-2">
                  {tagFiltering.activeTagIds.map(tagId => {
                    const tag = tagFiltering.availableFilterTags.find(t => t.id === tagId);
                    return (
                      <span key={tagId} className="inline-block bg-sky-600 text-white px-2.5 py-1 rounded-full text-xs">
                        {tag ? tag.display_value : tagId}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={tagFiltering.clearAllFilters}
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
            disabled={photoData.isLoading || !localStorage.getItem('companyCamApiKey')}
            className="px-6 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-500 disabled:bg-gray-600 disabled:opacity-70 transition-all duration-150 ease-in-out shadow-md hover:shadow-lg transform hover:scale-105"
          >
            {photoData.isLoading && photoData.photos.length === 0 ? 'Fetching Photos...' : 'Refresh Photos'}
          </button>
        </div>

        {photoData.error && <p className="text-red-400 text-center mb-4 p-3 bg-red-900 border border-red-700 rounded-md">Error: {photoData.error}</p>}

        {tagManagement.tagError && (
          <div className="mb-6 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md">
            <p>{tagManagement.tagError}</p>
          </div>
        )}

        {/* Loading State */}
        {photoData.isLoading && photoData.photos.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-300">Loading photos...</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {tagFiltering.filteredPhotos.map((photo) => {
            const aiData = aiEnhancements.getAiDataForPhoto(photo.id);
            return (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onAddTagToCompanyCam={tagManagement.handleAddTagRequest}
                onAddAiTag={aiEnhancements.addAiTag}
                onTagClick={tagFiltering.toggleTag}
                onPhotoClick={() => photoModal.openModal(photo)}
                mockTagsData={[]} // For manually adding known tags, not AI ones
                aiSuggestionData={aiData}
                onFetchAiSuggestions={aiEnhancements.fetchAiSuggestions}
              />
            );
          })}
        </div>

        {tagFiltering.filteredPhotos.length > 0 && photoData.isLoading && (
          <div className="text-center mt-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-300">Loading more photos...</p>
          </div>
        )}

      </div>

      {/* Photo Modal */}
      {photoModal.isModalOpen && selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={photoModal.closeModal}
          apiKey={localStorage.getItem('companyCamApiKey') || ''}
          onAddTagToCompanyCam={tagManagement.handleAddTagRequest}
          onAddAiTag={aiEnhancements.addAiTag}
          aiSuggestionData={aiEnhancements.getAiDataForPhoto(selectedPhoto.id)}
          onFetchAiSuggestions={aiEnhancements.fetchAiSuggestions}
          onSaveAiDescription={aiEnhancements.saveAiDescription}
          onShowNextPhoto={photoModal.showNextPhoto}
          onShowPreviousPhoto={photoModal.showPreviousPhoto}
          canNavigateNext={photoModal.canNavigateNext}
          canNavigatePrevious={photoModal.canNavigatePrevious}
          currentIndex={photoModal.currentIndex}
          totalPhotos={photoModal.totalPhotos}
        />
      )}
    </div>
  );
};

export default HomePage;