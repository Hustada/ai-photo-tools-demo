// &#169; 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import OpenAI from 'openai';
import existingCompanyCamTagsFromFile from './companycam-standard-tags.json';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize OpenAI client
// Ensure OPENAI_API_KEY is set in your .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



// Define the structure for GPT prompt components
interface GptPrompt {
  systemMessage: string;
  userMessages: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>;
}

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
  photoUrl: string,
  visionResponse: GoogleVisionResponse | null,
  memoryChunks: MemoryChunk[],
  standardTags: string[]
): Promise<GptPrompt> {
  console.log(
    `Assembling GPT prompt. Vision labels: ${visionResponse?.labelAnnotations?.length || 0}, Web entities: ${visionResponse?.webDetection?.webEntities?.length || 0}, Memory chunks: ${memoryChunks.length}`
  );

  const systemMessage = `You are "CamIntellect," an advanced AI assistant deeply integrated within CompanyCam, the leading photo documentation platform for contractors in field-service industries. Your primary function is to act as an expert partner to users, helping them create rich, accurate, and highly useful photo documentation with minimal effort.

**Understanding CompanyCam: Your Foundation**
*   **Core Mission:** CompanyCam is the leading photo documentation platform designed to help contractors work more efficiently, communicate better, and protect their businesses by creating a transparent, visual record of their projects from start to finish.
*   **Key User Activities:** Users rely on CompanyCam for daily progress tracking, creating detailed photo reports, collaborating seamlessly between field and office teams, resolving potential disputes with clear visual evidence, and showcasing completed work. Photos are typically organized by project, can be annotated with comments, drawings, and voice notes, and are easily shareable.
*   **The Power of Tags:** Tags are a cornerstone of organization within CompanyCam. They enable powerful filtering, streamlined reporting, and are essential for integrating CompanyCam data with other business systems. Your suggested tags should aim to maximize this organizational power.
*   **Integration & Data Value:** CompanyCam is often a central hub for project visuals and data. It offers a robust API, facilitating connections with other critical business software. This underscores the importance of your suggestions in creating structured, accurate, and valuable data.

**Your Core Directives:**
1.  **Understand the User's World:** CompanyCam users are professionals in trades such as roofing, construction (all phases), plumbing, HVAC, electrical, restoration, home inspection, and property management. Your suggestions must reflect an understanding of their common tasks, materials, environments, and documentation needs.
2.  **Promote Clarity and Detail:** Generate descriptions and tags that are not just generic labels but add real value for project tracking, issue identification, client communication, and creating comprehensive project timelines.
3.  **Emphasize Actionable Insights:** Where possible, frame suggestions to highlight progress, identify potential issues, or note critical stages (e.g., "Pre-drywall inspection of living room," "Water damage observed on subfloor," "Final installation of HVAC unit complete").
4.  **CompanyCam Style:**
    *   **Descriptions:** Aim for clear, concise, and informative single sentences. Start with the subject or key activity if possible.
    *   **Tags:** Provide 3-7 highly relevant tags. Tags should be a mix of:
        *   **Object/Component:** (e.g., "roof vent," "sump pump," "concrete slab")
        *   **Activity/Phase:** (e.g., "demolition," "installation," "progress," "final inspection")
        *   **Issue/Condition:** (e.g., "leak," "crack," "corrosion," "safety hazard")
        *   **Location (if discernible and relevant):** (e.g., "kitchen," "attic," "exterior south wall")
5.  **Leverage Provided Context:** You will receive image labels, web entities, and sometimes relevant examples from past projects (memory chunks). Prioritize these as strong indicators, but also use your general knowledge of the trades. The image itself (via URL) is your primary source of truth.
6.  **Utilize Standard CompanyCam Tags:** You will be provided with a list of standard CompanyCam tags. When relevant, prioritize suggesting these tags to maintain consistency. However, if the image content strongly warrants a more specific or nuanced new tag not on the list, feel free to suggest it. The goal is comprehensive and accurate documentation.
7.  **Output Format:** Respond STRICTLY with a JSON object containing these keys:
    *   "suggested_tags": An array of strings.
    *   "suggested_description": A single string.
    *   "checklist_triggers": (Optional) An array of strings if specific, predefined checklist items are clearly identifiable or triggered by the photo's content. If none, omit this key or provide an empty array.

**Examples of Good CompanyCam Documentation (for your learning):**

*   **Scenario:** Photo of a newly installed window.
    *   **Ideal Description:** "Installation of new energy-efficient window in master bedroom complete."
    *   **Ideal Tags:** ["window", "installation", "master bedroom", "energy-efficient", "progress"]

*   **Scenario:** Photo showing a water stain on a ceiling.
    *   **Ideal Description:** "Water stain observed on ceiling in hallway, potential leak source above."
    *   **Ideal Tags:** ["water stain", "ceiling", "hallway", "leak", "issue", "damage assessment"]

*   **Scenario:** Photo of a team member wearing safety harness on a roof.
    *   **Ideal Description:** "Team member correctly utilizing fall protection safety harness on south roof slope."
    *   **Ideal Tags:** ["safety", "fall protection", "harness", "roofing", "compliance"]

Remember, your suggestions directly impact the quality of project records for thousands of contractors. Strive for excellence and relevance in every suggestion.`;

  const userMessageParts = [
    `Analyze the following image and its associated metadata to generate suggestions.`,
    `Image URL (for your reference if needed, but prioritize labels/entities/memories for text generation): ${photoUrl}`,
  ];

  if (standardTags && standardTags.length > 0) {
    userMessageParts.push(
      `Standard CompanyCam Tags (consider these for consistency; suggest new ones if more appropriate):\n${standardTags.map(tag => `- ${tag}`).join('\n')}`
    );
  }

  if (visionResponse) {
    userMessageParts.push(
      `Image Labels: ${visionResponse.labelAnnotations?.map((l) => l.description).join(', ') || 'None'}`,
      `Web Entities: ${visionResponse.webDetection?.webEntities?.map((e) => e.description).join(', ') || 'None'}`,
    );
  }

  if (memoryChunks.length > 0) {
    userMessageParts.push(
      `Relevant Examples from Past Projects (use these for context and style):\n${memoryChunks
        .map((m) => `- "${m.text}" (similarity: ${m.similarity.toFixed(2)})`)
        .join('\n')}`,
    );
  }

  userMessageParts.push(
    'Based on all the provided information (image, labels, web entities, past examples, and standard CompanyCam tags), generate your suggestions strictly in the specified JSON format.'
  );

  const userMessages: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }> = [
    {
      type: 'text',
      text: userMessageParts.join('\n'),
    },
  ];

  // If using a model like gpt-4o that can directly process image URLs in the prompt:
  // userMessages.unshift({ type: 'image_url', image_url: { url: photoUrl, detail: 'auto' } });

  return {
    systemMessage,
    userMessages,
  };
}

