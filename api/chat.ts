// © 2025 Mark Hustad — MIT License
// api/chat.ts - Chat-over-project API with streaming responses

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { kv } from '@vercel/kv';
import { getPineconeIndex, generateEmbedding } from '../src/utils/pinecone';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
interface ChatRequest {
  query: string;
  conversationId?: string;
  projectId?: string;
  limit?: number;
}

interface SearchCriteria {
  keywords?: string[];
  dateRange?: { start: string; end: string };
  tags?: string[];
  creatorNames?: string[];
  projectNames?: string[];
}

interface ChatResponse {
  conversationId: string;
  type: 'thinking' | 'extracting' | 'searching' | 'photos' | 'summary' | 'error';
  content: string | any[] | SearchCriteria;
  metadata?: {
    totalFound?: number;
    searchCriteria?: SearchCriteria;
    processingTime?: number;
  };
}

interface ConversationContext {
  id: string;
  previousCriteria?: SearchCriteria;
  previousResults?: string[];
  createdAt: string;
  updatedAt: string;
}

// Helper to generate conversation ID
function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Send SSE event
function sendEvent(res: VercelResponse, data: ChatResponse): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Extract search criteria using GPT-4o
async function extractSearchCriteria(query: string): Promise<SearchCriteria> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  const EXTRACTION_PROMPT = `Based on the user's query, extract search criteria and format as JSON matching this schema:
{
  "keywords": ["string"],
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "tags": ["string"],
  "creatorNames": ["string"],
  "projectNames": ["string"]
}

Rules:
- If a criterion is not mentioned, omit the key
- For relative dates like 'March' or 'last month', convert to absolute date ranges based on current date: ${currentDate}
- For 'March' without a year, assume current year
- Extract meaningful keywords from descriptions (e.g., "cracked foundation" → ["cracked", "foundation"])
- Look for tag-like terms that might be used in construction (e.g., "roofing", "plumbing", "electrical")`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: query }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more consistent extraction
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('[Chat API] Error extracting criteria:', error);
    throw new Error('Failed to parse search query');
  }
}

// Get or create conversation context
async function getOrCreateConversation(conversationId?: string): Promise<ConversationContext> {
  if (conversationId) {
    try {
      const context = await kv.get<ConversationContext>(`conversation:${conversationId}`);
      if (context) return context;
    } catch (error) {
      console.warn('[Chat API] Failed to retrieve conversation:', error);
    }
  }

  // Create new conversation
  const newContext: ConversationContext = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store with 1 hour TTL
  await kv.set(`conversation:${newContext.id}`, newContext, { ex: 3600 });
  return newContext;
}

// Merge current criteria with previous context
function mergeWithPreviousContext(
  currentCriteria: SearchCriteria,
  context: ConversationContext
): SearchCriteria {
  const prev = context.previousCriteria || {};
  
  return {
    keywords: [...new Set([...(prev.keywords || []), ...(currentCriteria.keywords || [])])],
    dateRange: currentCriteria.dateRange || prev.dateRange,
    tags: [...new Set([...(prev.tags || []), ...(currentCriteria.tags || [])])],
    creatorNames: currentCriteria.creatorNames?.length ? currentCriteria.creatorNames : prev.creatorNames,
    projectNames: currentCriteria.projectNames?.length ? currentCriteria.projectNames : prev.projectNames,
  };
}


// Perform hybrid search in Pinecone
async function performHybridSearch(
  query: string,
  criteria: SearchCriteria,
  limit: number = 20
): Promise<any[]> {
  const index = getPineconeIndex();

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build metadata filter
  const filter: any = {};

  if (criteria.dateRange) {
    const startTimestamp = new Date(criteria.dateRange.start).getTime() / 1000;
    const endTimestamp = new Date(criteria.dateRange.end).getTime() / 1000;
    filter.captured_at = {
      '$gte': startTimestamp,
      '$lte': endTimestamp,
    };
  }

  if (criteria.tags && criteria.tags.length > 0) {
    filter.tags = { '$in': criteria.tags };
  }

  if (criteria.creatorNames && criteria.creatorNames.length > 0) {
    filter.creator_name = { '$in': criteria.creatorNames };
  }

  if (criteria.projectNames && criteria.projectNames.length > 0) {
    filter.project_name = { '$in': criteria.projectNames };
  }

  try {
    // Query Pinecone with vector and metadata filters
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      ...(Object.keys(filter).length > 0 && { filter }),
    });

    return queryResponse.matches || [];
  } catch (error) {
    console.error('[Chat API] Pinecone query error:', error);
    // Fallback to empty results if Pinecone fails
    return [];
  }
}

