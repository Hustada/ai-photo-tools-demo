// © 2025 Mark Hustad — MIT License
// Feedback aggregation system for Scout AI learning

import { kv } from '@vercel/kv';
import { 
  FeedbackAggregation, 
  FeedbackMetrics, 
  EditPattern,
  kvKeys,
  storeFeedbackAggregation,
  getFeedbackAggregations,
  calculatePromptPerformance,
  getUserPreferenceProfile
} from './kvSchemas';

interface RawFeedback {
  itemId: string;
  itemType: 'suggestion' | 'tag' | 'description' | 'chat_response';
  feedback: 'positive' | 'negative' | 'edit';
  editedContent?: string;
  metadata?: {
    photoId?: string;
    tagValue?: string;
    originalSuggestion?: string;
    projectId?: string;
    timestamp?: string;
  };
  context: {
    userType: 'developer' | 'endUser' | 'unknown';
    confidence: number;
    sessionId?: string;
    userId?: string;
  };
  timestamp: string;
}

/**
 * Aggregate feedback data for a specific time period
 */
export async function aggregateFeedback(
  promptId: string,
  period: 'hour' | 'day' | 'week' | 'month',
  startTime: Date
): Promise<FeedbackAggregation> {
  const endTime = getEndTime(startTime, period);
  
  // Fetch raw feedback for this period
  const rawFeedback = await fetchRawFeedback(promptId, startTime, endTime);
  
  // Calculate metrics
  const metrics = calculateMetrics(rawFeedback);
  
  // Identify edit patterns
  const patterns = identifyEditPatterns(rawFeedback);
  
  const aggregation: FeedbackAggregation = {
    promptId,
    period,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    metrics: {
      ...metrics,
      patterns,
    },
  };
  
  // Store aggregation
  await storeFeedbackAggregation(aggregation);
  
  return aggregation;
}

/**
 * Run aggregation for all active prompts
 */
export async function runAggregationCycle(
  period: 'hour' | 'day' | 'week' | 'month' = 'hour'
): Promise<number> {
  const promptPattern = 'prompt:*';
  const promptKeys = await kv.keys(promptPattern);
  
  let aggregationCount = 0;
  const startTime = getStartTimeForPeriod(period);
  
  for (const promptKey of promptKeys) {
    try {
      await aggregateFeedback(promptKey, period, startTime);
      aggregationCount++;
    } catch (error) {
      console.error(`[FeedbackAggregator] Error aggregating ${promptKey}:`, error);
    }
  }
  
  return aggregationCount;
}

/**
 * Fetch raw feedback for a time period
 */
async function fetchRawFeedback(
  promptId: string,
  startTime: Date,
  endTime: Date
): Promise<RawFeedback[]> {
  // Extract user type from promptId (format: prompt:{userType}:{userId?})
  const [, userType, userId] = promptId.split(':');
  
  // Fetch feedback keys for this time range
  // Note: In production, use sorted sets for efficient range queries
  const pattern = `feedback:${userId || '*'}:*`;
  const feedbackKeys = await kv.keys(pattern);
  
  const feedback: RawFeedback[] = [];
  
  for (const key of feedbackKeys) {
    const parts = key.split(':');
    const timestamp = parseInt(parts[parts.length - 1]);
    
    if (timestamp >= startTime.getTime() && timestamp <= endTime.getTime()) {
      const data = await kv.get<RawFeedback>(key);
      
      // Filter for relevant feedback based on context
      if (data && 
          data.context.userType === userType &&
          (!userId || data.context.userId === userId)) {
        feedback.push(data);
      }
    }
  }
  
  return feedback;
}

/**
 * Calculate basic metrics from raw feedback
 */
