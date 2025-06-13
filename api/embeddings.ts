// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EmbeddingsRequestBody {
  descriptions: string[];
}

interface EmbeddingsResponse {
  similarity: number;
  method: 'semantic_embeddings';
  debugInfo?: {
    embedding1Length: number;
    embedding2Length: number;
    model: string;
  };
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimensions must match');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { descriptions }: EmbeddingsRequestBody = req.body;

    // Validate input
    if (!descriptions || !Array.isArray(descriptions) || descriptions.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid request body. Expected { descriptions: [string, string] }' 
      });
    }

    const [description1, description2] = descriptions;

    if (!description1 || !description2 || typeof description1 !== 'string' || typeof description2 !== 'string') {
      return res.status(400).json({ 
        error: 'Both descriptions must be non-empty strings' 
      });
    }

    console.log(`[Embeddings API] Generating embeddings for: "${description1.substring(0, 50)}..." vs "${description2.substring(0, 50)}..."`);

    // Generate embeddings for both descriptions
    const [embedding1Response, embedding2Response] = await Promise.all([
      openai.embeddings.create({
        input: description1.trim(),
        model: "text-embedding-3-small", // Cheaper and faster than ada-002
      }),
      openai.embeddings.create({
        input: description2.trim(),
        model: "text-embedding-3-small",
      })
    ]);

    const embedding1 = embedding1Response.data[0].embedding;
    const embedding2 = embedding2Response.data[0].embedding;

    // Calculate cosine similarity
    const similarity = cosineSimilarity(embedding1, embedding2);
    
    console.log(`[Embeddings API] Calculated semantic similarity: ${(similarity * 100).toFixed(1)}%`);

    const response: EmbeddingsResponse = {
      similarity: Math.max(0, Math.min(1, similarity)), // Clamp to [0, 1]
      method: 'semantic_embeddings',
      debugInfo: {
        embedding1Length: embedding1.length,
        embedding2Length: embedding2.length,
        model: 'text-embedding-3-small'
      }
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[Embeddings API] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate embeddings',
      details: error.message 
    });
  }
}