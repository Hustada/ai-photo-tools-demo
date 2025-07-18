// © 2025 Mark Hustad — MIT License
// api/scout-ai.ts - Unified Scout AI endpoint for all agent interactions

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { kv } from '@vercel/kv';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Types
interface ScoutAiContext {
  userType: 'developer' | 'endUser' | 'unknown';
  confidence: number;
  sessionId?: string;
  userId?: string;
}

interface ScoutAiRequest {
  action: 'chat' | 'analyze' | 'feedback' | 'learn';
  context: ScoutAiContext;
  payload: any;
}

interface ChatPayload {
  query: string;
  conversationId?: string;
  projectId?: string;
  limit?: number;
}

interface AnalyzePayload {
  photos: Array<{ id: string; url: string }>;
  analysisType: 'similarity' | 'quality' | 'content';
  options?: Record<string, any>;
}

interface FeedbackPayload {
  itemId: string;
  itemType: 'suggestion' | 'tag' | 'description' | 'chat_response';
  feedback: 'positive' | 'negative' | 'edit';
  editedContent?: string;
  metadata?: Record<string, any>;
}

interface LearnPayload {
  sessionId: string;
  interactions: Array<{
    timestamp: string;
    type: string;
    data: any;
  }>;
}

// Type guards for payload validation
function isChatPayload(payload: any): payload is ChatPayload {
  return typeof payload?.query === 'string';
}

function isAnalyzePayload(payload: any): payload is AnalyzePayload {
  return Array.isArray(payload?.photos) && 
         typeof payload?.analysisType === 'string';
}

function isFeedbackPayload(payload: any): payload is FeedbackPayload {
  return typeof payload?.itemId === 'string' &&
         typeof payload?.itemType === 'string' &&
         typeof payload?.feedback === 'string';
}

function isLearnPayload(payload: any): payload is LearnPayload {
  return typeof payload?.sessionId === 'string' &&
         Array.isArray(payload?.interactions);
}

// Helper to get context-aware system prompt
function getContextAwarePrompt(context: ScoutAiContext): string {
  const basePrompt = `You are Scout AI, an intelligent assistant for CompanyCam.
  
  Core personality:
  - Competent and professional: Be clear, confident, and accurate
  - Efficient and to-the-point: Respect the user's time, no unnecessary fluff
  - Industry-aware: Understand construction workflows and goals`;
  
  switch (context.userType) {
    case 'developer':
      return `${basePrompt}
      
      Context: The user is a developer working on CompanyCam software. They're building and maintaining the platform that contractors rely on for project documentation.
      
      Tasks: They might be testing features, debugging issues, analyzing user workflows, or verifying data integrity. They need to understand how contractors use the system.
      
      Response style: Technical and concise. Reference implementation details, API behavior, or data structures when relevant.
      Example: "Found 12 photos with 'foundation' tag. Query executed in 142ms using Pinecone vector search. Photo metadata includes captured_at, project_id, and user tags."`;
      
    case 'endUser':
      return `${basePrompt}
      
      Context: The user is a contractor or construction professional using CompanyCam to manage their job sites. Their primary goal is to create a complete, accurate, and easily accessible visual record of their projects.
      
      Tasks: This involves documenting progress, creating reports for clients or insurance, collaborating with their team, and resolving potential disputes. While their main focus is on photos, they also work with tags, descriptions, and project timelines.
      
      Response style: Direct and helpful. Use light industry terminology. Focus on helping them manage their project documentation efficiently.
      Example: "Found 12 foundation photos from the Johnson project. The clearest shots are from Thursday's pour, which should be perfect for your progress report."`;
      
    default:
      return `${basePrompt}
      
      Context: The user's role is unclear. They could be a contractor, developer, or someone else exploring CompanyCam.
      
      Approach: Be helpful and adaptive. Start with general assistance, but pay attention to clues in their query that might indicate their role. If they mention technical terms, lean toward developer assistance. If they mention job sites or projects, lean toward contractor assistance.
      
      Response style: Clear and adaptable. Start neutral but adjust based on their needs.
      Example: "Found 12 foundation photos. Let me know if you need help with anything specific about these photos or your project documentation."`;
  }
}

