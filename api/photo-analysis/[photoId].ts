// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AnalysisUpdateRequest {
  analyzed_at: string;
  analysis_version: string;
  user_action?: 'kept' | 'archived' | 'pending' | null;
}

/**
 * API endpoint to mark photos as analyzed by Scout AI
 * PATCH /api/photo-analysis/[photoId]
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { photoId } = req.query;
  
  if (!photoId || typeof photoId !== 'string') {
    return res.status(400).json({ error: 'Photo ID is required' });
  }

  const { analyzed_at, analysis_version, user_action }: AnalysisUpdateRequest = req.body;

  if (!analyzed_at || !analysis_version) {
    return res.status(400).json({ 
      error: 'analyzed_at and analysis_version are required' 
    });
  }

  try {
    // For now, we'll simulate the database update
    // In a real implementation, this would update the CompanyCam database
    console.log(`[PhotoAnalysis] Marking photo ${photoId} as analyzed:`, {
      analyzed_at,
      analysis_version,
      user_action
    });

    // Simulate database update delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return the updated photo data
    const updatedPhoto = {
      id: photoId,
      scout_ai_analyzed_at: analyzed_at,
      scout_ai_analysis_version: analysis_version,
      scout_ai_user_action: user_action,
      updated_at: Date.now()
    };

    console.log(`[PhotoAnalysis] Successfully marked photo ${photoId} as analyzed`);
    
    res.status(200).json({
      success: true,
      photo: updatedPhoto,
      message: 'Photo analysis status updated'
    });

  } catch (error) {
    console.error('[PhotoAnalysis] Error updating photo analysis status:', error);
    res.status(500).json({ 
      error: 'Failed to update photo analysis status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}