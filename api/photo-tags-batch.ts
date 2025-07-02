// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

interface Tag {
  id: string;
  display_value: string;
  value: string;
  company_id: string;
  created_at: number;
  updated_at: number;
}

interface BatchRequest {
  photoIds: string[];
  apiKey: string;
}

interface BatchResponse {
  photoTags: Record<string, Tag[]>;
  errors?: Record<string, string>;
}

// Helper function to make a single photo tags request
async function fetchPhotoTags(apiKey: string, photoId: string): Promise<Tag[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.companycam.com',
      path: `/v2/photos/${photoId}/tags`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-CompanyCam-Source': 'cc-ai-photo-inspirations-backend;vercel-serverless',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const tags: Tag[] = JSON.parse(data);
            resolve(tags);
          } catch (e) {
            console.error(`Error parsing tags response for photo ${photoId}:`, e);
            resolve([]); // Return empty array if parsing fails
          }
        } else if (res.statusCode === 404) {
          // Photo has no tags - this is normal
          resolve([]);
        } else {
          console.error(`Error fetching tags for photo ${photoId}: ${res.statusCode}, ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Request error fetching tags for photo ${photoId}:`, e);
      reject(e);
    });

    req.end();
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('--- photo-tags-batch.ts function invoked ---');

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
    const { photoIds, apiKey }: BatchRequest = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'photoIds array is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    console.log(`Batch fetching photo tags for ${photoIds.length} photos from CompanyCam API`);

    const photoTags: Record<string, Tag[]> = {};
    const errors: Record<string, string> = {};

    // Process in batches to avoid rate limiting
    const BATCH_SIZE = 5; // Process 5 photos at a time
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
    
    console.log(`Processing ${photoIds.length} photos in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < photoIds.length; i += BATCH_SIZE) {
      const batch = photoIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(photoIds.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} photos)`);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (photoId) => {
        try {
          const tags = await fetchPhotoTags(apiKey, photoId);
          photoTags[photoId] = tags;
          console.log(`Fetched ${tags.length} tags for photo ${photoId}`);
        } catch (error) {
          console.error(`Error fetching tags for photo ${photoId}:`, error);
          errors[photoId] = error instanceof Error ? error.message : 'Unknown error';
          photoTags[photoId] = []; // Provide empty array as fallback
        }
      }));
      
      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < photoIds.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log(`Batch fetch complete: ${Object.keys(photoTags).length} photos processed, ${Object.keys(errors).length} errors`);

    const batchResponse: BatchResponse = {
      photoTags,
      ...(Object.keys(errors).length > 0 && { errors })
    };

    return res.status(200).json(batchResponse);

  } catch (error) {
    console.error('Error in batch photo tags endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch photo tags', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}