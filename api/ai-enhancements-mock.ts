// Temporary mock storage for AI enhancements when KV is not available
import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory storage (will reset when server restarts)
const mockStorage = new Map<string, any>();

interface PhotoAiEnhancement {
  photo_id: string;
  user_id: string;
  ai_description?: string | null;
  accepted_ai_tags: string[];
  suggestion_source?: string;
  created_at: string;
  updated_at: string;
}

const getEnhancementKey = (photoId: string): string => `photo_enhancement:${photoId}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Mock AI Enhancements] Method:', req.method, 'Query:', req.query);
  const { photoId } = req.query;
  const body = req.body;

  if (req.method === 'GET') {
    if (!photoId || typeof photoId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid photoId' });
    }

    const key = getEnhancementKey(photoId);
    const enhancement = mockStorage.get(key);

    if (enhancement) {
      console.log(`[Mock] Found enhancement for ${key}`);
      return res.status(200).json(enhancement);
    } else {
      console.log(`[Mock] No enhancement for ${key}`);
      return res.status(404).json({ message: 'No enhancements found for this photo.' });
    }
  }

  if (req.method === 'POST') {
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

    const key = getEnhancementKey(bodyPhotoId);
    let enhancement = mockStorage.get(key);
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
      enhancement.user_id = userId;
    }

    // Handle description updates
    const descriptionValue = aiDescription || description;
    if (typeof descriptionValue === 'string') {
      enhancement.ai_description = descriptionValue;
    } else if (descriptionValue === null) {
      enhancement.ai_description = null;
    }

    // Handle tag updates
    if (Array.isArray(acceptedAiTags)) {
      enhancement.accepted_ai_tags = acceptedAiTags.filter(tag => typeof tag === 'string' && tag.trim() !== '');
    } else if (typeof tagToAdd === 'string' && tagToAdd.trim() !== '') {
      if (!enhancement.accepted_ai_tags.includes(tagToAdd)) {
        enhancement.accepted_ai_tags.push(tagToAdd);
      }
    }
    
    if (suggestionSource && typeof suggestionSource === 'string') {
      enhancement.suggestion_source = suggestionSource;
    }

    mockStorage.set(key, enhancement);
    console.log(`[Mock] Saved enhancement for ${key}`);
    
    return res.status(200).json(enhancement);
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

    const key = getEnhancementKey(bodyPhotoId);
    let enhancement = mockStorage.get(key);

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

    if (modified) {
      enhancement.updated_at = new Date().toISOString();
      mockStorage.set(key, enhancement);
      return res.status(200).json(enhancement);
    } else {
      return res.status(200).json({ message: 'No changes made to enhancements.', enhancement });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}