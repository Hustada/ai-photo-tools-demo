// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize OpenAI client
// Ensure OPENAI_API_KEY is set in your .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Interfaces for Request and Response ---
interface SuggestAiTagsRequestBody {
  photoUrl: string;
  userId?: string; // Optional for now, for phased implementation
}

interface GoogleVisionLabelAnnotation {
  mid?: string;
  description?: string;
  score?: number;
  topicality?: number;
}

interface GoogleVisionWebEntity {
  entityId?: string;
  score?: number;
  description?: string;
}

interface GoogleVisionWebDetection {
  webEntities?: GoogleVisionWebEntity[];
  // Add other web detection fields if needed (e.g., fullMatchingImages, partialMatchingImages)
}

interface GoogleVisionResponse {
  labelAnnotations?: GoogleVisionLabelAnnotation[];
  webDetection?: GoogleVisionWebDetection;
  // Add textAnnotations if we decide to use it
  error?: { code: number; message: string };
}

interface AiSuggestions {
  suggestedTags: string[];
  suggestedDescription: string;
  checklistTriggers?: string[];
  debugInfo?: any; // For returning intermediate data during development
}

// --- Stubs for future AI pipeline steps ---

// Embedding vector type from OpenAI (e.g., text-embedding-3-small has 1536 dimensions)
export type EmbeddingVector = number[];

// Placeholder for memory chunk type retrieved from vector DB
interface MemoryChunk {
  id: string;
  text: string; // Combined labels/description from a past similar photo
  similarity: number;
}

async function queryVectorMemory(
  embedding: EmbeddingVector,
  userId?: string
): Promise<MemoryChunk[]> {
  console.log(`Attempting to query Pinecone vector memory. UserID: ${userId}`);

  const apiKey = process.env.PINECONE_API_KEY;
  const environment = process.env.PINECONE_ENVIRONMENT;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!apiKey || !environment || !indexName) {
    console.error('Pinecone API key, environment, or index name is not configured in environment variables.');
    return []; 
  }

  try {
    const pinecone = new Pinecone(); // Automatically uses PINECONE_API_KEY and PINECONE_ENVIRONMENT from process.env for v6+

    const index = pinecone.index<{
      text: string; 
      imageUrl?: string;
      originalPhotoId?: string; 
    }>(indexName);

    const queryResponse = await index.query({
      vector: embedding,
      topK: 5, 
      includeMetadata: true,
    });

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log(`Found ${queryResponse.matches.length} matches in Pinecone.`);
      const memoryChunksToReturn: MemoryChunk[] = queryResponse.matches.map(match => ({
        id: match.id, 
        text: match.metadata?.text || 'No text metadata found',
        similarity: match.score || 0, 
      }));
      return memoryChunksToReturn;
    } else {
      console.log('No matches found in Pinecone for the given embedding.');
      return [];
    }
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    return []; 
  }
}

// Placeholder for GPT prompt structure
interface GptPrompt {
  systemMessage: string;
  userMessages: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

async function generateEmbeddings(
  labels: GoogleVisionLabelAnnotation[],
  webEntities: GoogleVisionWebEntity[]
): Promise<EmbeddingVector> {
  console.log('generateEmbeddings called with labels:', (labels || []).length, 'and web entities:', (webEntities || []).length);

  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is not set. Cannot generate embeddings.');
    throw new Error('OpenAI API key not configured.');
  }

  const labelDescriptions = (labels || [])
    .filter(label => label.description && (label.score || 0) > 0.6)
    .map(label => label.description!);
  
  const webEntityDescriptions = (webEntities || [])
    .filter(entity => entity.description && (entity.score || 0) > 0.2)
    .map(entity => entity.description!);
  
  const combinedTextItems = [...new Set([...labelDescriptions, ...webEntityDescriptions])];
  const inputText = combinedTextItems.join(', ').trim();

  if (!inputText) {
    console.log('No significant text found from labels/web entities to generate embedding. Returning zero vector.');
    return Array(1536).fill(0); // text-embedding-3-small has 1536 dimensions
  }

