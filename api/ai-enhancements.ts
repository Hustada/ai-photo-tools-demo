// api/ai-enhancements.ts
import { createClient } from '@vercel/kv'; // Import createClient
import type { NextApiRequest, NextApiResponse } from 'next'; // Using Next.js types for Vercel Functions

// Manually initialize kv with Vercel-provided environment variable names
const kv = createClient({
  url: process.env.KV_KV_REST_API_URL,
  token: process.env.KV_KV_REST_API_TOKEN,
});

// Define the structure for our AI enhancement data
interface PhotoAiEnhancement {
  photo_id: string; // CompanyCam photo ID
  user_id: string; // User who accepted/made the enhancement
  ai_description?: string | null;
  accepted_ai_tags: string[];
  suggestion_source?: string; // e.g., "OpenAI-GPT-4o"
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

const getEnhancementKey = (photoId: string): string => `photo_enhancement:${photoId}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API_AI_ENHANCEMENTS_HANDLER: File execution started. Method:', req.method, 'Query:', req.query);
  const { photoId } = req.query; // For GET requests
  const body = req.body; // For POST/DELETE requests

  if (req.method === 'GET') {
    if (!photoId || typeof photoId !== 'string') {
      return res.status(400).json({ error: 'Photo ID is required as a query parameter.' });
    }
    try {
      console.log(`API_GET_ENHANCEMENT: Received photoId from query: '${photoId}'`);
      const key = getEnhancementKey(photoId);
      console.log(`API_GET_ENHANCEMENT: Generated key: '${key}'`);
      const enhancement = await kv.get<PhotoAiEnhancement>(key);
      console.log(`API_GET_ENHANCEMENT: kv.get('${key}') returned:`, JSON.stringify(enhancement, null, 2));
      if (enhancement) {
        return res.status(200).json(enhancement);
      } else {
        return res.status(404).json({ message: 'No enhancements found for this photo.' });
      }
    } catch (error) {
      console.error('Error fetching enhancement:', error);
      return res.status(500).json({ error: 'Failed to fetch enhancement.' });
    }
  }

  if (req.method === 'POST') {
      console.log('API_POST_ENHANCEMENT: Received POST request. Body:', JSON.stringify(body, null, 2));
    const {
      photoId: bodyPhotoId,
      userId,
      description,
      tagToAdd,
      suggestionSource,
    } = body;

    if (!bodyPhotoId || typeof bodyPhotoId !== 'string') {
      return res.status(400).json({ error: 'Photo ID is required in the request body.' });
    }
    if (!userId || typeof userId !== 'string') {
      // For now, we can use VITE_APP_DEFAULT_USER_ID from .env
      return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
      const key = getEnhancementKey(bodyPhotoId);
      console.log(`API_POST_ENHANCEMENT: Generated key: '${key}' for photoId: '${bodyPhotoId}'`); // Added log

      let enhancement = await kv.get<PhotoAiEnhancement>(key);
      const now = new Date().toISOString();

      if (!enhancement) {
        enhancement = {
          photo_id: bodyPhotoId,
          user_id: userId,
          accepted_ai_tags: [],
          created_at: now,
          updated_at: now,
          suggestion_source: suggestionSource || 'Unknown',
        };
      } else {
        enhancement.updated_at = now;
        enhancement.user_id = userId; // Update user if a different user modifies
      }

      if (typeof description === 'string') {
        enhancement.ai_description = description;
      } else if (description === null) { // Explicitly clear description
        enhancement.ai_description = null;
      }


      if (typeof tagToAdd === 'string' && tagToAdd.trim() !== '') {
        if (!enhancement.accepted_ai_tags.includes(tagToAdd)) {
          enhancement.accepted_ai_tags.forEach((tag: string) => {
            // No action needed here, just added explicit type to 'tag' parameter
          });
          enhancement.accepted_ai_tags.push(tagToAdd);
        }
      }
      
      if (suggestionSource && typeof suggestionSource === 'string') {
        enhancement.suggestion_source = suggestionSource;
      }

      console.log('API_POST_ENHANCEMENT: Full enhancement data to save:', JSON.stringify(enhancement, null, 2)); // Added log
      const setResult = await kv.set(key, enhancement);
      console.log(`API_POST_ENHANCEMENT: kv.set('${key}') result:`, JSON.stringify(setResult, null, 2)); // Added log
      
      return res.status(200).json(enhancement);
    } catch (error) {
      console.error('API_POST_ENHANCEMENT_ERROR: Error saving enhancement:', error); // Enhanced error log
      return res.status(500).json({ error: 'Failed to save enhancement.' });
    }
  }

  if (req.method === 'DELETE') {
    const {
      photoId: bodyPhotoId,
      userId, // Good to have for authorization in future, not strictly used for delete logic here yet
      tagToRemove,
      clearDescription,
    } = body;

    if (!bodyPhotoId || typeof bodyPhotoId !== 'string') {
      return res.status(400).json({ error: 'Photo ID is required in the request body.' });
    }
     if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
      const key = getEnhancementKey(bodyPhotoId);
      let enhancement = await kv.get<PhotoAiEnhancement>(key);

      if (!enhancement) {
        return res.status(404).json({ message: 'No enhancements found to delete.' });
      }

      let modified = false;
      if (typeof tagToRemove === 'string' && tagToRemove.trim() !== '') {
        const initialLength = enhancement.accepted_ai_tags.length;
        enhancement.accepted_ai_tags = enhancement.accepted_ai_tags.filter(
          (tag: string) => tag !== tagToRemove
        );
        if (enhancement.accepted_ai_tags.length !== initialLength) modified = true;
      }

      if (clearDescription === true) {
        if (enhancement.ai_description !== null && enhancement.ai_description !== undefined) {
             enhancement.ai_description = null;
             modified = true;
        }
      }
      
      // If the object becomes empty of AI data (no description, no tags), consider deleting the key
      // or leave it to indicate it was processed. For now, we'll update.
      // if (!enhancement.ai_description && enhancement.accepted_ai_tags.length === 0) {
      //   await kv.del(key);
      //   return res.status(200).json({ message: 'Enhancements cleared and record deleted.' });
      // }

      if (modified) {
        enhancement.updated_at = new Date().toISOString();
        await kv.set(key, enhancement);
        return res.status(200).json(enhancement);
      } else {
        return res.status(200).json({ message: 'No changes made to enhancements.', enhancement });
      }

    } catch (error) {
      console.error('Error deleting/clearing enhancement:', error);
      return res.status(500).json({ error: 'Failed to delete/clear enhancement.' });
    }
  }

  // Handle other methods or return 405 Method Not Allowed
  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
