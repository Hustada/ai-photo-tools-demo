// © 2025 Mark Hustad — MIT License
// KV Schema definitions and helper functions for Scout AI learning system

import { kv } from '@vercel/kv';

// ===== TYPE DEFINITIONS =====

/**
 * Represents an evolving prompt that learns from user feedback
 */
export interface EvolvingPrompt {
  id: string;                    // Format: prompt:{userType}:{userId?}
  basePrompt: string;            // Original safe prompt (immutable)
  currentPrompt: string;         // Active evolved prompt
  version: number;               // Increments on each evolution
  performance: PromptPerformance;
  evolution: EvolutionMetadata;
  history: PromptHistory[];
}

export interface PromptPerformance {
  successRate: number;          // 0-1, based on positive feedback ratio
  editRate: number;             // 0-1, how often users edit responses
  totalInteractions: number;    // Total uses of this prompt
  lastCalculated: string;       // ISO timestamp
}

export interface EvolutionMetadata {
  lastUpdated: string;          // ISO timestamp
  lockedUntil?: string;         // ISO timestamp - temporary lock after poor performance
  boundaries: string[];         // Safety constraints that must be maintained
  evolutionCount: number;       // Total number of evolutions
}

export interface PromptHistory {
  version: number;
  prompt: string;
  performance: PromptPerformance;
  timestamp: string;            // ISO timestamp
  reason: string;               // Why this evolution occurred
}

/**
 * Aggregated feedback data for analysis
 */
export interface FeedbackAggregation {
  promptId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startTime: string;            // ISO timestamp
  endTime: string;              // ISO timestamp
  metrics: FeedbackMetrics;
}

export interface FeedbackMetrics {
  positive: number;
  negative: number;
  edits: number;
  totalInteractions: number;
  patterns: EditPattern[];      // Common edit patterns
  averageResponseTime?: number; // If we track this
}

export interface EditPattern {
  pattern: string;              // e.g., "removed technical jargon"
  frequency: number;
  examples: string[];           // Sample edits demonstrating this pattern
}

/**
 * User preference profile built from feedback
 */
export interface UserPreferenceProfile {
  userId: string;
  preferences: {
    responseStyle: 'technical' | 'conversational' | 'balanced';
    detailLevel: 'concise' | 'detailed' | 'comprehensive';
    terminology: string[];      // Preferred terms they use
    avoidedPhrases: string[];   // Phrases they consistently edit out
  };
  learningHistory: {
    totalFeedback: number;
    positiveRatio: number;
    lastUpdated: string;
  };
}

// ===== KEY GENERATION HELPERS =====

export const kvKeys = {
  // Prompt keys
  evolvingPrompt: (userType: string, userId?: string) => 
    userId ? `prompt:${userType}:${userId}` : `prompt:${userType}:global`,
  
  // Feedback aggregation keys
  feedbackAgg: (promptId: string, period: string, timestamp: string) => 
    `feedback_agg:${promptId}:${period}:${timestamp}`,
  
  // User preference keys
  userPrefs: (userId: string) => `user_prefs:${userId}`,
  
  // Feedback item keys (already defined in scout-ai.ts, but included for completeness)
  feedback: (userId: string, timestamp: number) => 
    `feedback:${userId || 'anonymous'}:${timestamp}`,
  
  // Learning session keys
  learning: (sessionId: string) => `learning:${sessionId}`,
};

// ===== CRUD OPERATIONS =====

/**
 * Get or create an evolving prompt
 */
export async function getEvolvingPrompt(
  userType: string, 
  userId?: string,
  basePrompt?: string
): Promise<EvolvingPrompt> {
  const key = kvKeys.evolvingPrompt(userType, userId);
  const existing = await kv.get<EvolvingPrompt>(key);
  
  if (existing) {
    return existing;
  }
  
  // Create new prompt if doesn't exist
  if (!basePrompt) {
    throw new Error('Base prompt required for new evolving prompt');
  }
  
  const newPrompt: EvolvingPrompt = {
    id: key,
    basePrompt,
    currentPrompt: basePrompt,
    version: 1,
    performance: {
      successRate: 0.5, // Start neutral
      editRate: 0,
      totalInteractions: 0,
      lastCalculated: new Date().toISOString(),
    },
    evolution: {
      lastUpdated: new Date().toISOString(),
      boundaries: [
        'Maintain professional tone',
        'Include core personality traits',
        'Keep response style appropriate for user type',
      ],
      evolutionCount: 0,
    },
    history: [],
  };
  
  await kv.set(key, newPrompt);
  return newPrompt;
}

/**
 * Update an evolving prompt with new version
 */
export async function updateEvolvingPrompt(
  promptId: string,
  newPrompt: string,
  reason: string,
  performance: PromptPerformance
): Promise<EvolvingPrompt> {
  const existing = await kv.get<EvolvingPrompt>(promptId);
  if (!existing) {
    throw new Error(`Prompt not found: ${promptId}`);
  }
  
  // Add current version to history
  existing.history.push({
    version: existing.version,
    prompt: existing.currentPrompt,
    performance: existing.performance,
    timestamp: new Date().toISOString(),
    reason,
  });
  
  // Update prompt
  existing.currentPrompt = newPrompt;
  existing.version += 1;
  existing.performance = performance;
  existing.evolution.lastUpdated = new Date().toISOString();
  existing.evolution.evolutionCount += 1;
  
  // Keep history limited to last 10 versions
  if (existing.history.length > 10) {
    existing.history = existing.history.slice(-10);
  }
  
  await kv.set(promptId, existing);
  return existing;
}