  console.log(`Text for OpenAI embedding (length: ${inputText.length}): "${inputText.substring(0, 200)}${inputText.length > 200 ? '...' : ''}"`);

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputText,
    });

    if (embeddingResponse.data && embeddingResponse.data.length > 0 && embeddingResponse.data[0].embedding) {
      console.log('Successfully generated embedding from OpenAI.');
      return embeddingResponse.data[0].embedding;
    } else {
      console.error('OpenAI embedding response did not contain expected data:', JSON.stringify(embeddingResponse, null, 2));
      throw new Error('Failed to retrieve embedding from OpenAI response.');
    }
  } catch (error: any) {
    let errorMessage = error.message;
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      errorMessage = error.response.data.error.message;
    }
    console.error('Error calling OpenAI Embeddings API:', errorMessage, error.stack);
    throw new Error(`OpenAI Embeddings API error: ${errorMessage}`);
  }
}

async function assembleGptPrompt(
  visionResponse: GoogleVisionResponse,
  memoryChunks: MemoryChunk[]
): Promise<GptPrompt> {
  console.log('STUB: assembleGptPrompt called with vision data and memory chunks:', memoryChunks.length);
  const systemMessage =
    'You are an expert construction photo analyst for CompanyCam. Your task is to suggest concise tags (3-5) and a one-sentence CompanyCam-style description based on the provided image labels and relevant past examples. Identify any checklist triggers if applicable.';
  
  const userMessages: Array<{ type: 'text'; text: string }> = [
    { type: 'text', text: `Image Labels: ${visionResponse.labelAnnotations?.map(l => l.description).join(', ') || 'None'}` },
    { type: 'text', text: `Web Entities: ${visionResponse.webDetection?.webEntities?.map(e => e.description).join(', ') || 'None'}` },
  ];

  if (memoryChunks.length > 0) {
    userMessages.push({ type: 'text', text: `Relevant Examples from Memory:\n${memoryChunks.map(m => `- ${m.text} (similarity: ${m.similarity.toFixed(2)})`).join('\n')}` });
  }
  userMessages.push({ type: 'text', text: 'Based on all the above, provide your suggestions.' });

  return {
    systemMessage,
    userMessages,
  };
}

async function callGptForSuggestions(
  prompt: GptPrompt,
  photoUrl: string // photoUrl might be needed if GPT-4o vision is used directly
): Promise<AiSuggestions> {
  console.log('STUB: callGptForSuggestions called with prompt for photo:', photoUrl, prompt);
  // In a real implementation, call OpenAI GPT-4o /chat/completions
  // For now, return a mock response based on the prompt or simple echo
  const mockTags = prompt.userMessages
    .find(msg => msg.text?.startsWith('Image Labels:'))?.text
    ?.replace('Image Labels: ', '').split(', ').slice(0,5) || ['mockTag1', 'mockTag2'];
  
  return {
    suggestedTags: mockTags.map(t => t.trim()).filter(t => t.length > 0),
    suggestedDescription: 'Mock CompanyCam-style description based on labels.',
    checklistTriggers: ['Check for safety harness (mock)'],
    debugInfo: { promptSent: prompt }
  };
}