// Update conversation context
async function updateConversationContext(
  conversationId: string,
  criteria: SearchCriteria,
  photoIds: string[]
): Promise<void> {
  const context = await kv.get<ConversationContext>(`conversation:${conversationId}`);
  if (context) {
    context.previousCriteria = criteria;
    context.previousResults = photoIds;
    context.updatedAt = new Date().toISOString();
    await kv.set(`conversation:${conversationId}`, context, { ex: 3600 });
  }
}

// Generate summary of results
async function generateSummary(
  query: string,
  photos: any[],
  criteria: SearchCriteria
): Promise<string> {
  if (photos.length === 0) {
    return "No photos found matching your search criteria.";
  }

  const summaryPrompt = `Summarize these search results for the user's query: "${query}"

Found ${photos.length} photos matching the criteria:
- Keywords: ${criteria.keywords?.join(', ') || 'none'}
- Date range: ${criteria.dateRange ? `${criteria.dateRange.start} to ${criteria.dateRange.end}` : 'any time'}
- Tags: ${criteria.tags?.join(', ') || 'none'}

Provide a brief, helpful summary of what was found.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: summaryPrompt },
        { role: "user", content: `Found ${photos.length} photos` }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content || `Found ${photos.length} photos matching your search.`;
  } catch (error) {
    return `Found ${photos.length} photos matching your search criteria.`;
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  try {
    const { query, conversationId, projectId, limit = 20 }: ChatRequest = req.body;

    if (!query || typeof query !== 'string') {
      sendEvent(res, {
        conversationId: conversationId || 'error',
        type: 'error',
        content: 'Invalid query provided',
      });
      return res.end();
    }

    // Step 1: Get/create conversation
    const conversation = await getOrCreateConversation(conversationId);
    sendEvent(res, {
      conversationId: conversation.id,
      type: 'thinking',
      content: 'Understanding your request...',
    });

    // Step 2: Extract search criteria
    sendEvent(res, {
      conversationId: conversation.id,
      type: 'extracting',
      content: 'Analyzing search criteria...',
    });

    const criteria = await extractSearchCriteria(query);
    const mergedCriteria = mergeWithPreviousContext(criteria, conversation);

    // Add project filter if specified
    if (projectId) {
      mergedCriteria.projectNames = [projectId];
    }

    // Step 3: Perform hybrid search
    sendEvent(res, {
      conversationId: conversation.id,
      type: 'searching',
      content: 'Searching photos...',
      metadata: { searchCriteria: mergedCriteria },
    });

    const searchResults = await performHybridSearch(query, mergedCriteria, limit);
    
    // Transform results to photo-like objects
    const photos = searchResults.map(result => ({
      id: result.id,
      score: result.score,
      ...result.metadata,
    }));

    // Step 4: Generate summary
    const summary = await generateSummary(query, photos, mergedCriteria);

    // Send results
    sendEvent(res, {
      conversationId: conversation.id,
      type: 'photos',
      content: photos,
      metadata: {
        totalFound: photos.length,
        searchCriteria: mergedCriteria,
      },
    });

    sendEvent(res, {
      conversationId: conversation.id,
      type: 'summary',
      content: summary,
    });

    // Update conversation context
    await updateConversationContext(
      conversation.id,
      mergedCriteria,
      photos.map(p => p.id)
    );

  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    sendEvent(res, {
      conversationId: conversationId || 'error',
      type: 'error',
      content: error.message || 'An unexpected error occurred',
    });
  } finally {
    res.end();
  }
}