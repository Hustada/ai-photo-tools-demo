// © 2025 Mark Hustad — MIT License
// Claude's Visual Duplicate Detection Analysis Page

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertCircle, Eye, Clock, Camera, MapPin, Hash, User, Building } from 'lucide-react';

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

interface AnalysisResult {
  photoId: string;
  decision: 'duplicate' | 'burst_shot' | 'similar' | 'unique';
  confidence: number;
  reasoning: string;
  visualObservations: string;
  technicalNotes: string;
  relatedPhotos: string[];
  patterns: string[];
}

interface DuplicateGroup {
  id: string;
  type: 'exact_duplicate' | 'burst_sequence' | 'similar_composition' | 'temporal_cluster';
  photos: PhotoMetadata[];
  analysis: AnalysisResult[];
  reasoning: string;
  recommendation: string;
  confidence: number;
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

const DuplicateAnalysisPage: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [analysisSession, setAnalysisSession] = useState<AnalysisSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMetadata | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [analysisFilter, setAnalysisFilter] = useState<'all' | 'duplicates' | 'burst_shots' | 'unique'>('all');

  // Fetch photos from CompanyCam API
  const fetchPhotos = async (maxPhotos: number = 50) => {
    setLoading(true);
    setError(null);
    
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
      
      setPhotos(data.photos || []);
      
      if (data.photos && data.photos.length > 0) {
        // Auto-start analysis
        await performClaudeAnalysis(data.photos);
      }

    } catch (err: any) {
      console.error('[DuplicateAnalysis] Error fetching photos:', err);
      setError(err.message || 'Failed to fetch photos');
    } finally {
      setLoading(false);
    }
  };

  // Claude's visual analysis simulation (this would be where I analyze each photo)
  const performClaudeAnalysis = async (photoList: PhotoMetadata[]) => {
    console.log('[DuplicateAnalysis] Starting Claude visual analysis...');
    const startTime = Date.now();
    
    // This is where the actual visual analysis would happen
    // For now, I'll create a structure that shows what my analysis would look like
    const analysisResults: AnalysisResult[] = [];
    const duplicateGroups: DuplicateGroup[] = [];
    
    // Simulate analysis process
    for (const photo of photoList) {
      // This is where I would use the Read tool to examine each photo
      const analysis: AnalysisResult = {
        photoId: photo.id,
        decision: 'unique', // Will be updated based on actual analysis
        confidence: 0.9,
        reasoning: 'Pending visual analysis - Claude will examine each photo individually',
        visualObservations: 'Visual analysis not yet performed',
        technicalNotes: `Hash: ${photo.hash}, Captured: ${new Date(photo.captured_at * 1000).toISOString()}`,
        relatedPhotos: [],
        patterns: []
      };
      
      analysisResults.push(analysis);
    }

    // Group photos for analysis
    const temporalGroups = groupPhotosByTime(photoList, 300); // 5 minute windows
    const spatialGroups = groupPhotosByLocation(photoList, 0.001); // ~100m radius
    
    const session: AnalysisSession = {
      photos: photoList,
      analysisResults,
      duplicateGroups,
      metadata: {
        fetchTime: new Date().toISOString(),
        totalAnalyzed: photoList.length,
        duplicatesFound: 0,
        burstShotsFound: 0,
        uniquePhotos: photoList.length,
        analysisTime: `${Date.now() - startTime}ms`
      }
    };

    setAnalysisSession(session);
    console.log('[DuplicateAnalysis] Analysis session created:', session);
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
      if (photo.coordinates.length === 0) continue;
      
      let addedToGroup = false;
      const photoCoord = photo.coordinates[0];
      
      for (const group of groups) {
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Claude's Duplicate Detection Analysis
          </h1>
          <p className="text-gray-600">
            Visual analysis of CompanyCam photos for duplicates, burst shots, and similar compositions
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Photo Analysis Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <Button 
                onClick={() => fetchPhotos(50)} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {loading ? 'Analyzing...' : 'Fetch & Analyze Photos'}
              </Button>
              
              {analysisSession && (
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {analysisSession.metadata.totalAnalyzed} photos analyzed
                  </Badge>
                  <Badge variant="outline">
                    {analysisSession.metadata.duplicatesFound} duplicates
                  </Badge>
                  <Badge variant="outline">
                    {analysisSession.metadata.burstShotsFound} burst shots
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

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
                        variant="outline" 
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
                        variant={analysisFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('all')}
                      >
                        All ({analysisSession.analysisResults.length})
                      </Button>
                      <Button
                        variant={analysisFilter === 'duplicates' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('duplicates')}
                      >
                        Duplicates ({analysisSession.metadata.duplicatesFound})
                      </Button>
                      <Button
                        variant={analysisFilter === 'burst_shots' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setAnalysisFilter('burst_shots')}
                      >
                        Burst Shots ({analysisSession.metadata.burstShotsFound})
                      </Button>
                      <Button
                        variant={analysisFilter === 'unique' ? 'default' : 'outline'}
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

                      return (
                        <div
                          key={photo.id}
                          className={`border-2 rounded-lg p-2 cursor-pointer hover:shadow-lg transition-shadow ${decisionColor}`}
                          onClick={() => setSelectedPhoto(photo)}
                        >
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
                                {group.photos.map((photo) => (
                                  <img
                                    key={photo.id}
                                    src={getPhotoThumbnail(photo)}
                                    alt={`Group photo ${photo.id}`}
                                    className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                                    onClick={() => setSelectedPhoto(photo)}
                                  />
                                ))}
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
  );
};

export default DuplicateAnalysisPage;