// --- Main Handler Function ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('--- suggest-ai-tags.ts (TypeScript) function invoked ---');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request.');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    console.log(`Responding with 405 Method Not Allowed for method: ${req.method}`);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GOOGLE_CLOUD_VISION_API_KEY is not set.');
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  let requestBody: SuggestAiTagsRequestBody;
  try {
    // Vercel automatically parses the body for 'application/json'
    if (typeof req.body === 'object' && req.body !== null) {
      requestBody = req.body as SuggestAiTagsRequestBody;
    } else {
      // Fallback for environments where body might not be pre-parsed (e.g. local dev without Vercel CLI behavior)
      // Or if content-type was not application/json initially
      console.log('Request body not pre-parsed, attempting JSON.parse on raw body string.');
      requestBody = JSON.parse(req.body || '{}') as SuggestAiTagsRequestBody;
    }
    
    if (!requestBody.photoUrl) {
      throw new Error('Missing photoUrl in request body');
    }

  } catch (e: any) {
    console.error('ERROR parsing JSON body or missing photoUrl:', e.message);
    return res.status(400).json({ error: 'Invalid request body', details: e.message });
  }

  const { photoUrl, userId } = requestBody;
  console.log(`Image URL: ${photoUrl}, User ID: ${userId || 'Not provided'}`);

  // --- Modular AI Pipeline ---
  try {
    // 1. Get Google Vision labels (and other detections)
    const visionApiPayload = {
      requests: [
        {
          image: { source: { imageUri: photoUrl } },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 15 },
            { type: 'WEB_DETECTION', maxResults: 10 },
            // Consider adding { type: 'OBJECT_LOCALIZATION', maxResults: 5 } for more detail
            // Consider adding { type: 'TEXT_DETECTION' } if text in images is important
          ],
        },
      ],
    };

    const visionOptions = {
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
      timeout: 25000,
    };

    console.log('Attempting to call Google Vision API...');
    const visionApiResponse = await new Promise<GoogleVisionResponse>((resolve, reject) => {
      const httpsReq = https.request(visionOptions, (httpsRes) => {
        let data = '';
        console.log(`Google Vision API Response Status: ${httpsRes.statusCode}`);
        httpsRes.on('data', (chunk) => { data += chunk; });
        httpsRes.on('end', () => {
          try {
            if (httpsRes.statusCode && httpsRes.statusCode >= 200 && httpsRes.statusCode < 300) {
              const parsedData = JSON.parse(data);
              // The response is an array of responses, one for each image request.
              // We only send one image, so we take the first element.
              resolve(parsedData.responses && parsedData.responses[0] ? parsedData.responses[0] : {});
            } else {
              console.error('Google Vision API returned an error status:', httpsRes.statusCode, data);
              reject(new Error(`Google Vision API error: ${httpsRes.statusCode} - ${data}`));
            }
          } catch (parseError: any) {
            console.error('Error parsing Google Vision API response:', parseError.message, data);
            reject(new Error(`Error parsing Google Vision API response: ${parseError.message}`));
          }
        });
      });
      httpsReq.on('error', (err) => {
        console.error('Error during Google Vision API request:', err.message);
        reject(new Error(`Google Vision API request failed: ${err.message}`));
      });
      httpsReq.on('timeout', () => {
        httpsReq.destroy();
        console.error('Google Vision API request timed out.');
        reject(new Error('Google Vision API request timed out.'));
      });
      httpsReq.write(JSON.stringify(visionApiPayload));
      httpsReq.end();
    });

    if (visionApiResponse.error) {
      console.error('Google Vision API returned an error object:', visionApiResponse.error);
      throw new Error(`Vision API Error: ${visionApiResponse.error.message} (Code: ${visionApiResponse.error.code})`);
    }
    console.log('Google Vision API call successful.');
    // console.log('Vision API Full Response:', JSON.stringify(visionApiResponse, null, 2));

    // 2. Generate embedding from the label set (STUBBED)
    const embedding = await generateEmbeddings(
      visionApiResponse.labelAnnotations || [], 
      visionApiResponse.webDetection?.webEntities || []
    );

    // 3. Query global + user-specific vector memory (STUBBED)
    const memoryChunks = await queryVectorMemory(embedding, userId);

    // 4. Assemble system + dynamic prompt (STUBBED)
    const gptPrompt = await assembleGptPrompt(visionApiResponse, memoryChunks);

    // 5. Call GPT-4o for final tags/description (STUBBED)
    const finalSuggestions = await callGptForSuggestions(gptPrompt, photoUrl);
    
    console.log('Successfully generated AI suggestions (stubbed pipeline).');
    return res.status(200).json(finalSuggestions);

  } catch (error: any) {
    console.error('Error in AI suggestion pipeline:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to get AI suggestions', details: error.message });
  }
}
