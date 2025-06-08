// © 2025 Mark Hustad — MIT License

import type { Photo } from './index';

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
  groupType: 'incremental_progress' | 'angle_variations' | 'retry_shots' | 'redundant_documentation';
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

export interface CamIntellectSuggestion {
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

export interface CamIntellectContextType {
  suggestions: CamIntellectSuggestion[];
  userPreferences: UserCurationPreferences | null;
  isAnalyzing: boolean;
  error: string | null;
  
  // Actions
  analyzeSimilarPhotos: (photos: Photo[]) => Promise<PhotoSimilarityGroup[]>;
  generateSuggestion: (groups: PhotoSimilarityGroup[]) => CamIntellectSuggestion;
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  rejectSuggestion: (suggestionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => void;
  updateUserPreferences: (preferences: Partial<UserCurationPreferences>) => Promise<void>;
}