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
  CamIntellectContextType,
  CamIntellectSuggestion,
  UserCurationPreferences,
  PhotoSimilarityGroup
} from '../types/camintellect';
import { groupSimilarPhotos } from '../utils/photoSimilarity';
import { generateCurationRecommendation, generateCamIntellectMessage } from '../utils/curationLogic';

const CamIntellectContext = createContext<CamIntellectContextType | undefined>(undefined);

interface CamIntellectProviderProps {
  children: ReactNode;
  userId: string;
}

export const CamIntellectProvider: React.FC<CamIntellectProviderProps> = ({ 
  children, 
  userId 
}) => {
  const [suggestions, setSuggestions] = useState<CamIntellectSuggestion[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserCurationPreferences | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load user preferences from localStorage on mount
  useEffect(() => {
    const loadUserPreferences = () => {
      try {
        const stored = localStorage.getItem(`camintellect-preferences-${userId}`);
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
          localStorage.setItem(`camintellect-preferences-${userId}`, JSON.stringify(defaultPreferences));
        }
      } catch (err) {
        console.warn('[CamIntellect] Failed to load user preferences:', err);
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
      console.warn('[CamIntellect] User preferences not loaded yet');
      return [];
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('[CamIntellect] Analyzing', photos.length, 'photos for similarity');
      
      // Use user's quality threshold for grouping
      const groups = await groupSimilarPhotos(photos, userPreferences.qualityThreshold);
      
      console.log('[CamIntellect] Found', groups.length, 'similar photo groups');
      
      if (groups.length > 0) {
        // Generate recommendations for each group
        const recommendations = groups.map(group => generateCurationRecommendation(group));
        
        // Create CamIntellect suggestion
        const suggestion: CamIntellectSuggestion = {
          id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'photo_curation',
          message: generateCamIntellectMessage(recommendations),
          recommendations,
          confidence: recommendations.length > 0 ? 
            recommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recommendations.length > 0.7 ? 'high' : 'medium' 
            : 'low',
          actionable: true,
          createdAt: new Date(),
          status: 'pending'
        };

        setSuggestions(prev => [suggestion, ...prev]);
        console.log('[CamIntellect] Generated suggestion:', suggestion.message);
      }

      return groups;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Photo analysis failed';
      console.error('[CamIntellect] Analysis error:', err);
      setError(errorMessage);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, [userPreferences]);

  // Generate a suggestion from similarity groups (used by analyzeSimilarPhotos)
  const generateSuggestion = useCallback((groups: PhotoSimilarityGroup[]): CamIntellectSuggestion => {
    const recommendations = groups.map(group => generateCurationRecommendation(group));
    
    return {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'photo_curation',
      message: generateCamIntellectMessage(recommendations),
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
  const acceptSuggestion = useCallback(async (suggestionId: string): Promise<void> => {
    if (!userPreferences) return;

    try {
      setSuggestions(prev => 
        prev.map(suggestion => 
          suggestion.id === suggestionId 
            ? { ...suggestion, status: 'accepted' as const }
            : suggestion
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
      console.log('[CamIntellect] Accepted suggestion:', suggestionId);
    } catch (err) {
      console.error('[CamIntellect] Failed to accept suggestion:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion');
    }
  }, [userPreferences]);

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
      console.log('[CamIntellect] Rejected suggestion:', suggestionId);
    } catch (err) {
      console.error('[CamIntellect] Failed to reject suggestion:', err);
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
    console.log('[CamIntellect] Dismissed suggestion:', suggestionId);
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
      localStorage.setItem(`camintellect-preferences-${userId}`, JSON.stringify(updatedPreferences));
      console.log('[CamIntellect] Updated user preferences');
    } catch (err) {
      console.error('[CamIntellect] Failed to update preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  }, [userPreferences, userId]);

  const contextValue: CamIntellectContextType = {
    suggestions,
    userPreferences,
    isAnalyzing,
    error,
    analyzeSimilarPhotos,
    generateSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,
    updateUserPreferences
  };

  return (
    <CamIntellectContext.Provider value={contextValue}>
      {children}
    </CamIntellectContext.Provider>
  );
};

export const useCamIntellect = (): CamIntellectContextType => {
  const context = useContext(CamIntellectContext);
  if (context === undefined) {
    throw new Error('useCamIntellect must be used within a CamIntellectProvider');
  }
  return context;
};