// Store feedback for learning
async function storeFeedback(
  context: ScoutAiContext,
  feedback: FeedbackPayload
): Promise<void> {
  const key = `feedback:${context.userId || 'anonymous'}:${Date.now()}`;
  const data = {
    ...feedback,
    context,
    timestamp: new Date().toISOString(),
  };
  
  await kv.set(key, data, { ex: 30 * 24 * 60 * 60 }); // 30 days TTL
  
  // Update user preference scores
  if (context.userId) {
    const prefsKey = `user_prefs:${context.userId}`;
    const prefs = await kv.get<Record<string, any>>(prefsKey) || {};
    
    // Update preference based on feedback type
    if (feedback.itemType === 'suggestion') {
      prefs.suggestionAcceptance = prefs.suggestionAcceptance || {};
      prefs.suggestionAcceptance[feedback.itemId] = feedback.feedback;
    }
    
    await kv.set(prefsKey, prefs);
  }
}

// Track learning data
async function trackLearning(
  context: ScoutAiContext,
  payload: LearnPayload
): Promise<void> {
  const key = `learning:${payload.sessionId}`;
  const existingData = await kv.get<any>(key) || { interactions: [] };
  
  existingData.interactions.push(...payload.interactions);
  existingData.lastUpdated = new Date().toISOString();
  existingData.context = context;
  
  await kv.set(key, existingData, { ex: 7 * 24 * 60 * 60 }); // 7 days TTL
}

// Process chat request (delegating to existing chat functionality)
async function processChat(
  context: ScoutAiContext,
  payload: ChatPayload,
  res: VercelResponse
): Promise<void> {
  // For now, delegate to existing chat endpoint
  // In future, we'll move all chat logic here
  const chatModule = await import('./chat');
  const chatHandler = chatModule.default;
  
  // Create a modified request with context
  const modifiedReq = {
    body: {
      ...payload,
      context: {
        userType: context.userType,
        confidence: context.confidence,
      },
    },
    method: 'POST',
  } as VercelRequest;
  
  return chatHandler(modifiedReq, res);
}

// Process analysis request
async function processAnalysis(
  context: ScoutAiContext,
  payload: AnalyzePayload,
  res: VercelResponse
): Promise<void> {
  // Placeholder for photo analysis
  // This will integrate with visual similarity and other analysis features
  res.json({
    status: 'success',
    message: 'Analysis functionality coming soon',
    context,
    payload,
  });
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, context, payload }: ScoutAiRequest = req.body;

    if (!action || !context) {
      return res.status(400).json({ 
        error: 'Missing required fields: action and context' 
      });
    }

    // Log interaction for learning (fire and forget)
    if (context.sessionId || context.userId) {
      trackLearning(context, {
        sessionId: context.sessionId || `anon_${Date.now()}`,
        interactions: [{
          timestamp: new Date().toISOString(),
          type: action,
          data: { payload },
        }],
      }).catch(err => console.warn('[Scout AI] Failed to track learning:', err));
    }

    // Route to appropriate handler with type validation
    switch (action) {
      case 'chat':
        if (!isChatPayload(payload)) {
          return res.status(400).json({ 
            error: 'Invalid chat payload',
            details: 'Missing required field: query'
          });
        }
        return await processChat(context, payload, res);
        
      case 'analyze':
        if (!isAnalyzePayload(payload)) {
          return res.status(400).json({ 
            error: 'Invalid analyze payload',
            details: 'Missing required fields: photos or analysisType'
          });
        }
        return await processAnalysis(context, payload, res);
        
      case 'feedback':
        if (!isFeedbackPayload(payload)) {
          return res.status(400).json({ 
            error: 'Invalid feedback payload',
            details: 'Missing required fields: itemId, itemType, or feedback'
          });
        }
        await storeFeedback(context, payload);
        return res.json({ 
          status: 'success', 
          message: 'Feedback recorded' 
        });
        
      case 'learn':
        if (!isLearnPayload(payload)) {
          return res.status(400).json({ 
            error: 'Invalid learn payload',
            details: 'Missing required fields: sessionId or interactions'
          });
        }
        await trackLearning(context, payload);
        return res.json({ 
          status: 'success', 
          message: 'Learning data recorded' 
        });
        
      default:
        return res.status(400).json({ 
          error: `Unknown action: ${action}` 
        });
    }
  } catch (error) {
    console.error('[Scout AI] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}