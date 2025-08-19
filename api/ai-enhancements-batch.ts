// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface PhotoEnhancement {
  id?: string;
  photo_id: string;
  user_id: string;
  ai_description?: string | null;
  accepted_ai_tags: string[];
  suggestion_source?: string;
  created_at?: string;
  updated_at?: string;
}

interface BatchRequest {
  photoIds: string[];
}

interface BatchResponse {
  enhancements: Record<string, PhotoEnhancement>;
  errors?: Record<string, string>;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const photoEnhancements = {
  async getBatch(photoIds: string[]): Promise<PhotoEnhancement[]> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .in('photo_id', photoIds);
    
    if (error) {
      console.error('Error fetching batch enhancements:', error);
      throw error;
    }
    
    return data || [];
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('--- ai-enhancements-batch.ts function invoked ---');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { photoIds }: BatchRequest = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'photoIds array is required' });
    }

    console.log(`Batch fetching AI enhancements for ${photoIds.length} photos`);

    // Limit batch size to prevent timeouts
    if (photoIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 photos per batch' });
    }

    const enhancements: Record<string, PhotoEnhancement> = {};
    const errors: Record<string, string> = {};

    try {
      // Fetch all enhancements in a single query
      const results = await photoEnhancements.getBatch(photoIds);
      
      // Create a map for O(1) lookup
      results.forEach(enhancement => {
        enhancements[enhancement.photo_id] = enhancement;
      });

      // Track which photos don't have enhancements (this is normal)
      photoIds.forEach(photoId => {
        if (!enhancements[photoId]) {
          console.log(`No AI enhancement found for photo ${photoId}`);
        }
      });

      console.log(`Batch fetch complete: ${Object.keys(enhancements).length} enhancements found`);

      const batchResponse: BatchResponse = {
        enhancements,
        ...(Object.keys(errors).length > 0 && { errors })
      };

      return res.status(200).json(batchResponse);
    } catch (dbError) {
      console.error('Error fetching batch from Supabase:', dbError);
      return res.status(500).json({ 
        error: 'Failed to fetch batch enhancements',
        details: dbError instanceof Error ? dbError.message : 'Database error'
      });
    }

  } catch (error) {
    console.error('Error in batch AI enhancements endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch AI enhancements', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}