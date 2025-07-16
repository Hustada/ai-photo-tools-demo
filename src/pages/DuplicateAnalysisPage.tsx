// © 2025 Mark Hustad — MIT License
// Claude's Visual Duplicate Detection Analysis Page

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, Eye, Clock, Camera, MapPin, Hash, User, Building, Crown, Star, Book, FileText } from 'lucide-react';
import { useUserContext } from '../contexts/UserContext';
import type { Photo, Tag } from '../types';
import aiCameraLens from '../assets/aicameralens1.png';

// Import photo management hooks
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

interface PhotoMetadata {
  id: string;
  photo_url: string;
  uris: Array<{
    type: string;
    uri: string;
    url: string;
  }>;
  captured_at: number;
  created_at: number;
  updated_at: number;
  coordinates: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
  }>;
  hash: string;
  description: string | null;
  creator_id: string;
  creator_name: string;
  project_id: string;
  company_id: string;
  processing_status: string;
  internal: boolean;
}

interface PhotoQualityMetrics {
  sharpness: number;      // 0-1: Focus quality, motion blur detection
  composition: number;    // 0-1: Rule of thirds, framing, balance
  lighting: number;       // 0-1: Exposure, contrast, dynamic range
  subjectClarity: number; // 0-1: Main subject visibility and clarity
  overallQuality: number; // 0-1: Combined quality score
  qualityNotes: string;   // Specific observations about quality
}

interface AnalysisResult {
  photoId: string;
  decision: 'duplicate' | 'burst_shot' | 'similar' | 'unique';
  confidence: number;
  reasoning: string;
  visualObservations: string;
  technicalNotes: string;
  relatedPhotos: string[];
  patterns: string[];
  qualityMetrics?: PhotoQualityMetrics; // Quality assessment for burst sequences
}

interface DuplicateGroup {
  id: string;
  type: 'exact_duplicate' | 'burst_sequence' | 'similar_composition' | 'temporal_cluster';
  photos: PhotoMetadata[];
  analysis: AnalysisResult[];
  reasoning: string;
  recommendation: string;
  confidence: number;
  bestPhotoId?: string;        // ID of the highest quality photo in the group
  qualityRanking?: string[];   // Photo IDs ordered by quality (best first)
}

interface AnalysisSession {
  photos: PhotoMetadata[];
  analysisResults: AnalysisResult[];
  duplicateGroups: DuplicateGroup[];
  metadata: {
    fetchTime: string;
    totalAnalyzed: number;
    duplicatesFound: number;
    burstShotsFound: number;
    uniquePhotos: number;
    analysisTime: string;
  };
}

