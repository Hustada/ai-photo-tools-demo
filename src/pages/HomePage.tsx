// © 2025 Mark Hustad — MIT License

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '../contexts/UserContext';
import type { Photo, Tag } from '../types';
import scoutAiAvatar from '../assets/scout-ai-avatar-orange2.png';

// Import our extracted hooks
import { usePhotosQuery } from '../hooks/usePhotosQuery';
import { useAiEnhancements } from '../hooks/useAiEnhancements';
import { useTagManagement } from '../hooks/useTagManagement';
import { usePhotoModal } from '../hooks/usePhotoModal';
import { useTagFiltering } from '../hooks/useTagFiltering';
import { useNotificationManager } from '../hooks/useNotificationManager';
import { FilterBar } from '../components/FilterBar';
import { useScoutAi } from '../contexts/ScoutAiContext';

// Import Scout AI
import { ScoutAiProvider } from '../contexts/ScoutAiContext';

// Import components
import PhotoModal from '../components/PhotoModal';
import PhotoCard from '../components/PhotoCard';
import { ScoutAiDemo } from '../components/ScoutAiDemo';
import { NotificationsPanel } from '../components/NotificationsPanel';

const HomePageContent: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    companyDetails,
    projects: userProjects,
    loading: userLoading,
    error: userError,
    userSettings,
  } = useUserContext();

  // Initialize our hooks with React Query
  const photosQuery = usePhotosQuery({
    enabled: !!localStorage.getItem('companyCamApiKey')
  });
  
  const aiEnhancements = useAiEnhancements(currentUser, {
    onPhotoUpdate: photosQuery.updatePhotoInCache,
    currentPhoto: undefined, // Will be set per photo as needed
  });
  
  const tagFiltering = useTagFiltering(photosQuery.photos);
  const tagManagement = useTagManagement(tagFiltering.filteredPhotos, currentUser, {
    onPhotoUpdate: (photoId: string, newTag: Tag, _isFromAiSuggestion: boolean) => {
      // Update the photo in cache with new tag
      const photoToUpdate = photosQuery.allPhotos.find(p => p.id === photoId);
      if (photoToUpdate) {
        const updatedPhoto = {
          ...photoToUpdate,
          tags: [...(photoToUpdate.tags || []), newTag],
        };
        photosQuery.updatePhotoInCache(updatedPhoto);
      }
    },
    onPhotoTagRemoved: (photoId: string, removedTag: Tag) => {
      // Remove the tag from the photo in cache
      const photoToUpdate = photosQuery.allPhotos.find(p => p.id === photoId);
      console.log(`[HomePage] Photo to update:`, photoToUpdate);
      console.log(`[HomePage] Removing tag:`, removedTag);
      if (photoToUpdate) {
        const originalTags = photoToUpdate.tags || [];
        const updatedTags = originalTags.filter(tag => tag.id !== removedTag.id);
        console.log(`[HomePage] Original tags:`, originalTags.map(t => t.id));
        console.log(`[HomePage] Updated tags:`, updatedTags.map(t => t.id));
        console.log(`[HomePage] Tag removed?`, originalTags.length !== updatedTags.length);
        
        const updatedPhoto = {
          ...photoToUpdate,
          tags: updatedTags,
        };
        photosQuery.updatePhotoInCache(updatedPhoto);
      } else {
        console.log(`[HomePage] Photo ${photoId} not found in allPhotos`);
      }
    },
    removeAiTag: aiEnhancements.removeAiTag,
  });
  
  const photoModal = usePhotoModal(tagFiltering.filteredPhotos);


  const notificationManager = useNotificationManager();
  const scoutAi = useScoutAi();

  // Check for API key and redirect if missing
  useEffect(() => {
    const apiKey = localStorage.getItem('companyCamApiKey');
    if (!apiKey) {
      console.warn('[HomePage] No API key found, redirecting to login');
      navigate('/login');
      return;
    }
    // React Query will automatically fetch when enabled and apiKey is available
  }, [navigate]);

  // Note: AI enhancements are already loaded and merged by usePhotoData.fetchPhotos()
  // No need for separate loading here

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        if (photosQuery.hasMorePhotos && !photosQuery.isFetching) {
          photosQuery.loadMore();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [photosQuery.hasMorePhotos, photosQuery.isFetching, photosQuery.loadMore]);

  const handleLogout = () => {
    console.log('HomePage: Logging out.');
    localStorage.removeItem('companyCamApiKey');
    navigate('/login');
  };

  const handleRefreshPhotos = () => {
    photosQuery.refresh();
  };

  const handleAnalyzePhotos = (mode: 'new' | 'all') => {
    if (!currentUser) return; // Don't analyze if no user
    
    const filterOptions = mode === 'new' 
      ? { mode: 'smart' as const, newPhotoDays: 30, forceReanalysis: false }
      : { mode: 'all' as const, forceReanalysis: false };
    
    scoutAi.analyzeSimilarPhotos(photosQuery.photos, true, filterOptions);
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
    <div className="flex flex-col min-h-screen bg-light-gray">
      <div className="sticky top-0 flex flex-col md:flex-row md:justify-between md:items-center p-4 bg-gray-900/95 backdrop-blur-md text-white space-y-4 md:space-y-0 border-b border-gray-700/50 shadow-lg z-50">
        {/* Left side: App Title with Avatar */}
        <div className="flex items-center justify-center md:justify-start space-x-3">
          <img 
            src={scoutAiAvatar} 
            alt="Scout AI" 
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shadow-lg"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-orange-400">Scout AI</h1>
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
              <div className="mt-2 flex flex-col sm:flex-row items-center justify-center md:justify-end space-y-1 sm:space-y-0 sm:space-x-3">
                <a 
                  href="/docs"
                  className="text-sm text-gray-300 hover:text-orange-400 transition-colors px-3 py-1 rounded-md hover:bg-gray-800 flex items-center space-x-1"
                  title="Getting Started with Documentation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Getting Started</span>
                </a>
                <a 
                  href="/blog"
                  className="text-sm text-gray-300 hover:text-orange-400 transition-colors px-3 py-1 rounded-md hover:bg-gray-800 flex items-center space-x-1"
                  title="View CodeCraft development blog"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <span>CodeCraft Dev Blog</span>
                </a>
                <button
                  onClick={handleLogout}
                  className="text-xs text-orange-400 hover:text-orange-300 underline"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 font-sans">
        {/* Filter Section */}
        {tagFiltering.availableFilterTags.length > 0 && (
          <FilterBar
            availableTags={tagFiltering.availableFilterTags}
            activeTags={tagFiltering.activeTagIds}
            onToggleTag={tagFiltering.toggleTag}
            onClearAll={tagFiltering.clearAllFilters}
            totalPhotos={photosQuery.allPhotos.length}
            filteredCount={tagFiltering.filteredPhotos.length}
            onRefresh={handleRefreshPhotos}
            isRefreshing={photosQuery.isLoading}
            onAnalyze={currentUser ? handleAnalyzePhotos : undefined}
            isAnalyzing={currentUser ? scoutAi.isAnalyzing : false}
          />
        )}


        {photosQuery.error && <p className="text-red-400 text-center mb-4 p-3 bg-red-900 border border-red-700 rounded-md">Error: {photosQuery.error.message}</p>}

        {tagManagement.tagError && (
          <div className="mb-6 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md">
            <p>{tagManagement.tagError}</p>
          </div>
        )}


        {/* Notifications Panel */}
        {notificationManager.hasActiveNotifications && (
          <div className="mb-6">
            <NotificationsPanel
              photos={photosQuery.photos}
              onPhotosUpdate={(updatedPhotos: Photo[]) => {
                // Update each photo in cache
                updatedPhotos.forEach(photo => {
                  photosQuery.updatePhotoInCache(photo);
                });
              }}
            />
          </div>
        )}


        {/* Loading State */}
        {photosQuery.isLoading && photosQuery.photos.length === 0 && (
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
                onRemoveTag={tagManagement.handleRemoveTagRequest}
                onTagClick={tagFiltering.toggleTag}
                onPhotoClick={() => photoModal.openModal(photo)}
                mockTagsData={[]} // For manually adding known tags, not AI ones
                aiSuggestionData={aiData}
                onFetchAiSuggestions={aiEnhancements.fetchAiSuggestions}
              />
            );
          })}
        </div>

        {tagFiltering.filteredPhotos.length > 0 && photosQuery.isLoadingMore && (
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
          onRemoveTag={tagManagement.handleRemoveTagRequest}
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

// Wrapper component with ScoutAiProvider
const HomePage: React.FC = () => {
  const { currentUser } = useUserContext();
  
  // Always wrap with ScoutAiProvider, but pass null userId when no user
  return (
    <ScoutAiProvider userId={currentUser?.id || null}>
      <HomePageContent />
    </ScoutAiProvider>
  );
};

export default HomePage;