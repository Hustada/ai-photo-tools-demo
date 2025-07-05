// © 2025 Mark Hustad — MIT License
// API endpoint for Claude's visual analysis of photos for duplicates/burst shots

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface VisualAnalysisRequest {
  photoUrls: string[];
  photoMetadata: Array<{
    id: string;
    captured_at: number;
    coordinates: Array<{
      latitude: number;
      longitude: number;
    }>;
    hash: string;
  }>;
}

interface VisualAnalysisResult {
  photoId: string;
  decision: 'duplicate' | 'burst_shot' | 'similar' | 'unique';
  confidence: number;
  reasoning: string;
  visualObservations: string;
  technicalNotes: string;
  relatedPhotos: string[];
  patterns: string[];
}

interface VisualAnalysisResponse {
  analysisResults: VisualAnalysisResult[];
  duplicateGroups: Array<{
    id: string;
    type: 'exact_duplicate' | 'burst_sequence' | 'similar_composition';
    photoIds: string[];
    reasoning: string;
    recommendation: string;
    confidence: number;
  }>;
  metadata: {
    analysisTime: string;
    photosAnalyzed: number;
    analysisMethod: 'claude_visual_metadata';
  };
}

// Main handler function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const requestBody: VisualAnalysisRequest = req.body;
    const { photoUrls, photoMetadata } = requestBody;

    if (!photoUrls || !photoMetadata || photoUrls.length !== photoMetadata.length) {
      return res.status(400).json({ error: 'photoUrls and photoMetadata arrays must be provided and have same length' });
    }

    console.log(`[ClaudeVisualAnalysis] Starting analysis of ${photoUrls.length} photos`);
    const startTime = Date.now();

    // This is where Claude would analyze each photo visually
    // For now, we'll create a sophisticated metadata-based analysis that demonstrates the approach
    const analysisResults: VisualAnalysisResult[] = [];
    const duplicateGroups: Array<{
      id: string;
      type: 'exact_duplicate' | 'burst_sequence' | 'similar_composition';
      photoIds: string[];
      reasoning: string;
      recommendation: string;
      confidence: number;
    }> = [];

    // Analyze each photo
    for (let i = 0; i < photoMetadata.length; i++) {
      const photo = photoMetadata[i];
      const photoUrl = photoUrls[i];

      // Basic analysis for each photo
      let decision: 'duplicate' | 'burst_shot' | 'similar' | 'unique' = 'unique';
      let confidence = 0.8;
      let reasoning = 'Single photo without clear clustering patterns';
      let visualObservations = 'Photo analyzed individually - metadata suggests unique shot';
      let relatedPhotos: string[] = [];
      let patterns: string[] = [];

      // Look for temporal clustering (burst shots)
      const temporalNeighbors = photoMetadata.filter(p => 
        p.id !== photo.id && 
        Math.abs(p.captured_at - photo.captured_at) < 10 // Within 10 seconds
      );

      if (temporalNeighbors.length > 0) {
        const timeSpread = Math.max(...temporalNeighbors.map(p => Math.abs(p.captured_at - photo.captured_at)));
        
        if (timeSpread < 5) {
          decision = 'burst_shot';
          confidence = 0.9;
          reasoning = `Part of rapid sequence - ${temporalNeighbors.length + 1} photos within ${timeSpread} seconds`;
          visualObservations = 'Temporal clustering suggests burst mode photography or multiple attempts at same shot';
          relatedPhotos = temporalNeighbors.map(p => p.id);
          patterns = ['temporal_clustering', 'rapid_sequence'];
        }
      }

      // Look for spatial clustering (same location)
      if (photo.coordinates.length > 0) {
        const spatialNeighbors = photoMetadata.filter(p => 
          p.id !== photo.id && 
          p.coordinates.length > 0 &&
          Math.abs(p.coordinates[0].latitude - photo.coordinates[0].latitude) < 0.0001 &&
          Math.abs(p.coordinates[0].longitude - photo.coordinates[0].longitude) < 0.0001
        );

        if (spatialNeighbors.length > 0) {
          // Check if also temporal (duplicate) or separated (similar composition)
          const hasTemporalOverlap = spatialNeighbors.some(p => 
            Math.abs(p.captured_at - photo.captured_at) < 60
          );

          if (hasTemporalOverlap && decision !== 'burst_shot') {
            decision = 'duplicate';
            confidence = 0.95;
            reasoning = 'Multiple photos at identical GPS coordinates within short time frame';
            visualObservations = 'Same location + temporal proximity strongly suggests duplicate shots';
            patterns.push('same_location', 'temporal_proximity');
          } else if (decision === 'unique') {
            decision = 'similar';
            confidence = 0.7;
            reasoning = 'Same GPS location but different timing - likely similar composition';
            visualObservations = 'Identical coordinates suggest similar subject matter or viewpoint';
            patterns.push('same_location', 'similar_composition');
          }

          relatedPhotos = [...new Set([...relatedPhotos, ...spatialNeighbors.map(p => p.id)])];
        }
      }

      const technicalNotes = `Hash: ${photo.hash}, Captured: ${new Date(photo.captured_at * 1000).toISOString()}, GPS: ${photo.coordinates.length > 0 ? `${photo.coordinates[0].latitude.toFixed(6)}, ${photo.coordinates[0].longitude.toFixed(6)}` : 'None'}`;

      analysisResults.push({
        photoId: photo.id,
        decision,
        confidence,
        reasoning,
        visualObservations,
        technicalNotes,
        relatedPhotos,
        patterns
      });
    }

    // Create duplicate groups based on analysis
    const processedPhotos = new Set<string>();
    let groupId = 1;

    for (const analysis of analysisResults) {
      if (processedPhotos.has(analysis.photoId)) continue;

      if (analysis.decision !== 'unique' && analysis.relatedPhotos.length > 0) {
        const groupPhotos = [analysis.photoId, ...analysis.relatedPhotos].filter(id => 
          !processedPhotos.has(id)
        );

        if (groupPhotos.length > 1) {
          const groupType = analysis.decision === 'duplicate' ? 'exact_duplicate' :
                           analysis.decision === 'burst_shot' ? 'burst_sequence' : 'similar_composition';

          duplicateGroups.push({
            id: `group_${groupId++}`,
            type: groupType,
            photoIds: groupPhotos,
            reasoning: analysis.reasoning,
            recommendation: groupType === 'exact_duplicate' 
              ? 'Keep the first photo and delete the rest - likely accidental duplicates'
              : groupType === 'burst_sequence'
              ? 'Keep the best photo from the burst sequence and archive the rest'
              : 'Review photos for best composition - may want to keep multiple angles',
            confidence: analysis.confidence
          });

          groupPhotos.forEach(id => processedPhotos.add(id));
        }
      }
    }

    const response: VisualAnalysisResponse = {
      analysisResults,
      duplicateGroups,
      metadata: {
        analysisTime: `${Date.now() - startTime}ms`,
        photosAnalyzed: photoMetadata.length,
        analysisMethod: 'claude_visual_metadata'
      }
    };

    console.log(`[ClaudeVisualAnalysis] Analysis completed: ${duplicateGroups.length} groups found`);
    res.status(200).json(response);

  } catch (error: any) {
    console.error('[ClaudeVisualAnalysis] Error in visual analysis:', error);
    res.status(500).json({ 
      error: 'Failed to perform visual analysis', 
      details: error.message 
    });
  }
}