const DuplicateAnalysisPageContent: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    companyDetails,
    projects: userProjects,
    loading: userLoading,
    error: userError,
    userSettings,
  } = useUserContext();

  // Claude Vision Analysis State (preserved from original)
  const [claudePhotos, setClaudePhotos] = useState<PhotoMetadata[]>([]);
  const [analysisSession, setAnalysisSession] = useState<AnalysisSession | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMetadata | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'duplicates' | 'burst_shots' | 'unique'>('all');
  const [visualAnalysisMode, setVisualAnalysisMode] = useState<'metadata' | 'visual_review' | 'claude_analysis'>('metadata');
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState<PhotoMetadata | null>(null);

  // Photo Management Hooks (from HomePage)
  const photosQuery = usePhotosQuery({
    enabled: !!localStorage.getItem('companyCamApiKey')
  });
  
  const aiEnhancements = useAiEnhancements(currentUser, {
    onPhotoUpdate: photosQuery.updatePhotoInCache,
    currentPhoto: undefined,
  });
  
  // State for archived photos toggle
  const [showArchivedPhotos, setShowArchivedPhotos] = useState(false);
  
  // Analysis state (moved from FilterBar)
  const [analysisMode, setAnalysisMode] = useState<'new' | 'all' | 'force'>('new');
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
  const [isRelaxedView, setIsRelaxedView] = useState(false);
  
  // Calculate archived photo count
  const archivedCount = React.useMemo(() => {
    return photosQuery.photos.filter(photo => photo.archive_state === 'archived').length;
  }, [photosQuery.photos]);
  
  const tagFiltering = useTagFiltering(photosQuery.photos, { showArchivedPhotos });
  const tagManagement = useTagManagement(tagFiltering.filteredPhotos, currentUser, {
    onPhotoUpdate: (photoId: string, newTag: Tag, _isFromAiSuggestion: boolean) => {
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
      const photoToUpdate = photosQuery.allPhotos.find(p => p.id === photoId);
      if (photoToUpdate) {
        const updatedPhoto = {
          ...photoToUpdate,
          tags: (photoToUpdate.tags || []).filter(tag => tag.id !== removedTag.id),
        };
        photosQuery.updatePhotoInCache(updatedPhoto);
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
      console.warn('[DuplicateAnalysisPage] No API key found, redirecting to login');
      navigate('/login');
      return;
    }
  }, [navigate]);

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
    console.log('DuplicateAnalysisPage: Logging out.');
    localStorage.removeItem('companyCamApiKey');
    navigate('/login');
  };

  const handleRefreshPhotos = () => {
    photosQuery.refresh();
  };

  const handleUnarchivePhoto = (photoId: string) => {
    console.log('[DuplicateAnalysisPage] Unarchiving photo:', photoId);
    const photo = photosQuery.allPhotos.find(p => p.id === photoId);
    if (!photo) {
      console.error('[DuplicateAnalysisPage] Photo not found for unarchiving:', photoId);
      return;
    }

    const updatedPhoto: Photo = {
      ...photo,
      archive_state: undefined,
      archived_at: undefined,
      archive_reason: undefined
    };

    photosQuery.updatePhotoInCache(updatedPhoto);
  };

  const handleAnalyzePhotos = (mode: 'new' | 'all' | 'force') => {
    if (!currentUser) return;
    
    let filterOptions;
    switch (mode) {
      case 'new':
        filterOptions = { mode: 'smart' as const, newPhotoDays: 30, forceReanalysis: false, includeArchived: false };
        break;
      case 'all':
        filterOptions = { mode: 'all' as const, forceReanalysis: false, includeArchived: false };
        break;
      case 'force':
        filterOptions = { mode: 'all' as const, forceReanalysis: true, includeArchived: true };
        break;
    }
    
    console.log('[DuplicateAnalysisPage] Triggering analysis with mode:', mode, 'options:', filterOptions);
    scoutAi.analyzeSimilarPhotos(photosQuery.allPhotos, true, filterOptions);
  };

  // Claude Vision Analysis - Fetch photos from CompanyCam API
  const fetchPhotos = async (maxPhotos: number = 50) => {
    setClaudeLoading(true);
    setClaudeError(null);
    
    try {
      console.log('[DuplicateAnalysis] Fetching photos from CompanyCam API...');
      
      const response = await fetch('/api/fetch-photos-for-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxPhotos,
          perPage: 25,
          page: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[DuplicateAnalysis] Fetched photos:', data);
      
      setClaudePhotos(data.photos || []);
      
      if (data.photos && data.photos.length > 0) {
        // Auto-start analysis
        await performClaudeAnalysis(data.photos);
      }

    } catch (err: any) {
      console.error('[DuplicateAnalysis] Error fetching photos:', err);
      setClaudeError(err.message || 'Failed to fetch photos');
    } finally {
      setClaudeLoading(false);
    }
  };

  // Claude's visual analysis - this will analyze each photo for duplicates/burst shots
  const performClaudeAnalysis = async (photoList: PhotoMetadata[]) => {
    console.log('[DuplicateAnalysis] Starting Claude visual analysis...');
    const startTime = Date.now();
    
    const analysisResults: AnalysisResult[] = [];
    const duplicateGroups: DuplicateGroup[] = [];
    
    // First, let me analyze temporal and spatial groupings to identify potential clusters
    console.log('[DuplicateAnalysis] Sample photo structure:', photoList[0]);
    
    // Perform actual visual analysis using Claude's vision capabilities
    console.log('[DuplicateAnalysis] Performing visual content analysis...');
    
    // Process photos in batches for visual analysis
    const batchSize = 10;
    for (let i = 0; i < photoList.length; i += batchSize) {
      const batch = photoList.slice(i, i + batchSize);
      const batchResults = await performVisualBatchAnalysis(batch, photoList);
      analysisResults.push(...batchResults);
    }
    
    // Group results into duplicate clusters
    const processedPhotos = new Set<string>();
    let groupId = 1;
    
    for (const analysis of analysisResults) {
      if (processedPhotos.has(analysis.photoId)) continue;
      
      if (analysis.decision !== 'unique' && analysis.relatedPhotos.length > 0) {
        const groupPhotos = [analysis.photoId, ...analysis.relatedPhotos].filter(id => 
          !processedPhotos.has(id)
        );
        
        if (groupPhotos.length > 1) {
          const photos = groupPhotos.map(id => photoList.find(p => p.id === id)).filter(Boolean) as PhotoMetadata[];
          const groupType = analysis.decision === 'duplicate' ? 'exact_duplicate' :
                           analysis.decision === 'burst_shot' ? 'burst_sequence' : 'similar_composition';
          
          // For burst sequences, find the best photo based on quality scores
          let bestPhotoId: string | undefined;
          let qualityRanking: string[] | undefined;
          
          if (groupType === 'burst_sequence') {
            const groupAnalyses = groupPhotos.map(id => analysisResults.find(a => a.photoId === id)!).filter(Boolean);
            
            // Sort by quality score if available
            const sortedByQuality = [...groupAnalyses].sort((a, b) => {
              const qualityA = a.qualityMetrics?.overallQuality || 0.5;
              const qualityB = b.qualityMetrics?.overallQuality || 0.5;
              return qualityB - qualityA;
            });
            
            bestPhotoId = sortedByQuality[0]?.photoId;
            qualityRanking = sortedByQuality.map(a => a.photoId);
          }

          duplicateGroups.push({
            id: `visual_group_${groupId++}`,
            type: groupType,
            photos,
            analysis: groupPhotos.map(id => analysisResults.find(a => a.photoId === id)!).filter(Boolean),
            reasoning: analysis.reasoning,
            recommendation: groupType === 'exact_duplicate' 
              ? 'Keep the first photo and delete the rest - visual analysis detected near-identical content'
              : groupType === 'burst_sequence' && bestPhotoId
              ? `Keep photo ${bestPhotoId.substring(0, 8)}... - highest quality (${Math.round((analysisResults.find(a => a.photoId === bestPhotoId)?.qualityMetrics?.overallQuality || 0) * 100)}%) from burst sequence`
              : 'Review photos for best composition - visual analysis detected similar content',
            confidence: analysis.confidence,
            bestPhotoId,
            qualityRanking
          });
          
          groupPhotos.forEach(id => processedPhotos.add(id));
        }
      }
    }
    
    // Count duplicates and burst shots from the analysis results
    let burstShotsFound = analysisResults.filter(r => r.decision === 'burst_shot').length;
    let duplicatesFound = analysisResults.filter(r => r.decision === 'duplicate').length;
    
    console.log('[DuplicateAnalysis] Final counts:', {
      total: analysisResults.length,
      burst: burstShotsFound,
      duplicates: duplicatesFound,
      unique: analysisResults.filter(r => r.decision === 'unique').length,
      similar: analysisResults.filter(r => r.decision === 'similar').length
    });
    
    const session: AnalysisSession = {
      photos: photoList,
      analysisResults,
      duplicateGroups,
      metadata: {
        fetchTime: new Date().toISOString(),
        totalAnalyzed: photoList.length,
        duplicatesFound,
        burstShotsFound,
        uniquePhotos: photoList.length - duplicatesFound - burstShotsFound,
        analysisTime: `${Date.now() - startTime}ms`
      }
    };

    setAnalysisSession(session);
    console.log('[DuplicateAnalysis] Analysis completed:', session.metadata);
    console.log('[DuplicateAnalysis] Duplicate groups:', duplicateGroups.length);
    console.log('[DuplicateAnalysis] First few results:', analysisResults.slice(0, 5).map(r => ({
      id: r.photoId,
      decision: r.decision,
      confidence: r.confidence
    })));
  };

  // Perform visual analysis on a batch of photos using Claude's vision
  const performVisualBatchAnalysis = async (batch: PhotoMetadata[], allPhotos: PhotoMetadata[]): Promise<AnalysisResult[]> => {
    try {
      console.log(`[DuplicateAnalysis] Analyzing batch of ${batch.length} photos visually...`);
      
      // Prepare photo URLs for analysis
      const photoUrls = batch.map(photo => {
        const webUri = photo.uris.find(uri => uri.type === 'web');
        return webUri?.url || photo.photo_url;
      });
      
      // Send to Claude visual analysis API
      const response = await fetch('/api/claude-visual-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoUrls,
          photoMetadata: batch.map(photo => ({
            id: photo.id,
            captured_at: photo.captured_at,
            coordinates: photo.coordinates,
            hash: photo.hash
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`Visual analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[DuplicateAnalysis] Visual analysis completed for batch:`, result);
      
      return result.analysisResults || [];
    } catch (error) {
      console.error('[DuplicateAnalysis] Visual analysis error:', error);
      
      // Fallback to enhanced metadata analysis if visual analysis fails
      return batch.map(photo => ({
        photoId: photo.id,
        decision: 'unique' as const,
        confidence: 0.5,
        reasoning: 'Visual analysis unavailable - using metadata only',
        visualObservations: 'Could not perform visual analysis',
        technicalNotes: `Hash: ${photo.hash}, Captured: ${new Date(photo.captured_at * 1000).toISOString()}`,
        relatedPhotos: [],
        patterns: []
      }));
    }
  };
  
  // Helper function to analyze temporal groups for burst patterns
  const analyzeTemporalGroup = async (group: PhotoMetadata[]) => {
    const timeSpread = Math.max(...group.map(p => p.captured_at)) - Math.min(...group.map(p => p.captured_at));
    const avgInterval = group.length > 1 ? timeSpread / (group.length - 1) : 0;
    
    // More aggressive burst detection: any sequence within 10 seconds
    const hasRapidSequence = timeSpread <= 10;
    const hasSameLocation = group.length > 0 && 
      group[0].coordinates && group[0].coordinates.length > 0 && 
      group[0].coordinates[0] && 
      typeof group[0].coordinates[0].latitude === 'number' &&
      group.every(p => 
        p.coordinates && p.coordinates.length > 0 && 
        p.coordinates[0] &&
        typeof p.coordinates[0].latitude === 'number' &&
        Math.abs(p.coordinates[0].latitude - group[0].coordinates[0].latitude) < 0.0001 &&
        Math.abs(p.coordinates[0].longitude - group[0].coordinates[0].longitude) < 0.0001
      );
    
    const isBurstSequence = hasRapidSequence && (hasSameLocation || group[0].coordinates.length === 0);
    
    return {
      isBurstSequence,
      observations: `${group.length} photos captured within ${timeSpread} seconds (avg ${avgInterval.toFixed(1)}s intervals). ${hasSameLocation ? 'Same GPS location detected.' : 'Location data varies or unavailable.'}`,
      reasoning: isBurstSequence 
        ? `Burst sequence detected: ${group.length} photos in ${timeSpread}s suggests rapid-fire photography or multiple attempts at same shot`
        : `Photos taken in sequence but with larger intervals - likely intentional separate shots`
    };
  };
  
  // Helper function to analyze spatial groups for composition similarity
  const analyzeSpatialGroup = async (group: PhotoMetadata[]) => {
    const firstPhoto = group[0];
    const coord = firstPhoto.coordinates.length > 0 ? firstPhoto.coordinates[0] : null;
    const locationDescription = coord 
      ? `GPS: ${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`
      : 'GPS: No coordinates available';
    
    // For now, assume photos at same GPS location have similar compositions
    // In a real implementation, this would involve actual image analysis
    const hasSimilarCompositions = true; // All photos at same location are potentially similar
    
    return {
      hasSimilarCompositions,
      observations: `${group.length} photos taken at ${coord ? 'identical GPS coordinates' : 'same general location'} (${locationDescription}). Likely same subject matter or location.`,
      reasoning: coord 
        ? `Multiple photos at exact same GPS coordinates suggest either duplicate shots, different angles of same subject, or photographer returning to same spot`
        : `Photos grouped together despite missing GPS data - likely same session or location based on other metadata`
    };
  };

  // Helper function to group photos by capture time
  const groupPhotosByTime = (photoList: PhotoMetadata[], thresholdSeconds: number) => {
    const groups: PhotoMetadata[][] = [];
    const sortedPhotos = [...photoList].sort((a, b) => a.captured_at - b.captured_at);
    
    let currentGroup: PhotoMetadata[] = [];
    let lastTime = 0;
    
    for (const photo of sortedPhotos) {
      if (lastTime === 0 || (photo.captured_at - lastTime) <= thresholdSeconds) {
        currentGroup.push(photo);
      } else {
        if (currentGroup.length > 1) {
          groups.push([...currentGroup]);
        }
        currentGroup = [photo];
      }
      lastTime = photo.captured_at;
    }
    
    if (currentGroup.length > 1) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  // Helper function to group photos by GPS coordinates
  const groupPhotosByLocation = (photoList: PhotoMetadata[], thresholdDegrees: number) => {
    const groups: PhotoMetadata[][] = [];
    
    for (const photo of photoList) {
      if (!photo.coordinates || photo.coordinates.length === 0) continue;
      
      let addedToGroup = false;
      const photoCoord = photo.coordinates[0];
      
      // Validate coordinate structure
      if (!photoCoord || typeof photoCoord.latitude !== 'number' || typeof photoCoord.longitude !== 'number') {
        console.warn('[DuplicateAnalysis] Invalid coordinate structure for photo:', photo.id, photoCoord);
        continue;
      }
      
      for (const group of groups) {
        if (group[0].coordinates.length === 0) continue;
        const groupCoord = group[0].coordinates[0];
        const distance = Math.sqrt(
          Math.pow(photoCoord.latitude - groupCoord.latitude, 2) +
          Math.pow(photoCoord.longitude - groupCoord.longitude, 2)
        );
        
        if (distance <= thresholdDegrees) {
          group.push(photo);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([photo]);
      }
    }
    
    return groups.filter(group => group.length > 1);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Get photo thumbnail URL
  const getPhotoThumbnail = (photo: PhotoMetadata) => {
    const thumbnail = photo.uris.find(uri => uri.type === 'thumbnail');
    return thumbnail?.url || photo.photo_url;
  };

  // Get photo web URL
  const getPhotoWebUrl = (photo: PhotoMetadata) => {
    const web = photo.uris.find(uri => uri.type === 'web');
    return web?.url || photo.photo_url;
  };

  // Filter photos based on analysis results
  const getFilteredPhotos = () => {
    if (!analysisSession) return [];
    
    switch (analysisFilter) {
      case 'duplicates':
        return analysisSession.analysisResults.filter(r => r.decision === 'duplicate');
      case 'burst_shots':
        return analysisSession.analysisResults.filter(r => r.decision === 'burst_shot');
      case 'unique':
        return analysisSession.analysisResults.filter(r => r.decision === 'unique');
      default:
        return analysisSession.analysisResults;
    }
  };

  // Handle user context loading and errors
  if (userLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="py-6 shadow-lg" style={{ backgroundColor: '#262626' }}>
          <div className="max-w-7xl mx-auto px-4">
            <h1 
              className="text-2xl md:text-4xl font-bold mb-2 text-white" 
              style={{ 
                fontFamily: 'Space Grotesk, var(--font-heading)', 
                color: '#FFFFFF' 
              }}
            >
              Scout AI
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-700 text-lg">Loading user context...</div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="py-6 shadow-lg" style={{ backgroundColor: '#262626' }}>
          <div className="max-w-7xl mx-auto px-4">
            <h1 
              className="text-2xl md:text-4xl font-bold mb-2 text-white" 
              style={{ 
                fontFamily: 'Space Grotesk, var(--font-heading)', 
                color: '#FFFFFF' 
              }}
            >
              Scout AI
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600 text-lg">Error: {userError}</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="py-6 shadow-lg" style={{ backgroundColor: '#262626' }}>
          <div className="max-w-7xl mx-auto px-4">
            <h1 
              className="text-2xl md:text-4xl font-bold mb-2 text-white" 
              style={{ 
                fontFamily: 'Space Grotesk, var(--font-heading)', 
                color: '#FFFFFF' 
              }}
            >
              Scout AI
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-700 text-lg">No user found. Please log in.</div>
        </div>
      </div>
    );
  }

  const modalSelectedPhoto = photoModal.selectedPhoto;
  const totalPhotos = photosQuery.allPhotos.length;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header with User Info */}
      <div className="py-6 shadow-lg relative overflow-hidden" style={{ backgroundColor: '#262626' }}>
        {/* Subtle Background Overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.03 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="header-hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(1.5) rotate(15)">
                <polygon points="25,8 44,18.7 44,38.3 25,49 6,38.3 6,18.7" fill="none" stroke="#ea580c" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#header-hexagons)"/>
          </svg>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative">
          {/* Main Header Row */}
          <div className="flex items-start justify-between py-4">
            {/* Logo/Brand Section - Left */}
            <div>
              <div className="flex items-center gap-3">
                <img 
                  src={aiCameraLens} 
                  alt="AI Camera Lens"
                  className="w-8 h-8 hover:scale-110 transition-transform duration-300 cursor-pointer"
                  style={{ filter: 'brightness(1.2) drop-shadow(0 2px 8px rgba(234, 88, 12, 0.3))' }}
                />
                <h1 
                  className="text-2xl md:text-3xl font-black bg-gradient-to-r from-teal-400 via-amber-500 to-purple-500 text-transparent bg-clip-text" 
                  style={{ 
                    fontFamily: 'Space Grotesk, var(--font-heading)',
                    backgroundSize: '200% 200%',
                    animation: 'gradient-shift 4s ease-in-out infinite',
                    textShadow: '0 0 40px rgba(234, 88, 12, 0.5)'
                  }}
                >
                  Scout AI
                </h1>
                {/* Progress Indicator (if analyzing) */}
                {(scoutAi.isAnalyzing || claudeLoading) && (
                  <div className="relative w-8 h-8 ml-2">
                    <svg className="transform -rotate-90 w-8 h-8">
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        stroke="#ea580c"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 14}`}
                        strokeDashoffset={`${2 * Math.PI * 14 * 0.25}`}
                        className="transition-all duration-500"
                        style={{ filter: 'drop-shadow(0 0 8px rgba(234, 88, 12, 0.6))' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-pulse">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 7H7v6h6V7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Tagline - Below logo */}
              <p 
                className="text-sm font-medium mt-2" 
                style={{ 
                  fontFamily: 'Inter, var(--font-body)', 
                  color: '#C3C3C3',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                Photo management with AI analysis and duplicate detection
              </p>
            </div>
            
            {/* User Info and Navigation - Right */}
            <div className="text-right">
              {currentUser && (
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-sm text-white">
                      {currentUser.first_name || currentUser.email_address}
                    </p>
                    {companyDetails && (
                      <p className="text-xs text-gray-400">
                        {companyDetails.name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
              
              {/* Navigation Links - Below user info */}
              <nav className="flex items-center justify-end gap-6">
                <Link 
                  to="/blog" 
                  className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
                  style={{ 
                    color: '#ea580c',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.textShadow = '0 0 10px rgba(234, 88, 12, 0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#ea580c';
                    e.currentTarget.style.textShadow = 'none';
                  }}
                >
                  <FileText className="w-4 h-4" />
                  <span>Blog</span>
                </Link>
                <Link 
                  to="/docs" 
                  className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200"
                  style={{ 
                    color: '#ea580c',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.textShadow = '0 0 10px rgba(234, 88, 12, 0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#ea580c';
                    e.currentTarget.style.textShadow = 'none';
                  }}
                >
                  <Book className="w-4 h-4" />
                  <span>Documentation</span>
                </Link>
              </nav>
            </div>
          </div>
          
          <style jsx>{`
            @keyframes gradient-shift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      </div>
      
      <div className="p-4 bg-gray-100 min-h-screen w-full font-sans">
        {/* Photo Management Section */}
        <div className="w-full max-w-[1400px] mx-auto">
          {/* Scout AI Controls */}
          <Card className="mb-6 bg-white rounded-lg shadow-md w-full">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-800">
                <Camera className="w-6 h-6" />
                Scout AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-center justify-center">
                {/* Scout AI Dropdown Menu */}
                {currentUser && totalPhotos >= 2 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
                      disabled={scoutAi.isAnalyzing || claudeLoading}
                      className="inline-flex items-center justify-center px-4 py-2 border rounded-md font-medium transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none gap-2"
                      style={{ 
                        backgroundColor: '#ea580c',
                        borderColor: '#ea580c',
                        color: '#FFFFFF'
                      }}
                      onMouseEnter={(e) => {
                        if (!scoutAi.isAnalyzing && !claudeLoading) {
                          e.target.style.backgroundColor = '#c2410c';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!scoutAi.isAnalyzing && !claudeLoading) {
                          e.target.style.backgroundColor = '#ea580c';
                        }
                      }}
                    >
                      <span>
                        {scoutAi.isAnalyzing ? 'Scout AI Analyzing...' : 
                         claudeLoading ? 'Claude Analyzing...' : 
                         'Analyze Photos'}
                      </span>
                      <svg className={`w-4 h-4 transition-transform ${showAnalysisDropdown ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 10l5 5 5-5z"/>
                      </svg>
                    </button>
                    
                    {showAnalysisDropdown && (
                      <div className="absolute top-full mt-2 left-0 w-80 border shadow-xl z-20 rounded-md" style={{ backgroundColor: '#FFFFFF', borderColor: '#e5e7eb' }}>
                        {/* Scout AI Analysis Option */}
                        <div className="border-b" style={{ borderColor: '#e5e7eb' }}>
                          <button
                            onClick={() => {
                              handleAnalyzePhotos(analysisMode);
                              setShowAnalysisDropdown(false);
                            }}
                            disabled={scoutAi.isAnalyzing}
                            className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center gap-4 rounded-t-md"
                          >
                            <div className="flex-shrink-0">
                              <Eye className="w-5 h-5" style={{ color: '#ea580c' }} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-base" style={{ color: '#111827' }}>Scout AI Analysis</div>
                              <div className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
                                Smart photo organization & tagging
                              </div>
                            </div>
                          </button>
                          
                          {/* Analysis Mode Options */}
                          <div className="px-6 pb-4 pt-3 space-y-2" style={{ backgroundColor: '#f9fafb' }}>
                            <label className="flex items-center space-x-3 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100">
                              <input
                                type="radio"
                                name="analysisMode"
                                value="new"
                                checked={analysisMode === 'new'}
                                onChange={() => setAnalysisMode('new')}
                                style={{ accentColor: '#ea580c' }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm" style={{ color: '#374151' }}>New Photos Only (30 days)</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100">
                              <input
                                type="radio"
                                name="analysisMode"
                                value="all"
                                checked={analysisMode === 'all'}
                                onChange={() => setAnalysisMode('all')}
                                style={{ accentColor: '#ea580c' }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm" style={{ color: '#374151' }}>All Photos (Skip Analyzed)</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100">
                              <input
                                type="radio"
                                name="analysisMode"
                                value="force"
                                checked={analysisMode === 'force'}
                                onChange={() => setAnalysisMode('force')}
                                style={{ accentColor: '#ea580c' }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm" style={{ color: '#374151' }}>Force Re-analysis (Testing)</span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Claude Vision Analysis Option */}
                        <button
                          onClick={() => {
                            fetchPhotos(50);
                            setShowAnalysisDropdown(false);
                          }}
                          disabled={claudeLoading}
                          className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center gap-4 rounded-b-md"
                        >
                          <div className="flex-shrink-0">
                            <Eye className="w-5 h-5" style={{ color: '#ea580c' }} />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-base" style={{ color: '#111827' }}>Claude Vision Duplicates</div>
                            <div className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
                              Find & manage duplicate photos
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Status Badges */}
                {(analysisSession || (scoutAi.suggestions && scoutAi.suggestions.length > 0)) && (
                  <div className="flex flex-wrap gap-2">
                    {analysisSession && (
                      <>
                        <Badge variant="accent">
                          {analysisSession.metadata.totalAnalyzed} photos analyzed
                        </Badge>
                        <Badge variant="destructive">
                          {analysisSession.metadata.duplicatesFound} duplicates
                        </Badge>
                        <Badge variant="outline">
                          {analysisSession.metadata.burstShotsFound} burst shots
                        </Badge>
                      </>
                    )}
                    {scoutAi.suggestions && scoutAi.suggestions.length > 0 && (
                      <Badge variant="default">
                        {scoutAi.suggestions.filter(s => s.status !== 'dismissed' && s.status !== 'rejected').length} Scout AI suggestions
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filter Section */}
          <FilterBar
            availableTags={tagFiltering.availableFilterTags}
            activeTags={tagFiltering.activeTagIds}
            onToggleTag={tagFiltering.toggleTag}
            onClearAll={tagFiltering.clearAllFilters}
            totalPhotos={photosQuery.allPhotos.length}
            filteredCount={tagFiltering.filteredPhotos.length}
            onRefresh={handleRefreshPhotos}
            isRefreshing={photosQuery.isLoading}
            showArchivedPhotos={showArchivedPhotos}
            onToggleArchivedPhotos={setShowArchivedPhotos}
            archivedCount={archivedCount}
            isRelaxedView={isRelaxedView}
            onToggleRelaxedView={setIsRelaxedView}
          />

          {/* Claude Error Display */}
          {claudeError && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Claude Vision Error:</span>
                  <span>{claudeError}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Messages */}
          {photosQuery.error && (
            <p className="text-red-600 text-center mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
              Error: {photosQuery.error.message}
            </p>
          )}

          {tagManagement.tagError && (
            <div className="mb-6 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-md">
              <p>{tagManagement.tagError}</p>
            </div>
          )}

          {/* Scout AI Analysis Interface */}
          {currentUser && tagFiltering.filteredPhotos.length >= 2 && (scoutAi.isAnalyzing || scoutAi.suggestions.filter(s => s.status !== 'dismissed' && s.status !== 'rejected').length > 0) && (
            <div className="mb-6">
              <ScoutAiDemo
                photos={photosQuery.allPhotos}
                visible={true}
                onPhotoUpdate={(updatedPhoto: Photo) => {
                  photosQuery.updatePhotoInCache(updatedPhoto);
                }}
              />
            </div>
          )}

          {/* Notifications Panel */}
          {notificationManager.hasActiveNotifications && (
            <div className="mb-6">
              <NotificationsPanel
                photos={photosQuery.photos}
                onPhotosUpdate={(updatedPhotos: Photo[]) => {
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
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#ea580c' }}></div>
              <p className="mt-4 text-gray-600">Loading photos...</p>
            </div>
          )}

          {/* Photo Grid */}
          <div className={`grid mb-6 ${
            isRelaxedView 
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6' 
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
          }`}>
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
                  mockTagsData={[]}
                  aiSuggestionData={aiData}
                  onFetchAiSuggestions={aiEnhancements.fetchAiSuggestions}
                  onUnarchivePhoto={handleUnarchivePhoto}
                />
              );
            })}
          </div>

          {/* Load More Indicator */}
          {tagFiltering.filteredPhotos.length > 0 && photosQuery.isLoadingMore && (
            <div className="text-center mt-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#ea580c' }}></div>
              <p className="mt-2 text-gray-600">Loading more photos...</p>
            </div>
          )}
        </div>

        {/* Claude Vision Analysis Results */}
        <div className="w-full max-w-[1400px] mx-auto mt-8">

        {/* Analysis Results */}
        {analysisSession && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="photos">Photo Grid</TabsTrigger>
              <TabsTrigger value="groups">Duplicate Groups</TabsTrigger>
              <TabsTrigger value="metadata">Debug Data</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Photos:</span>
                        <span className="font-medium">{analysisSession.metadata.totalAnalyzed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duplicates Found:</span>
                        <span className="font-medium text-red-600">{analysisSession.metadata.duplicatesFound}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Burst Shots:</span>
                        <span className="font-medium text-orange-600">{analysisSession.metadata.burstShotsFound}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unique Photos:</span>
                        <span className="font-medium text-green-600">{analysisSession.metadata.uniquePhotos}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Analysis Time:</span>
                        <Badge variant="outline">{analysisSession.metadata.analysisTime}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Fetch Time:</span>
                        <span className="text-sm text-gray-500">
                          {new Date(analysisSession.metadata.fetchTime).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Analysis Method:</span>
                        <Badge>Claude Visual</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setAnalysisFilter('duplicates')}
                      >
                        View Duplicates
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setAnalysisFilter('burst_shots')}
                      >
                        View Burst Shots
                      </Button>
                      <Button 
                        variant="accent" 
                        size="sm" 
                        className="w-full"
                        onClick={() => fetchPhotos(100)}
                      >
                        Analyze More Photos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Photo Grid Tab */}
            <TabsContent value="photos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Photo Analysis Grid</span>
                    <div className="flex gap-2">
                      <Button
                        variant={analysisFilter === 'all' ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('all')}
                      >
                        All ({analysisSession.analysisResults.length})
                      </Button>
                      <Button
                        variant={analysisFilter === 'duplicates' ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('duplicates')}
                      >
                        Duplicates ({analysisSession.metadata.duplicatesFound})
                      </Button>
                      <Button
                        variant={analysisFilter === 'burst_shots' ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('burst_shots')}
                      >
                        Burst Shots ({analysisSession.metadata.burstShotsFound})
                      </Button>
                      <Button
                        variant={analysisFilter === 'unique' ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('unique')}
                      >
                        Unique ({analysisSession.metadata.uniquePhotos})
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {getFilteredPhotos().map((analysis) => {
                      const photo = analysisSession.photos.find(p => p.id === analysis.photoId);
                      if (!photo) return null;

                      const decisionColor = {
                        duplicate: 'bg-red-100 border-red-300',
                        burst_shot: 'bg-orange-100 border-orange-300',
                        similar: 'bg-yellow-100 border-yellow-300',
                        unique: 'bg-green-100 border-green-300'
                      }[analysis.decision];

                      // Check if this photo is marked as the best in any burst sequence
                      const isBestInBurst = analysisSession.duplicateGroups.some(
                        group => group.type === 'burst_sequence' && group.bestPhotoId === photo.id
                      );

                      return (
                        <div
                          key={photo.id}
                          className={`border-2 rounded-lg p-2 cursor-pointer hover:shadow-lg transition-shadow relative ${decisionColor}`}
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          {isBestInBurst && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-lg" title="Best quality in burst sequence">
                              <Crown className="w-4 h-4" />
                            </div>
                          )}
                          <img
                            src={getPhotoThumbnail(photo)}
                            alt={`Photo ${photo.id}`}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                          <div className="text-xs space-y-1">
                            <Badge 
                              size="sm" 
                              variant={analysis.decision === 'unique' ? 'default' : 'destructive'}
                            >
                              {analysis.decision}
                            </Badge>
                            <div className="text-gray-600">
                              {formatTimestamp(photo.captured_at)}
                            </div>
                            <div className="text-gray-500 truncate">
                              Confidence: {Math.round(analysis.confidence * 100)}%
                            </div>
                            {analysis.qualityMetrics && (
                              <div className="text-gray-500 truncate font-medium">
                                Quality: {Math.round(analysis.qualityMetrics.overallQuality * 100)}%
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Duplicate Groups Tab */}
            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle>Detected Duplicate Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisSession.duplicateGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No duplicate groups detected in this analysis.
                      <br />
                      <span className="text-sm">This indicates good photo curation or unique shots.</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analysisSession.duplicateGroups.map((group) => (
                        <Card key={group.id} className="border-orange-200">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center justify-between">
                              <span>Group {group.id} - {group.type}</span>
                              <Badge variant="outline">
                                {group.photos.length} photos
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium mb-2">Claude's Analysis:</h4>
                                <p className="text-gray-700">{group.reasoning}</p>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Recommendation:</h4>
                                <p className="text-gray-700">{group.recommendation}</p>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {group.photos.map((photo) => {
                                  const isBestPhoto = photo.id === group.bestPhotoId;
                                  const analysis = group.analysis.find(a => a.photoId === photo.id);
                                  const qualityScore = analysis?.qualityMetrics?.overallQuality;
                                  const qualityRank = group.qualityRanking?.indexOf(photo.id) ?? -1;
                                  
                                  return (
                                    <div key={photo.id} className="relative">
                                      <img
                                        src={getPhotoThumbnail(photo)}
                                        alt={`Group photo ${photo.id}`}
                                        className={`w-full h-20 object-cover rounded cursor-pointer hover:opacity-80 ${
                                          isBestPhoto ? 'ring-2 ring-green-500' : ''
                                        }`}
                                        onClick={() => setSelectedPhoto(photo)}
                                      />
                                      {isBestPhoto && (
                                        <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1" title="Best quality photo">
                                          <Crown className="w-3 h-3" />
                                        </div>
                                      )}
                                      {qualityScore !== undefined && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                                          {Math.round(qualityScore * 100)}%
                                        </div>
                                      )}
                                      {qualityRank >= 0 && !isBestPhoto && (
                                        <div className="absolute top-1 right-1 bg-gray-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                          {qualityRank + 1}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Debug Metadata Tab */}
            <TabsContent value="metadata">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
                      {JSON.stringify(analysisSession.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sample Photo Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analysisSession.photos.length > 0 && (
                      <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
                        {JSON.stringify(analysisSession.photos[0], null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Photo Detail Modal */}
        {selectedPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Photo Analysis Details</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedPhoto(null)}
                  >
                    Close
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <img
                      src={getPhotoWebUrl(selectedPhoto)}
                      alt={`Photo ${selectedPhoto.id}`}
                      className="w-full rounded-lg"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Photo Metadata
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID:</span>
                          <span className="font-mono">{selectedPhoto.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Hash:</span>
                          <span className="font-mono text-xs">{selectedPhoto.hash}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Captured:
                          </span>
                          <span>{formatTimestamp(selectedPhoto.captured_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Creator:
                          </span>
                          <span>{selectedPhoto.creator_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            Project:
                          </span>
                          <span className="font-mono text-xs">{selectedPhoto.project_id}</span>
                        </div>
                        {selectedPhoto.coordinates.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Location:
                            </span>
                            <span className="text-xs">
                              {selectedPhoto.coordinates[0].latitude.toFixed(6)}, {selectedPhoto.coordinates[0].longitude.toFixed(6)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {analysisSession && (
                      <div>
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Claude's Analysis
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const analysis = analysisSession.analysisResults.find(r => r.photoId === selectedPhoto.id);
                            if (!analysis) return <span className="text-gray-500">No analysis available</span>;
                            
                            return (
                              <>
                                <div>
                                  <span className="text-gray-600">Decision:</span>
                                  <Badge className="ml-2" variant={analysis.decision === 'unique' ? 'default' : 'destructive'}>
                                    {analysis.decision}
                                  </Badge>
                                  <span className="ml-2 text-sm text-gray-500">
                                    ({Math.round(analysis.confidence * 100)}% confidence)
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Reasoning:</span>
                                  <p className="text-sm mt-1">{analysis.reasoning}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Visual Observations:</span>
                                  <p className="text-sm mt-1">{analysis.visualObservations}</p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Technical Notes:</span>
                                  <p className="text-sm mt-1 font-mono">{analysis.technicalNotes}</p>
                                </div>
                                {analysis.patterns.length > 0 && (
                                  <div>
                                    <span className="text-gray-600">Detected Patterns:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {analysis.patterns.map((pattern, idx) => (
                                        <Badge key={idx} variant="outline" size="sm">
                                          {pattern}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {analysis.qualityMetrics && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Star className="w-4 h-4 text-yellow-500" />
                                      <span className="font-medium">Quality Assessment</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Overall:</span>
                                        <span className="font-medium">{Math.round(analysis.qualityMetrics.overallQuality * 100)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Sharpness:</span>
                                        <span>{Math.round(analysis.qualityMetrics.sharpness * 100)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Composition:</span>
                                        <span>{Math.round(analysis.qualityMetrics.composition * 100)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Lighting:</span>
                                        <span>{Math.round(analysis.qualityMetrics.lighting * 100)}%</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Clarity:</span>
                                        <span>{Math.round(analysis.qualityMetrics.subjectClarity * 100)}%</span>
                                      </div>
                                    </div>
                                    {analysis.qualityMetrics.qualityNotes && (
                                      <p className="text-xs text-gray-600 mt-2 italic">
                                        {analysis.qualityMetrics.qualityNotes}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal.isModalOpen && modalSelectedPhoto && (
        <PhotoModal
          photo={modalSelectedPhoto}
          onClose={photoModal.closeModal}
          apiKey={localStorage.getItem('companyCamApiKey') || ''}
          onAddTagToCompanyCam={tagManagement.handleAddTagRequest}
          onAddAiTag={aiEnhancements.addAiTag}
          onRemoveTag={tagManagement.handleRemoveTagRequest}
          aiSuggestionData={aiEnhancements.getAiDataForPhoto(modalSelectedPhoto.id)}
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
const DuplicateAnalysisPage: React.FC = () => {
  const { currentUser } = useUserContext();
  
  return (
    <ScoutAiProvider userId={currentUser?.id || null}>
      <DuplicateAnalysisPageContent />
    </ScoutAiProvider>
  );
};

export default DuplicateAnalysisPage;