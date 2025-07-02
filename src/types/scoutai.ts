// © 2025 Mark Hustad — MIT License

import type { Photo } from './index';
import type { FilterOptions } from '../utils/photoFiltering';
import type { AnalysisStats } from '../hooks/useAnalysisTracking';

export interface SimilarityAnalysis {
  visualSimilarity: number;      // How visually similar (0-1)
  contentSimilarity: number;     // Same work area/subject (0-1)
  temporalProximity: number;     // Time proximity score (0-1)
  spatialProximity: number;      // GPS distance score (0-1)
  semanticSimilarity: number;    // AI-detected content overlap (0-1)
  overallSimilarity: number;     // Combined similarity score (0-1)
}

export interface PhotoSimilarityGroup {
  id: string;
  photos: Photo[];
  similarity: SimilarityAnalysis;
  groupType: 'incremental_progress' | 'angle_variations' | 'retry_shots' | 'redundant_documentation' | 'exact_duplicates';
  confidence: number;            // How confident we are in this grouping (0-1)
}

export interface CurationRecommendation {
  group: PhotoSimilarityGroup;
  keep: Photo[];                 // Best representative photos
  archive: Photo[];              // Similar but lower quality/value
  rationale: string;             // Human-readable explanation
  estimatedTimeSaved: number;    // Minutes saved by following recommendation
  confidence: number;            // Confidence in this recommendation (0-1)
}

export interface ScoutAiSuggestion {
  id: string;
  type: 'photo_curation' | 'tag_suggestion' | 'description_enhancement';
  message: string;               // Conversational message to user
  recommendations: CurationRecommendation[];
  confidence: 'high' | 'medium' | 'low';
  actionable: boolean;           // Whether user can take action on this
  createdAt: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed';
}

export interface UserCurationPreferences {
  userId: string;
  preferredGroupTypes: Record<string, boolean>; // Which types of grouping they like
  qualityThreshold: number;      // Minimum quality threshold for keeping photos
  detailLevel: 'brief' | 'detailed' | 'technical'; // Preferred explanation style
  acceptanceRate: Record<string, number>; // Track acceptance by recommendation type
  learningData: {
    acceptedRecommendations: string[];
    rejectedRecommendations: string[];
    preferredKeepCriteria: string[]; // What makes them keep certain photos
  };
}

export interface PhotoQualityMetrics {
  sharpness: number;             // Image sharpness score (0-1)
  lighting: number;              // Lighting quality score (0-1)
  composition: number;           // Composition quality score (0-1)
  informationContent: number;    // How much information the photo contains (0-1)
  documentationValue: number;    // Overall documentation value (0-1)
}

export interface PhotoAction {
  type: 'archive' | 'keep' | 'tag' | 'delete';
  photoId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface CurationActionResult {
  success: boolean;
  appliedActions: PhotoAction[];
  failedActions: PhotoAction[];
  updatedPhotos: Photo[];
  error?: string;
}

export interface UndoAction {
  id: string;
  suggestionId: string;
  description: string;
  timestamp: Date;
  actions: Array<{
    type: 'archive' | 'restore';
    photoId: string;
    previousState: any;
  }>;
}

export interface VisualSimilarityState {
  isAnalyzing: boolean;
  progress: number;
  error: string | null;
  similarityGroups: PhotoSimilarityGroup[];
  similarityMatrix: Map<string, Map<string, SimilarityAnalysis>>;
}

export interface ScoutAiContextType {
  suggestions: ScoutAiSuggestion[];
  userPreferences: UserCurationPreferences | null;
  isAnalyzing: boolean;
  error: string | null;
  undoStack: UndoAction[];
  
  // Actions
  analyzeSimilarPhotos: (photos: Photo[], clearExisting?: boolean, filterOptions?: FilterOptions) => Promise<PhotoSimilarityGroup[]>;
  generateSuggestion: (groups: PhotoSimilarityGroup[]) => ScoutAiSuggestion;
  acceptSuggestion: (suggestionId: string, photos: Photo[], onPhotoUpdate: (photo: Photo) => void) => Promise<CurationActionResult>;
  rejectSuggestion: (suggestionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => void;
  updateUserPreferences: (preferences: Partial<UserCurationPreferences>) => Promise<void>;
  
  // Photo management actions
  applyCurationActions: (actions: PhotoAction[], photos: Photo[], onPhotoUpdate: (photo: Photo) => void) => Promise<CurationActionResult>;
  archivePhoto: (photoId: string, reason: string, photos: Photo[], onPhotoUpdate: (photo: Photo) => void) => Promise<void>;
  restorePhoto: (photoId: string, photos: Photo[], onPhotoUpdate: (photo: Photo) => void) => Promise<void>;
  
  // Undo functionality
  undoLastAction: (photos: Photo[], onPhotoUpdate: (photo: Photo) => void) => Promise<void>;
  clearUndoStack: () => void;
  clearSuggestions: () => void;
  updateSuggestionStatus: (suggestionId: string, status: 'pending' | 'accepted' | 'rejected' | 'dismissed') => void;
  
  // Visual similarity functionality
  visualSimilarity: {
    state: VisualSimilarityState;
    getSimilarityScore: (photo1Id: string, photo2Id: string) => SimilarityAnalysis | null;
    getGroupForPhoto: (photoId: string) => PhotoSimilarityGroup | null;
    cancelAnalysis: () => void;
  };
  
  // Analysis tracking functionality
  analysisTracking: {
    getAnalysisStats: (photos: Photo[]) => AnalysisStats;
    shouldSuggestAnalysis: (photos: Photo[], daysSince?: number) => boolean;
    getAnalysisStatusMessage: (photos: Photo[]) => string;
    isMarkingAnalyzed: boolean;
    error: string | null;
  };
}