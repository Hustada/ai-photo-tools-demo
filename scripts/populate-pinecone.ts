// © 2025 Mark Hustad — MIT License
// scripts/populate-pinecone.ts

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config(); // Load .env from the current working directory (project root)

const openaiApiKey = process.env.OPENAI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT; // This is needed for Pinecone client initialization
const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

if (!openaiApiKey || !pineconeApiKey || !pineconeEnvironment || !pineconeIndexName) {
  console.error(
    'Missing one or more required environment variables: OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME',
  );
  process.exit(1);
}

const pinecone = new Pinecone({
  apiKey: pineconeApiKey,
  // environment: pineconeEnvironment, // For serverless, this might be handled differently or automatically
});

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Helper function to generate embeddings (similar to the one in suggest-ai-tags.ts)
async function generateEmbeddings(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: model,
      input: text.replace(/\n/g, ' '), // OpenAI recommends replacing newlines
    });
    if (response.data && response.data.length > 0 && response.data[0].embedding) {
      return response.data[0].embedding;
    }
    throw new Error('Failed to generate embedding or embedding data is missing.');
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

const memoriesToUpload = [
  {
    id: 'global_mem_001',
    text: 'Exterior siding installation in progress, showing house wrap and newly installed planks.',
    metadata: { type: 'global_example', category: 'siding', source: 'manual_entry_20250530' },
  },
  {
    id: 'global_mem_002',
    text: 'Close-up of a damaged roof shingle, indicating cracks and wear, likely needing replacement.',
    metadata: { type: 'global_example', category: 'roofing', source: 'manual_entry_20250530' },
  },
  {
    id: 'global_mem_003',
    text: 'Interior view of a kitchen remodel, highlighting new white shaker cabinets and granite countertops.',
    metadata: { type: 'global_example', category: 'kitchen_remodel', source: 'manual_entry_20250530' },
  },
  {
    id: 'global_mem_004',
    text: 'Observed crack in concrete foundation wall during a structural inspection.',
    metadata: { type: 'global_example', category: 'foundation', source: 'manual_entry_20250530' },
  },
  {
    id: 'global_mem_005',
    text: 'Standard plumbing setup under a bathroom sink, including P-trap and hot/cold water supply lines.',
    metadata: { type: 'global_example', category: 'plumbing', source: 'manual_entry_20250530' },
  },
];

async function populatePinecone() {
  console.log(`Connecting to Pinecone index: ${pineconeIndexName} in environment: ${pineconeEnvironment}`);
  // For Pinecone SDK v6+, index name is passed to the index method.
  // The environment for serverless is typically part of the host URL and handled by the client.
  const index = pinecone.index<{ text: string; type: string; category: string; source: string }>(pineconeIndexName!);

  console.log(`Embedding and upserting ${memoriesToUpload.length} memories...`);

  for (const memory of memoriesToUpload) {
    try {
      console.log(`Embedding text for ID: ${memory.id}: "${memory.text.substring(0, 50)}..."`);
      const embedding = await generateEmbeddings(memory.text);
      console.log(`Generated embedding with ${embedding.length} dimensions.`);

      const vectorToUpsert = {
        id: memory.id,
        values: embedding,
        metadata: {
          text: memory.text, // Store the original text in metadata
          ...memory.metadata,
        },
      };

      console.log(`Upserting vector for ID: ${memory.id}`);
      await index.upsert([vectorToUpsert]);
      console.log(`Successfully upserted vector for ID: ${memory.id}`);
    } catch (error) {
      console.error(`Failed to process memory ID ${memory.id}:`, error);
    }
  }

  console.log('Finished populating Pinecone index.');
  // You can query the index stats to confirm
  const stats = await index.describeIndexStats();
  console.log('Index stats:', stats);
}

populatePinecone().catch((error) => {
  console.error('An error occurred during the Pinecone population process:', error);
  process.exit(1);
});
