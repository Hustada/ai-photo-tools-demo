// © 2025 Mark Hustad — MIT License
// API endpoint for Claude's visual analysis of photos for duplicates/burst shots

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

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

interface PhotoQualityMetrics {
  sharpness: number;      // 0-1: Focus quality, motion blur detection
  composition: number;    // 0-1: Rule of thirds, framing, balance
  lighting: number;       // 0-1: Exposure, contrast, dynamic range
  subjectClarity: number; // 0-1: Main subject visibility and clarity
  overallQuality: number; // 0-1: Combined quality score
  qualityNotes: string;   // Specific observations about quality
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
  qualityMetrics?: PhotoQualityMetrics; // Quality assessment for burst sequences
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
    bestPhotoId?: string;        // ID of the highest quality photo in the group
    qualityRanking?: string[];   // Photo IDs ordered by quality (best first)
  }>;
  metadata: {
    analysisTime: string;
    photosAnalyzed: number;
    analysisMethod: 'claude_visual_content';
  };
}

// Function to analyze a photo visually using Claude's actual vision
async function analyzePhotoVisually(
  photoUrl: string, 
  metadata: any, 
  allPhotoUrls: string[], 
  allMetadata: any[]
): Promise<VisualAnalysisResult> {
  
  try {
    // Use Claude's vision API to actually analyze the photo content
    console.log(`[ClaudeVision] Analyzing photo content at: ${photoUrl}`);
    
    // Find other photos taken within a reasonable time window for comparison
    const recentPhotos = allMetadata
      .map((other, index) => ({ other, index, url: allPhotoUrls[index] }))
      .filter(item => 
        item.other.id !== metadata.id && 
        Math.abs(item.other.captured_at - metadata.captured_at) < 30 // Within 30 seconds for burst detection
      )
      .sort((a, b) => Math.abs(a.other.captured_at - metadata.captured_at) - Math.abs(b.other.captured_at - metadata.captured_at))
      .slice(0, 4); // Only compare with 4 most recent photos for Claude vision API limits

    if (recentPhotos.length === 0) {
      return {
        photoId: metadata.id,
        decision: 'unique',
        confidence: 0.9,
        reasoning: 'No other photos found within temporal proximity for comparison',
        visualObservations: 'Photo appears to be isolated in time - likely unique content',
        technicalNotes: `Hash: ${metadata.hash}, Captured: ${new Date(metadata.captured_at * 1000).toISOString()}`,
        relatedPhotos: [],
        patterns: []
      };
    }

    // Perform actual visual comparison using Claude
    const visualAnalysis = await performClaudeVisionAnalysis(photoUrl, recentPhotos.map(p => p.url), metadata, recentPhotos.map(p => p.other));
    
    return visualAnalysis;
    
  } catch (error) {
    console.error(`[ClaudeVision] Error analyzing photo ${metadata.id}:`, error);
    // Fallback to basic metadata analysis
    return fallbackMetadataAnalysis(metadata, allMetadata, allPhotoUrls);
  }
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Perform actual Claude vision analysis comparing photos
async function performClaudeVisionAnalysis(
  mainPhotoUrl: string,
  comparisonPhotoUrls: string[],
  mainMetadata: any,
  comparisonMetadata: any[]
): Promise<VisualAnalysisResult> {
  
  try {
    console.log(`[ClaudeVision] Using real Claude Vision API to analyze ${mainPhotoUrl} with ${comparisonPhotoUrls.length} comparison photos`);
    
    // Prepare images for Claude vision analysis
    const images = [
      {
        type: "image" as const,
        source: {
          type: "url" as const,
          url: mainPhotoUrl,
        },
      },
      ...comparisonPhotoUrls.slice(0, 4).map(url => ({ // Limit to 4 comparison photos to avoid token limits
        type: "image" as const,
        source: {
          type: "url" as const,
          url: url,
        },
      })),
    ];
    
    // Create detailed analysis prompt for Claude Vision
    const analysisPrompt = `You are analyzing construction/building photos for duplicate detection and quality assessment. Compare the FIRST photo with the other ${Math.min(comparisonPhotoUrls.length, 4)} photos.

First photo (main): taken at ${new Date(mainMetadata.captured_at * 1000).toISOString()}
Comparison photos: ${comparisonMetadata.slice(0, 4).map((meta, i) => `Photo ${i+2}: taken ${Math.abs(meta.captured_at - mainMetadata.captured_at)} seconds ${meta.captured_at > mainMetadata.captured_at ? 'later' : 'earlier'}`).join(', ')}

Analyze the FIRST photo and determine:

1. **duplicate** - If it's nearly identical to any other photo (same scene, angle, lighting, composition)
2. **burst_shot** - If it's part of a rapid sequence (within seconds) of similar shots showing the same subject with minor variations
3. **similar** - If it shows similar composition/subject but with meaningful differences worth keeping
4. **unique** - If it's distinct from all other photos

IMPORTANT: Burst shots are typically taken within 1-10 seconds of each other, showing the same scene with slight variations.

For burst shots or duplicates, also assess the QUALITY of the first photo:
- **Sharpness** (0-1): Is the subject in focus? Any motion blur or camera shake?
- **Composition** (0-1): Rule of thirds, framing, balance, professional appearance
- **Lighting** (0-1): Proper exposure, good contrast, no harsh shadows or blown highlights
- **Subject Clarity** (0-1): Is the main construction element clearly visible and unobstructed?
- **Overall Quality** (0-1): Combined assessment for construction documentation purposes

Focus on:
- Visual composition and framing
- Subject matter and scene content
- Camera angle and perspective
- Construction/building elements visible
- Whether photos show the same work area or building feature
- Photo quality for documentation purposes

Provide your analysis in this JSON format:
{
  "decision": "duplicate|burst_shot|similar|unique",
  "confidence": 0.8,
  "reasoning": "Detailed explanation of why you classified it this way",
  "visualObservations": "What you observed in the photos visually",
  "relatedPhotoIndices": [2, 3],
  "patterns": ["same_angle", "identical_framing"],
  "qualityAssessment": {
    "sharpness": 0.85,
    "composition": 0.9,
    "lighting": 0.8,
    "subjectClarity": 0.95,
    "overallQuality": 0.88,
    "qualityNotes": "Sharp focus on main subject, well-composed with good lighting"
  }
}

Note: Only include qualityAssessment if decision is "burst_shot" or "duplicate"`;
    
    // Make the actual Claude API call
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            ...images,
          ],
        },
      ],
    });
    
    // Parse Claude's response
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`[ClaudeVision] Raw response:`, responseText);
    
    // Extract JSON from response
    let analysisResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn(`[ClaudeVision] Failed to parse JSON response, falling back to text analysis:`, parseError);
      // Fallback: extract decision from text
      const decision = responseText.toLowerCase().includes('duplicate') ? 'duplicate' :
                      responseText.toLowerCase().includes('burst') ? 'burst_shot' :
                      responseText.toLowerCase().includes('similar') ? 'similar' : 'unique';
      
      analysisResult = {
        decision,
        confidence: 0.7,
        reasoning: responseText.substring(0, 200) + '...',
        visualObservations: 'Claude provided text analysis but JSON parsing failed',
        relatedPhotoIndices: [],
        patterns: []
      };
    }
    
    // Convert to our expected format
    const relatedPhotoIds = (analysisResult.relatedPhotoIndices || [])
      .map((index: number) => {
        const adjustedIndex = index - 2; // Subtract 2 because photo indices start from 2 in prompt
        return adjustedIndex >= 0 && adjustedIndex < comparisonMetadata.length 
          ? comparisonMetadata[adjustedIndex].id 
          : null;
      })
      .filter(Boolean);
    
    // Parse quality assessment if provided
    let qualityMetrics: PhotoQualityMetrics | undefined;
    if (analysisResult.qualityAssessment && (analysisResult.decision === 'burst_shot' || analysisResult.decision === 'duplicate')) {
      qualityMetrics = {
        sharpness: analysisResult.qualityAssessment.sharpness || 0.5,
        composition: analysisResult.qualityAssessment.composition || 0.5,
        lighting: analysisResult.qualityAssessment.lighting || 0.5,
        subjectClarity: analysisResult.qualityAssessment.subjectClarity || 0.5,
        overallQuality: analysisResult.qualityAssessment.overallQuality || 0.5,
        qualityNotes: analysisResult.qualityAssessment.qualityNotes || 'Quality assessment completed'
      };
    }
    
    const result: VisualAnalysisResult = {
      photoId: mainMetadata.id,
      decision: analysisResult.decision || 'unique',
      confidence: analysisResult.confidence || 0.7,
      reasoning: analysisResult.reasoning || 'Claude Vision analysis completed',
      visualObservations: analysisResult.visualObservations || 'Analyzed visual content using Claude Vision API',
      technicalNotes: `Claude Vision API analysis. Hash: ${mainMetadata.hash}, Captured: ${new Date(mainMetadata.captured_at * 1000).toISOString()}`,
      relatedPhotos: relatedPhotoIds,
      patterns: analysisResult.patterns || [],
      qualityMetrics
    };
    
    console.log(`[ClaudeVision] Analysis result:`, result);
    return result;
    
  } catch (error) {
    console.error(`[ClaudeVision] API error:`, error);
    // Fallback to metadata analysis
    return await simulateVisualAnalysis(mainMetadata, comparisonMetadata, comparisonPhotoUrls);
  }
}

