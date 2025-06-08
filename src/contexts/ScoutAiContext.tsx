// © 2025 Mark Hustad — MIT License

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { Photo } from '../types';
import type {
  ScoutAiContextType,
  ScoutAiSuggestion,
  UserCurationPreferences,
  PhotoSimilarityGroup,
  CurationActionResult
} from '../types/scoutai';
import { groupSimilarPhotos } from '../utils/photoSimilarity';
import { generateCurationRecommendation, generateScoutAiMessage } from '../utils/curationLogic';
import { 
  applyCurationActions, 
  createActionsFromRecommendation,
  archivePhoto as archivePhotoUtil,
  restorePhoto as restorePhotoUtil
} from '../utils/photoActions';

const ScoutAiContext = createContext<ScoutAiContextType | undefined>(undefined);

interface ScoutAiProviderProps {
  children: ReactNode;
  userId: string;
}

export const ScoutAiProvider: React.FC<ScoutAiProviderProps> = ({ 
  children, 
  userId
}) => {
  const [suggestions, setSuggestions] = useState<ScoutAiSuggestion[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserCurationPreferences | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences from localStorage on mount
  useEffect(() => {
    const loadUserPreferences = () => {
      try {
        const stored = localStorage.getItem(`scoutai-preferences-${userId}`);
        if (stored) {
          const preferences = JSON.parse(stored) as UserCurationPreferences;
          setUserPreferences(preferences);
        } else {
          // Create default preferences for new user
          const defaultPreferences: UserCurationPreferences = {
            userId,
            preferredGroupTypes: {
              retry_shots: true,
              angle_variations: true,
              incremental_progress: true,
              redundant_documentation: true
            },
            qualityThreshold: 0.6,
            detailLevel: 'detailed',
            acceptanceRate: {},
            learningData: {
              acceptedRecommendations: [],
              rejectedRecommendations: [],
              preferredKeepCriteria: []
            }
          };
          setUserPreferences(defaultPreferences);
          localStorage.setItem(`scoutai-preferences-${userId}`, JSON.stringify(defaultPreferences));
        }
      } catch (err) {
        console.warn('[Scout AI] Failed to load user preferences:', err);
        // Set minimal default if localStorage fails
        setUserPreferences({
          userId,
          preferredGroupTypes: { retry_shots: true, angle_variations: true, incremental_progress: true, redundant_documentation: true },
          qualityThreshold: 0.6,
          detailLevel: 'detailed',
          acceptanceRate: {},
          learningData: { acceptedRecommendations: [], rejectedRecommendations: [], preferredKeepCriteria: [] }
        });
      }
    };

    if (userId) {
      loadUserPreferences();
    }
  }, [userId]);

  // Analyze photos for similarity and generate suggestions
  const analyzeSimilarPhotos = useCallback(async (photos: Photo[]): Promise<PhotoSimilarityGroup[]> => {
    if (!userPreferences) {
      console.warn('[Scout AI] User preferences not loaded yet');
      return [];
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('[Scout AI] Analyzing', photos.length, 'photos for similarity');
      
      // Use user's quality threshold for grouping
      const groups = await groupSimilarPhotos(photos, userPreferences.qualityThreshold);
      
      console.log('[Scout AI] Found', groups.length, 'similar photo groups');
      
      if (groups.length > 0) {
        // Generate recommendations for each group
        const recommendations = groups.map(group => generateCurationRecommendation(group));
        
        // Create Scout AI suggestion
        const suggestion: ScoutAiSuggestion = {
          id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'photo_curation',
          message: generateScoutAiMessage(recommendations),
          recommendations,
          confidence: recommendations.length > 0 ? 
            recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length > 0.7 ? 'high' : 'medium' 
            : 'low',
          actionable: true,
          createdAt: new Date(),
          status: 'pending'
        };

        setSuggestions(prev => [suggestion, ...prev]);
        console.log('[Scout AI] Generated suggestion:', suggestion.message);
      }

      return groups;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Photo analysis failed';
      console.error('[Scout AI] Analysis error:', err);
      setError(errorMessage);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, [userPreferences]);

  // Generate a suggestion from similarity groups (used by analyzeSimilarPhotos)
  const generateSuggestion = useCallback((groups: PhotoSimilarityGroup[]): ScoutAiSuggestion => {
    const recommendations = groups.map(group => generateCurationRecommendation(group));
    
    return {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'photo_curation',
      message: generateScoutAiMessage(recommendations),
      recommendations,
      confidence: recommendations.length > 0 ? 
        recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length > 0.7 ? 'high' : 'medium' 
        : 'low',
      actionable: true,
      createdAt: new Date(),
      status: 'pending'
    };
  }, []);

  // Accept a suggestion and update user preferences
  const acceptSuggestion = useCallback(async (
    suggestionId: string, 
    photos: Photo[], 
    onPhotoUpdate: (photo: Photo) => void
  ): Promise<CurationActionResult> => {
    if (!userPreferences) {
      throw new Error('User preferences not loaded');
    }

    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    try {
      // Create actions from all recommendations in the suggestion
      const allActions = suggestion.recommendations.flatMap(createActionsFromRecommendation);
      
      console.log('[Scout AI] Applying', allActions.length, 'actions for suggestion:', suggestionId);
      
      // Apply the curation actions to the photos
      const result = await applyCurationActions(allActions, photos, onPhotoUpdate);
      
      if (result.success) {
        // Update suggestion status to accepted
        setSuggestions(prev => 
          prev.map(s => 
            s.id === suggestionId 
              ? { ...s, status: 'accepted' as const }
              : s
          )
        );

        // Update user learning data
        const updatedPreferences: UserCurationPreferences = {
          ...userPreferences,
          learningData: {
            ...userPreferences.learningData,
            acceptedRecommendations: [...userPreferences.learningData.acceptedRecommendations, suggestionId]
          }
        };

        await updateUserPreferences(updatedPreferences);
        console.log('[Scout AI] Successfully accepted suggestion and applied', result.appliedActions.length, 'actions');
      } else {
        console.warn('[Scout AI] Some actions failed when accepting suggestion:', result.error);
        setError(result.error || 'Some photo actions failed to apply');
      }

      return result;
    } catch (err) {
      console.error('[Scout AI] Failed to accept suggestion:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept suggestion';
      setError(errorMessage);
      throw err;
    }
  }, [userPreferences, suggestions]);

  // Reject a suggestion and update user preferences
  const rejectSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    if (!userPreferences) return;

    try {
      setSuggestions(prev => 
        prev.map(suggestion => 
          suggestion.id === suggestionId 
            ? { ...suggestion, status: 'rejected' as const }
            : suggestion
        )
      );

      // Update user learning data
      const updatedPreferences: UserCurationPreferences = {
        ...userPreferences,
        learningData: {
          ...userPreferences.learningData,
          rejectedRecommendations: [...userPreferences.learningData.rejectedRecommendations, suggestionId]
        }
      };

      await updateUserPreferences(updatedPreferences);
      console.log('[Scout AI] Rejected suggestion:', suggestionId);
    } catch (err) {
      console.error('[Scout AI] Failed to reject suggestion:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject suggestion');
    }
  }, [userPreferences]);

  // Dismiss a suggestion (no learning impact)
  const dismissSuggestion = useCallback((suggestionId: string): void => {
    setSuggestions(prev => 
      prev.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, status: 'dismissed' as const }
          : suggestion
      )
    );
    console.log('[Scout AI] Dismissed suggestion:', suggestionId);
  }, []);

  // Update user preferences and persist to localStorage
  const updateUserPreferences = useCallback(async (preferences: Partial<UserCurationPreferences>): Promise<void> => {
    if (!userPreferences) return;

    try {
      const updatedPreferences: UserCurationPreferences = {
        ...userPreferences,
        ...preferences,
        userId // Ensure userId is preserved
      };

      setUserPreferences(updatedPreferences);
      localStorage.setItem(`scoutai-preferences-${userId}`, JSON.stringify(updatedPreferences));
      console.log('[Scout AI] Updated user preferences');
    } catch (err) {
      console.error('[Scout AI] Failed to update preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  }, [userPreferences, userId]);

  // Apply curation actions directly
  const applyCurationActionsMethod = useCallback(async (
    actions: any[], 
    photos: Photo[], 
    onPhotoUpdate: (photo: Photo) => void
  ): Promise<CurationActionResult> => {
    return await applyCurationActions(actions, photos, onPhotoUpdate);
  }, []);

  // Archive a photo
  const archivePhoto = useCallback(async (
    photoId: string, 
    reason: string, 
    photos: Photo[], 
    onPhotoUpdate: (photo: Photo) => void
  ): Promise<void> => {
    await archivePhotoUtil(photoId, reason, photos, onPhotoUpdate);
  }, []);

  // Restore a photo
  const restorePhoto = useCallback(async (
    photoId: string, 
    photos: Photo[], 
    onPhotoUpdate: (photo: Photo) => void
  ): Promise<void> => {
    await restorePhotoUtil(photoId, photos, onPhotoUpdate);
  }, []);

  const contextValue: ScoutAiContextType = {
    suggestions,
    userPreferences,
    isAnalyzing,
    error,
    analyzeSimilarPhotos,
    generateSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,
    updateUserPreferences,
    applyCurationActions: applyCurationActionsMethod,
    archivePhoto,
    restorePhoto
  };

  return (
    <ScoutAiContext.Provider value={contextValue}>
      {children}
    </ScoutAiContext.Provider>
  );
};

export const useScoutAi = (): ScoutAiContextType => {
  const context = useContext(ScoutAiContext);
  if (context === undefined) {
    throw new Error('useScoutAi must be used within a ScoutAiProvider');
  }
  return context;
};