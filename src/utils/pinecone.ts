// © 2025 Mark Hustad — MIT License
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// Lazy-loaded clients
let pinecone: Pinecone | null = null;
let openai: OpenAI | null = null;

// Initialize Pinecone client
function getPineconeClient(): Pinecone {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Get Pinecone index
export function getPineconeIndex() {
  const indexName = process.env.PINECONE_INDEX_NAME || 'companycam-photos';
  return getPineconeClient().index(indexName);
}

// Generate embedding for text
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    input: text.replace(/\n/g, ' '),
    model: "text-embedding-3-small",
  });
  return response.data[0].embedding;
}

// Photo metadata interface
export interface PhotoMetadata {
  id: string;
  project_id: string;
  project_name?: string;
  description?: string;
  tags?: string[];
  captured_at: number; // Unix timestamp
  creator_id?: string;
  creator_name?: string;
  url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

// Upsert photos to Pinecone
export async function upsertPhotos(photos: PhotoMetadata[]): Promise<void> {
  const index = getPineconeIndex();
  const vectors = [];

  for (const photo of photos) {
    // Create text for embedding from description and tags
    const textParts = [];
    if (photo.description) textParts.push(photo.description);
    if (photo.tags && photo.tags.length > 0) {
      textParts.push(`Tags: ${photo.tags.join(', ')}`);
    }
    if (photo.project_name) textParts.push(`Project: ${photo.project_name}`);
    
    const text = textParts.join('. ') || `Photo ${photo.id}`;
    const embedding = await generateEmbedding(text);

    vectors.push({
      id: photo.id,
      values: embedding,
      metadata: {
        ...photo,
        text, // Store the text used for embedding
      },
    });
  }

  // Batch upsert (Pinecone supports up to 100 vectors per batch)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    console.log(`[Pinecone] Upserting batch of ${batch.length} vectors`);
    await index.upsert(batch);
  }
  console.log(`[Pinecone] Successfully upserted ${vectors.length} vectors`);
}

// Delete photos from Pinecone
export async function deletePhotos(photoIds: string[]): Promise<void> {
  const index = getPineconeIndex();
  await index.deleteMany(photoIds);
}

// Query similar photos
export async function querySimilarPhotos(
  text: string,
  filter?: any,
  topK: number = 20
): Promise<any[]> {
  const index = getPineconeIndex();
  const embedding = await generateEmbedding(text);

  const queryResponse = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    ...(filter && { filter }),
  });

  return queryResponse.matches || [];
}