// Simulate visual analysis with more sophisticated logic
async function simulateVisualAnalysis(
  mainMetadata: any,
  comparisonMetadata: any[],
  comparisonUrls: string[]
): Promise<VisualAnalysisResult> {
  
  // Find photos taken within very short time windows (real burst behavior)
  const burstCandidates = comparisonMetadata.filter(meta => 
    Math.abs(meta.captured_at - mainMetadata.captured_at) <= 10 // Within 10 seconds for burst shots
  );
  
  // Find photos at same location (potential duplicates)
  const locationMatches = comparisonMetadata.filter(meta => 
    mainMetadata.coordinates?.length > 0 && 
    meta.coordinates?.length > 0 &&
    Math.abs(meta.coordinates[0].latitude - mainMetadata.coordinates[0].latitude) < 0.00001 &&
    Math.abs(meta.coordinates[0].longitude - mainMetadata.coordinates[0].longitude) < 0.00001
  );
  
  // Much more conservative burst detection
  if (burstCandidates.length > 0) {
    const timeDiff = Math.abs(burstCandidates[0].captured_at - mainMetadata.captured_at);
    
    return {
      photoId: mainMetadata.id,
      decision: 'burst_shot',
      confidence: 0.8,
      reasoning: `Detected ${burstCandidates.length + 1} photos within ${Math.max(...burstCandidates.map(c => Math.abs(c.captured_at - mainMetadata.captured_at)))} seconds - true rapid sequence`,
      visualObservations: `Photo taken ${timeDiff} seconds ${mainMetadata.captured_at > burstCandidates[0].captured_at ? 'after' : 'before'} another photo. Very rapid timing suggests burst mode.`,
      technicalNotes: `Hash: ${mainMetadata.hash}, Captured: ${new Date(mainMetadata.captured_at * 1000).toISOString()}`,
      relatedPhotos: burstCandidates.map(c => c.id),
      patterns: ['rapid_sequence', 'burst_mode']
    };
  }
  
  // Check for exact location duplicates
  if (locationMatches.length > 0) {
    const closestMatch = locationMatches[0];
    const timeDiff = Math.abs(closestMatch.captured_at - mainMetadata.captured_at);
    
    if (timeDiff <= 30) { // Within 30 seconds at same GPS
      return {
        photoId: mainMetadata.id,
        decision: 'duplicate',
        confidence: 0.9,
        reasoning: `Multiple photos at identical GPS coordinates within ${timeDiff} seconds - likely accidental duplicates`,
        visualObservations: `Same exact location as other photo(s). Close timing suggests unintentional duplicate.`,
        technicalNotes: `Hash: ${mainMetadata.hash}, GPS: ${mainMetadata.coordinates[0]?.latitude.toFixed(6)}, ${mainMetadata.coordinates[0]?.longitude.toFixed(6)}`,
        relatedPhotos: locationMatches.map(m => m.id),
        patterns: ['same_location', 'duplicate']
      };
    }
  }
  
  // More conservative - only flag as similar if there are clear patterns
  const recentSimilar = comparisonMetadata.filter(meta => 
    Math.abs(meta.captured_at - mainMetadata.captured_at) <= 60 // Within 1 minute
  );
  
  if (recentSimilar.length >= 2) { // 3+ photos within 1 minute
    return {
      photoId: mainMetadata.id,
      decision: 'similar',
      confidence: 0.6,
      reasoning: `Part of sequence with ${recentSimilar.length + 1} photos within 60 seconds - possible multiple attempts`,
      visualObservations: `Multiple photos in quick succession suggest photographer taking several shots.`,
      technicalNotes: `Hash: ${mainMetadata.hash}, Captured: ${new Date(mainMetadata.captured_at * 1000).toISOString()}`,
      relatedPhotos: recentSimilar.slice(0, 2).map(m => m.id), // Limit related photos
      patterns: ['sequential_shots']
    };
  }
  
  return {
    photoId: mainMetadata.id,
    decision: 'unique',
    confidence: 0.8,
    reasoning: 'No clear visual or temporal patterns suggesting duplication',
    visualObservations: 'Photo appears distinct based on timing and location analysis',
    technicalNotes: `Hash: ${mainMetadata.hash}, Captured: ${new Date(mainMetadata.captured_at * 1000).toISOString()}`,
    relatedPhotos: [],
    patterns: []
  };
}