/**
 * Store feedback aggregation data
 */
export async function storeFeedbackAggregation(
  aggregation: FeedbackAggregation
): Promise<void> {
  const key = kvKeys.feedbackAgg(
    aggregation.promptId,
    aggregation.period,
    aggregation.startTime
  );
  
  // Store with TTL based on period
  const ttl = {
    hour: 7 * 24 * 60 * 60,      // 7 days
    day: 30 * 24 * 60 * 60,      // 30 days
    week: 90 * 24 * 60 * 60,     // 90 days
    month: 365 * 24 * 60 * 60,   // 1 year
  };
  
  await kv.set(key, aggregation, { ex: ttl[aggregation.period] });
}

/**
 * Get feedback aggregations for a prompt
 * Note: For production scale, consider using sorted sets for efficient range queries
 */
export async function getFeedbackAggregations(
  promptId: string,
  period: 'hour' | 'day' | 'week' | 'month',
  limit: number = 10
): Promise<FeedbackAggregation[]> {
  // Get keys for the specified period
  const pattern = `feedback_agg:${promptId}:${period}:*`;
  const keys = await kv.keys(pattern);
  
  // Sort keys by timestamp (newest first)
  const sortedKeys = keys
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);
  
  // Fetch aggregations
  const aggregations = await Promise.all(
    sortedKeys.map(key => kv.get<FeedbackAggregation>(key))
  );
  
  return aggregations.filter((agg): agg is FeedbackAggregation => agg !== null);
}

/**
 * Calculate prompt performance from recent feedback
 */
export async function calculatePromptPerformance(
  promptId: string,
  windowHours: number = 24
): Promise<PromptPerformance> {
  const aggregations = await getFeedbackAggregations(promptId, 'hour', windowHours);
  
  let totalPositive = 0;
  let totalNegative = 0;
  let totalEdits = 0;
  let totalInteractions = 0;
  
  for (const agg of aggregations) {
    totalPositive += agg.metrics.positive;
    totalNegative += agg.metrics.negative;
    totalEdits += agg.metrics.edits;
    totalInteractions += agg.metrics.totalInteractions;
  }
  
  const totalFeedback = totalPositive + totalNegative;
  
  return {
    successRate: totalFeedback > 0 ? totalPositive / totalFeedback : 0.5,
    editRate: totalInteractions > 0 ? totalEdits / totalInteractions : 0,
    totalInteractions,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Get or create user preference profile
 */
export async function getUserPreferenceProfile(
  userId: string
): Promise<UserPreferenceProfile> {
  const key = kvKeys.userPrefs(userId);
  const existing = await kv.get<UserPreferenceProfile>(key);
  
  if (existing) {
    return existing;
  }
  
  // Create default profile
  const newProfile: UserPreferenceProfile = {
    userId,
    preferences: {
      responseStyle: 'balanced',
      detailLevel: 'concise',
      terminology: [],
      avoidedPhrases: [],
    },
    learningHistory: {
      totalFeedback: 0,
      positiveRatio: 0.5,
      lastUpdated: new Date().toISOString(),
    },
  };
  
  await kv.set(key, newProfile);
  return newProfile;
}

/**
 * Lock a prompt temporarily (e.g., after poor performance)
 */
export async function lockPrompt(
  promptId: string,
  hours: number = 24
): Promise<void> {
  const prompt = await kv.get<EvolvingPrompt>(promptId);
  if (!prompt) return;
  
  const lockUntil = new Date();
  lockUntil.setHours(lockUntil.getHours() + hours);
  
  prompt.evolution.lockedUntil = lockUntil.toISOString();
  await kv.set(promptId, prompt);
}

/**
 * Check if a prompt is locked
 */
export async function isPromptLocked(promptId: string): Promise<boolean> {
  const prompt = await kv.get<EvolvingPrompt>(promptId);
  if (!prompt || !prompt.evolution.lockedUntil) return false;
  
  return new Date(prompt.evolution.lockedUntil) > new Date();
}

/**
 * Rollback a prompt to a previous version
 */
export async function rollbackPrompt(
  promptId: string,
  targetVersion: number
): Promise<EvolvingPrompt> {
  const prompt = await kv.get<EvolvingPrompt>(promptId);
  if (!prompt) {
    throw new Error(`Prompt not found: ${promptId}`);
  }
  
  const historicalVersion = prompt.history.find(h => h.version === targetVersion);
  if (!historicalVersion) {
    throw new Error(`Version ${targetVersion} not found in history`);
  }
  
  // Create a rollback entry in history
  prompt.history.push({
    version: prompt.version,
    prompt: prompt.currentPrompt,
    performance: prompt.performance,
    timestamp: new Date().toISOString(),
    reason: `Rolled back to version ${targetVersion}`,
  });
  
  // Restore the historical version
  prompt.currentPrompt = historicalVersion.prompt;
  prompt.version += 1;
  prompt.evolution.lastUpdated = new Date().toISOString();
  
  await kv.set(promptId, prompt);
  return prompt;
}

/**
 * Clean up old feedback data
 */
export async function cleanupOldFeedback(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const pattern = 'feedback:*';
  const keys = await kv.keys(pattern);
  
  let deletedCount = 0;
  for (const key of keys) {
    const parts = key.split(':');
    const timestamp = parseInt(parts[parts.length - 1]);
    
    if (timestamp < cutoffDate.getTime()) {
      await kv.del(key);
      deletedCount++;
    }
  }
  
  return deletedCount;
}