function calculateMetrics(feedback: RawFeedback[]): Omit<FeedbackMetrics, 'patterns'> {
  let positive = 0;
  let negative = 0;
  let edits = 0;
  
  for (const item of feedback) {
    switch (item.feedback) {
      case 'positive':
        positive++;
        break;
      case 'negative':
        negative++;
        break;
      case 'edit':
        edits++;
        break;
    }
  }
  
  return {
    positive,
    negative,
    edits,
    totalInteractions: feedback.length,
  };
}

/**
 * Identify common edit patterns using basic text analysis
 */
function identifyEditPatterns(feedback: RawFeedback[]): EditPattern[] {
  const editFeedback = feedback.filter(f => f.feedback === 'edit' && f.editedContent);
  const patternMap = new Map<string, EditPattern>();
  
  for (const item of editFeedback) {
    if (!item.editedContent || !item.metadata?.originalSuggestion) continue;
    
    const patterns = analyzeEdit(
      item.metadata.originalSuggestion,
      item.editedContent
    );
    
    for (const pattern of patterns) {
      const existing = patternMap.get(pattern);
      if (existing) {
        existing.frequency++;
        existing.examples.push(item.editedContent);
        // Keep only 3 examples
        if (existing.examples.length > 3) {
          existing.examples = existing.examples.slice(-3);
        }
      } else {
        patternMap.set(pattern, {
          pattern,
          frequency: 1,
          examples: [item.editedContent],
        });
      }
    }
  }
  
  // Sort by frequency and return top patterns
  return Array.from(patternMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * Analyze an edit to identify patterns
 */
function analyzeEdit(original: string, edited: string): string[] {
  const patterns: string[] = [];
  
  // Length analysis
  if (edited.length < original.length * 0.7) {
    patterns.push('shortened response');
  } else if (edited.length > original.length * 1.3) {
    patterns.push('expanded response');
  }
  
  // Word analysis
  const originalWords = original.toLowerCase().split(/\s+/);
  const editedWords = edited.toLowerCase().split(/\s+/);
  
  // Check for removed technical jargon
  const technicalTerms = ['api', 'endpoint', 'implementation', 'function', 'method', 'interface'];
  const removedTechnical = technicalTerms.filter(term => 
    originalWords.includes(term) && !editedWords.includes(term)
  );
  if (removedTechnical.length > 0) {
    patterns.push('removed technical jargon');
  }
  
  // Check for added context
  const contextWords = ['specifically', 'for example', 'such as', 'including'];
  const addedContext = contextWords.filter(term => 
    !originalWords.includes(term) && editedWords.includes(term)
  );
  if (addedContext.length > 0) {
    patterns.push('added specific examples');
  }
  
  // Check for tone changes
  const casualWords = ['hey', 'yeah', 'stuff', 'things', 'got'];
  const formalWords = ['greetings', 'indeed', 'items', 'elements', 'obtained'];
  
  const addedCasual = casualWords.filter(word => 
    !originalWords.includes(word) && editedWords.includes(word)
  );
  const addedFormal = formalWords.filter(word => 
    !originalWords.includes(word) && editedWords.includes(word)
  );
  
  if (addedCasual.length > addedFormal.length) {
    patterns.push('made more conversational');
  } else if (addedFormal.length > addedCasual.length) {
    patterns.push('made more formal');
  }
  
  return patterns;
}

/**
 * Update user preferences based on their feedback patterns
 */
export async function updateUserPreferences(
  userId: string,
  recentFeedback: RawFeedback[]
): Promise<void> {
  const profile = await getUserPreferenceProfile(userId);
  
  // Count feedback types
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const feedback of recentFeedback) {
    if (feedback.feedback === 'positive') positiveCount++;
    if (feedback.feedback === 'negative') negativeCount++;
  }
  
  // Update positive ratio
  const totalFeedback = positiveCount + negativeCount;
  if (totalFeedback > 0) {
    profile.learningHistory.positiveRatio = positiveCount / totalFeedback;
  }
  
  // Analyze edits for preference patterns
  const edits = recentFeedback.filter(f => f.feedback === 'edit' && f.editedContent);
  
  for (const edit of edits) {
    if (!edit.metadata?.originalSuggestion || !edit.editedContent) continue;
    
    const patterns = analyzeEdit(edit.metadata.originalSuggestion, edit.editedContent);
    
    // Update style preferences based on patterns
    if (patterns.includes('removed technical jargon')) {
      profile.preferences.responseStyle = 'conversational';
    }
    if (patterns.includes('made more formal')) {
      profile.preferences.responseStyle = 'technical';
    }
    if (patterns.includes('shortened response')) {
      profile.preferences.detailLevel = 'concise';
    }
    if (patterns.includes('expanded response')) {
      profile.preferences.detailLevel = 'detailed';
    }
  }
  
  profile.learningHistory.totalFeedback += recentFeedback.length;
  profile.learningHistory.lastUpdated = new Date().toISOString();
  
  await kv.set(kvKeys.userPrefs(userId), profile);
}

/**
 * Get the end time for a period
 */
function getEndTime(startTime: Date, period: 'hour' | 'day' | 'week' | 'month'): Date {
  const endTime = new Date(startTime);
  
  switch (period) {
    case 'hour':
      endTime.setHours(endTime.getHours() + 1);
      break;
    case 'day':
      endTime.setDate(endTime.getDate() + 1);
      break;
    case 'week':
      endTime.setDate(endTime.getDate() + 7);
      break;
    case 'month':
      endTime.setMonth(endTime.getMonth() + 1);
      break;
  }
  
  return endTime;
}

/**
 * Get the start time for the current period
 */
function getStartTimeForPeriod(period: 'hour' | 'day' | 'week' | 'month'): Date {
  const now = new Date();
  
  switch (period) {
    case 'hour':
      now.setMinutes(0, 0, 0);
      break;
    case 'day':
      now.setHours(0, 0, 0, 0);
      break;
    case 'week':
      now.setDate(now.getDate() - now.getDay());
      now.setHours(0, 0, 0, 0);
      break;
    case 'month':
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      break;
  }
  
  return now;
}

/**
 * Generate a performance report for a prompt
 */
export async function generatePerformanceReport(
  promptId: string,
  periods: { hours?: number; days?: number; weeks?: number }
): Promise<{
  current: any;
  trends: any;
  recommendations: string[];
}> {
  // Get current performance
  const currentPerf = await calculatePromptPerformance(promptId, periods.hours || 24);
  
  // Get historical aggregations
  const hourlyAggs = periods.hours ? 
    await getFeedbackAggregations(promptId, 'hour', periods.hours) : [];
  const dailyAggs = periods.days ? 
    await getFeedbackAggregations(promptId, 'day', periods.days) : [];
  const weeklyAggs = periods.weeks ? 
    await getFeedbackAggregations(promptId, 'week', periods.weeks) : [];
  
  // Calculate trends
  const trends = {
    successRateTrend: calculateTrend(hourlyAggs.map(a => 
      a.metrics.positive / (a.metrics.positive + a.metrics.negative)
    )),
    editRateTrend: calculateTrend(hourlyAggs.map(a => 
      a.metrics.edits / a.metrics.totalInteractions
    )),
    volumeTrend: calculateTrend(hourlyAggs.map(a => a.metrics.totalInteractions)),
  };
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (currentPerf.successRate < 0.6) {
    recommendations.push('Consider reviewing negative feedback patterns');
  }
  if (currentPerf.editRate > 0.3) {
    recommendations.push('High edit rate detected - analyze common edit patterns');
  }
  if (trends.successRateTrend === 'declining') {
    recommendations.push('Success rate declining - consider prompt adjustment');
  }
  
  return {
    current: currentPerf,
    trends,
    recommendations,
  };
}

/**
 * Calculate trend direction
 */
function calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  if (avgSecond > avgFirst * 1.1) return 'improving';
  if (avgSecond < avgFirst * 0.9) return 'declining';
  return 'stable';
}