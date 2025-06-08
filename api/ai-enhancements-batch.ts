// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface ApiPhotoEnhancement {
  photo_id: string;
  user_id: string;
  ai_description?: string;
  accepted_ai_tags: string[];
  created_at: string;
  updated_at: string;
  suggestion_source?: string;
}

interface BatchRequest {
  photoIds: string[];
}

interface BatchResponse {
  enhancements: Record<string, ApiPhotoEnhancement>;
  errors?: Record<string, string>;
}

const getEnhancementKey = (photoId: string): string => `photo_enhancement:${photoId}`;

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

    console.log(`Batch fetching AI enhancements for ${photoIds.length} photos:`, photoIds);

    const enhancements: Record<string, ApiPhotoEnhancement> = {};
    const errors: Record<string, string> = {};

    // Load existing AI enhancements from Vercel KV store
    await Promise.all(photoIds.map(async (photoId) => {
      try {
        const key = getEnhancementKey(photoId);
        const enhancement = await kv.get<ApiPhotoEnhancement>(key);
        
        if (enhancement) {
          enhancements[photoId] = enhancement;
          console.log(`Loaded AI enhancement for photo ${photoId}`);
        } else {
          // No enhancement exists for this photo - this is normal
          console.log(`No AI enhancement found for photo ${photoId}`);
        }
      } catch (error) {
        console.error(`Error fetching AI enhancement for ${photoId}:`, error);
        errors[photoId] = error instanceof Error ? error.message : 'KV fetch error';
      }
    }));

    console.log(`Batch fetch complete: ${Object.keys(enhancements).length} enhancements, ${Object.keys(errors).length} errors`);

    const batchResponse: BatchResponse = {
      enhancements,
      ...(Object.keys(errors).length > 0 && { errors })
    };

    return res.status(200).json(batchResponse);

  } catch (error) {
    console.error('Error in batch AI enhancements endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch AI enhancements', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}