async function callGptForSuggestions(
  gptPrompt: GptPrompt,
  photoUrl: string // photoUrl might be used if sending image data directly or for logging
): Promise<AiSuggestions> {
  console.log('Attempting to call OpenAI GPT for suggestions. PhotoURL:', photoUrl);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key not configured.');
    throw new Error('OpenAI API key not configured.');
  }

  try {
    const modelForSuggestions = 'gpt-4o'; 

    console.log(`Calling OpenAI ${modelForSuggestions} with prompt:`, JSON.stringify(gptPrompt.userMessages, null, 2).substring(0, 500) + '...');

    const messagesForApi: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: gptPrompt.systemMessage },
    ];
    gptPrompt.userMessages.forEach((msg: { type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }) => {
      // Based on assembleGptPrompt, all user messages currently have type: 'text' and defined text.
      if (msg.text) { // Check if text is defined, though it should be.
        messagesForApi.push({ role: 'user', content: msg.text });
      }
    });

    const completion = await openai.chat.completions.create({
      model: modelForSuggestions,
      messages: messagesForApi,
      temperature: 0.3, 
      max_tokens: 500,  
      response_format: { type: 'json_object' }, 
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      console.error('OpenAI response content is null or undefined.');
      throw new Error('No content in OpenAI response.');
    }

    console.log('Raw GPT JSON response:', content);

    let parsedGptJson: {
        suggested_tags?: string[];
        suggested_description?: string;
        checklist_triggers?: string[];
        [key: string]: any; // Allow other properties if GPT adds more
    };
    try {
      parsedGptJson = JSON.parse(content);
    } catch (parseError: any) {
      console.error('Failed to parse JSON response from GPT:', parseError);
      console.error('GPT Raw Content that failed parsing:', content);
      throw new Error('Failed to parse JSON response from GPT.');
    }
    
    const finalSuggestions: AiSuggestions = {
      suggestedTags: parsedGptJson.suggested_tags || [],
      suggestedDescription: parsedGptJson.suggested_description || 'No description generated.',
      checklistTriggers: parsedGptJson.checklist_triggers || [],
      debugInfo: {
        gptModel: modelForSuggestions,
        rawGptResponse: content, 
        promptMessages: gptPrompt.userMessages.map((msg: { type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }) => msg.text || ''),
      },
    };

    console.log('Successfully parsed suggestions from GPT:', finalSuggestions);
    return finalSuggestions;

  } catch (error: any) {
    let errorMessage = 'Error calling OpenAI Chat Completions API.';
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    console.error(errorMessage, error.stack);
     return {
      suggestedTags: [],
      suggestedDescription: 'Error generating AI suggestions.',
      checklistTriggers: [],
      debugInfo: { error: errorMessage, rawError: error },
    };
  }
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
    const { systemMessage, userMessages } = await assembleGptPrompt(
      photoUrl,
      visionApiResponse,
      memoryChunks,
      existingCompanyCamTagsFromFile // Use the statically imported tags
    );

    // 5. Call GPT-4o for final tags/description (STUBBED)
    const finalSuggestions = await callGptForSuggestions({ systemMessage, userMessages }, photoUrl);
    
    console.log('Successfully generated AI suggestions.');
    return res.status(200).json(finalSuggestions);

  } catch (error: any) {
    console.error('Error in AI suggestion pipeline:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to get AI suggestions', details: error.message });
  }
}
