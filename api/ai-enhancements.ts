// api/ai-enhancements.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Database types
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

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions
const photoEnhancements = {
  async get(photoId: string): Promise<PhotoEnhancement | null> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .select('*')
      .eq('photo_id', photoId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching enhancement:', error);
      throw error;
    }
    
    return data;
  },

  async upsert(enhancement: PhotoEnhancement): Promise<PhotoEnhancement> {
    const { data, error } = await supabase
      .from('photo_enhancements')
      .upsert(enhancement, { onConflict: 'photo_id' })
      .select()
      .single();
    
    if (error) {
      console.error('Error upserting enhancement:', error);
      throw error;
    }
    
    return data;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API_AI_ENHANCEMENTS_HANDLER: Method:', req.method, 'Query:', req.query);
  const { photoId } = req.query;
  const body = req.body;

  if (req.method === 'GET') {
    if (!photoId || typeof photoId !== 'string') {
      console.log('[AI Enhancements GET] Missing or invalid photoId:', photoId);
      return res.status(400).json({ error: 'Missing or invalid photoId' });
    }

    try {
      const enhancement = await photoEnhancements.get(photoId);

      if (enhancement) {
        console.log(`[AI Enhancements GET] Data found for photo ${photoId}`);
        return res.status(200).json(enhancement);
      } else {
        console.log(`[AI Enhancements GET] No data found for photo ${photoId}`);
        return res.status(404).json({ message: 'No enhancements found for this photo.' });
      }
    } catch (error: any) {
      console.error(`[AI Enhancements GET] Error fetching data:`, error);
      return res.status(500).json({ 
        error: 'Failed to fetch enhancement.', 
        details: error.message 
      });
    }
  }

  if (req.method === 'POST') {
    console.log('API_POST_ENHANCEMENT: Received POST request. Body:', JSON.stringify(body, null, 2));
    const {
      photoId: bodyPhotoId,
      userId,
      description,
      aiDescription,
      tagToAdd,
      acceptedAiTags,
      suggestionSource,
    } = body;

    if (!bodyPhotoId || typeof bodyPhotoId !== 'string') {
      return res.status(400).json({ error: 'Photo ID is required in the request body.' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    try {
      // Get existing enhancement if it exists
      const existing = await photoEnhancements.get(bodyPhotoId);
      
      // Prepare the enhancement object
      const enhancement: PhotoEnhancement = {
        photo_id: bodyPhotoId,
        user_id: userId,
        ai_description: null,
        accepted_ai_tags: existing?.accepted_ai_tags || [],
        suggestion_source: suggestionSource || existing?.suggestion_source || 'Unknown',
      };

      // Handle description updates
      const descriptionValue = aiDescription || description;
      if (typeof descriptionValue === 'string') {
        enhancement.ai_description = descriptionValue;
      } else if (descriptionValue === null) {
        enhancement.ai_description = null;
      } else if (existing?.ai_description) {
        enhancement.ai_description = existing.ai_description;
      }

      // Handle tag updates
      if (Array.isArray(acceptedAiTags)) {
        enhancement.accepted_ai_tags = acceptedAiTags.filter(tag => 
          typeof tag === 'string' && tag.trim() !== ''
        );
        console.log(`API_POST_ENHANCEMENT: Set accepted_ai_tags to:`, enhancement.accepted_ai_tags);
      } else if (typeof tagToAdd === 'string' && tagToAdd.trim() !== '') {
        if (!enhancement.accepted_ai_tags.includes(tagToAdd)) {
          enhancement.accepted_ai_tags.push(tagToAdd);
        }
        console.log(`API_POST_ENHANCEMENT: Added single tag "${tagToAdd}"`);
      }
      
      if (suggestionSource && typeof suggestionSource === 'string') {
        enhancement.suggestion_source = suggestionSource;
      }

      console.log('API_POST_ENHANCEMENT: Saving enhancement:', JSON.stringify(enhancement, null, 2));
      const saved = await photoEnhancements.upsert(enhancement);
      console.log('API_POST_ENHANCEMENT: Successfully saved');
      
      return res.status(200).json(saved);
    } catch (error: any) {
      console.error('API_POST_ENHANCEMENT_ERROR:', error);
      return res.status(500).json({ 
        error: 'Failed to save enhancement.',
        details: error.message 
      });
    }
  }

  if (req.method === 'DELETE') {
    const {
      photoId: bodyPhotoId,
      userId,
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
      const existing = await photoEnhancements.get(bodyPhotoId);

      if (!existing) {
        return res.status(404).json({ message: 'No enhancements found to delete.' });
      }

      let modified = false;
      const enhancement = { ...existing };

      if (typeof tagToRemove === 'string' && tagToRemove.trim() !== '') {
        const initialLength = enhancement.accepted_ai_tags.length;
        enhancement.accepted_ai_tags = enhancement.accepted_ai_tags.filter(
          (tag: string) => tag !== tagToRemove
        );
        if (enhancement.accepted_ai_tags.length !== initialLength) {
          modified = true;
        }
      }

      if (clearDescription === true) {
        if (enhancement.ai_description !== null && enhancement.ai_description !== undefined) {
          enhancement.ai_description = null;
          modified = true;
        }
      }

      if (modified) {
        const updated = await photoEnhancements.upsert(enhancement);
        return res.status(200).json(updated);
      } else {
        return res.status(200).json({ 
          message: 'No changes made to enhancements.', 
          enhancement 
        });
      }

    } catch (error: any) {
      console.error('Error deleting/clearing enhancement:', error);
      return res.status(500).json({ 
        error: 'Failed to delete/clear enhancement.',
        details: error.message 
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}