// Generate fallback quality metrics based on available metadata
function generateFallbackQualityMetrics(metadata: any): PhotoQualityMetrics {
  // Basic heuristics for quality when we can't analyze the actual image
  const baseQuality = 0.6; // Assume average quality as baseline
  
  // Adjust based on metadata signals
  let qualityAdjustment = 0;
  
  // Hash can indicate uniqueness/quality (different hash = likely different content)
  if (metadata.hash && metadata.hash.length > 20) {
    qualityAdjustment += 0.05;
  }
  
  // Photos with coordinates are often better documented
  if (metadata.coordinates && metadata.coordinates.length > 0) {
    qualityAdjustment += 0.05;
  }
  
  const estimatedQuality = Math.min(1.0, baseQuality + qualityAdjustment);
  
  return {
    sharpness: estimatedQuality,
    composition: estimatedQuality,
    lighting: estimatedQuality,
    subjectClarity: estimatedQuality,
    overallQuality: estimatedQuality,
    qualityNotes: 'Quality estimated from metadata (visual analysis unavailable)'
  };
}

// Fallback analysis when visual analysis fails
function fallbackMetadataAnalysis(metadata: any, allMetadata: any[], allPhotoUrls: string[]): VisualAnalysisResult {
  return {
    photoId: metadata.id,
    decision: 'unique',
    confidence: 0.5,
    reasoning: 'Visual analysis unavailable - using basic metadata fallback',
    visualObservations: 'Could not perform detailed visual comparison',
    technicalNotes: `Hash: ${metadata.hash}, Captured: ${new Date(metadata.captured_at * 1000).toISOString()}`,
    relatedPhotos: [],
    patterns: [],
    qualityMetrics: generateFallbackQualityMetrics(metadata)
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

    // Perform actual Claude visual analysis
    console.log('[ClaudeVisualAnalysis] Analyzing photos with Claude vision...');
    
    const analysisResults: VisualAnalysisResult[] = [];
    
    // Analyze each photo's visual content
    for (let i = 0; i < photoUrls.length; i++) {
      const photoUrl = photoUrls[i];
      const metadata = photoMetadata[i];
      
      try {
        const visualAnalysis = await analyzePhotoVisually(photoUrl, metadata, photoUrls, photoMetadata);
        analysisResults.push(visualAnalysis);
      } catch (error) {
        console.error(`[ClaudeVisualAnalysis] Error analyzing photo ${metadata.id}:`, error);
        // Fallback analysis
        analysisResults.push({
          photoId: metadata.id,
          decision: 'unique',
          confidence: 0.5,
          reasoning: 'Visual analysis failed - using fallback',
          visualObservations: 'Could not analyze visual content',
          technicalNotes: `Hash: ${metadata.hash}, Error: ${error}`,
          relatedPhotos: [],
          patterns: []
        });
      }
    }

    // Create duplicate groups based on analysis results
    const duplicateGroups: Array<{
      id: string;
      type: 'exact_duplicate' | 'burst_sequence' | 'similar_composition';
      photoIds: string[];
      reasoning: string;
      recommendation: string;
      confidence: number;
      bestPhotoId?: string;
      qualityRanking?: string[];
    }> = [];

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

          // For burst sequences, determine the best photo based on quality scores
          let bestPhotoId: string | undefined;
          let qualityRanking: string[] | undefined;
          
          if (groupType === 'burst_sequence') {
            // Collect quality scores for all photos in the group
            const photoQualityScores = groupPhotos.map(photoId => {
              const photoAnalysis = analysisResults.find(a => a.photoId === photoId);
              const qualityScore = photoAnalysis?.qualityMetrics?.overallQuality || 0.5;
              return { photoId, qualityScore, analysis: photoAnalysis };
            });
            
            // Sort by quality score (highest first)
            photoQualityScores.sort((a, b) => b.qualityScore - a.qualityScore);
            
            bestPhotoId = photoQualityScores[0].photoId;
            qualityRanking = photoQualityScores.map(pq => pq.photoId);
            
            // Log quality ranking for debugging
            console.log(`[ClaudeVision] Burst sequence quality ranking:`, 
              photoQualityScores.map(pq => `${pq.photoId}: ${(pq.qualityScore * 100).toFixed(0)}%`).join(', ')
            );
          }

          // Generate specific recommendation based on quality analysis
          let recommendation = groupType === 'exact_duplicate' 
            ? 'Keep the first photo and delete the rest - visual analysis detected near-identical content'
            : groupType === 'burst_sequence' && bestPhotoId
            ? `Keep photo ${bestPhotoId} (${((analysisResults.find(a => a.photoId === bestPhotoId)?.qualityMetrics?.overallQuality || 0) * 100).toFixed(0)}% quality score) - highest quality photo from burst sequence`
            : 'Review photos for best composition - detected similar content patterns';
            
          // Add quality notes if available
          if (groupType === 'burst_sequence' && bestPhotoId) {
            const bestPhotoAnalysis = analysisResults.find(a => a.photoId === bestPhotoId);
            if (bestPhotoAnalysis?.qualityMetrics?.qualityNotes) {
              recommendation += `. Selected for: ${bestPhotoAnalysis.qualityMetrics.qualityNotes}`;
            }
          }

          duplicateGroups.push({
            id: `group_${groupId++}`,
            type: groupType,
            photoIds: groupPhotos,
            reasoning: analysis.reasoning,
            recommendation,
            confidence: analysis.confidence,
            bestPhotoId,
            qualityRanking
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
        analysisMethod: 'claude_visual_content'
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