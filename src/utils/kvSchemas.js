"use strict";
// © 2025 Mark Hustad — MIT License
// KV Schema definitions and helper functions for Scout AI learning system
Object.defineProperty(exports, "__esModule", { value: true });
exports.kvKeys = void 0;
exports.getEvolvingPrompt = getEvolvingPrompt;
exports.updateEvolvingPrompt = updateEvolvingPrompt;
exports.storeFeedbackAggregation = storeFeedbackAggregation;
exports.getFeedbackAggregations = getFeedbackAggregations;
exports.calculatePromptPerformance = calculatePromptPerformance;
exports.getUserPreferenceProfile = getUserPreferenceProfile;
exports.lockPrompt = lockPrompt;
exports.isPromptLocked = isPromptLocked;
exports.rollbackPrompt = rollbackPrompt;
exports.cleanupOldFeedback = cleanupOldFeedback;
const kv_1 = require("@vercel/kv");
// ===== KEY GENERATION HELPERS =====
exports.kvKeys = {
    // Prompt keys
    evolvingPrompt: (userType, userId) => userId ? `prompt:${userType}:${userId}` : `prompt:${userType}:global`,
    // Feedback aggregation keys
    feedbackAgg: (promptId, period, timestamp) => `feedback_agg:${promptId}:${period}:${timestamp}`,
    // User preference keys
    userPrefs: (userId) => `user_prefs:${userId}`,
    // Feedback item keys (already defined in scout-ai.ts, but included for completeness)
    feedback: (userId, timestamp) => `feedback:${userId || 'anonymous'}:${timestamp}`,
    // Learning session keys
    learning: (sessionId) => `learning:${sessionId}`,
};
// ===== CRUD OPERATIONS =====
/**
 * Get or create an evolving prompt
 */
async function getEvolvingPrompt(userType, userId, basePrompt) {
    const key = exports.kvKeys.evolvingPrompt(userType, userId);
    const existing = await kv_1.kv.get(key);
    if (existing) {
        return existing;
    }
    // Create new prompt if doesn't exist
    if (!basePrompt) {
        throw new Error('Base prompt required for new evolving prompt');
    }
    const newPrompt = {
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
    await kv_1.kv.set(key, newPrompt);
    return newPrompt;
}
/**
 * Update an evolving prompt with new version
 */
async function updateEvolvingPrompt(promptId, newPrompt, reason, performance) {
    const existing = await kv_1.kv.get(promptId);
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
    await kv_1.kv.set(promptId, existing);
    return existing;
}
/**
 * Store feedback aggregation data
 */
async function storeFeedbackAggregation(aggregation) {
    const key = exports.kvKeys.feedbackAgg(aggregation.promptId, aggregation.period, aggregation.startTime);
    // Store with TTL based on period
    const ttl = {
        hour: 7 * 24 * 60 * 60, // 7 days
        day: 30 * 24 * 60 * 60, // 30 days
        week: 90 * 24 * 60 * 60, // 90 days
        month: 365 * 24 * 60 * 60, // 1 year
    };
    await kv_1.kv.set(key, aggregation, { ex: ttl[aggregation.period] });
}
/**
 * Get feedback aggregations for a prompt
 * Note: For production scale, consider using sorted sets for efficient range queries
 */
async function getFeedbackAggregations(promptId, period, limit = 10) {
    // Get keys for the specified period
    const pattern = `feedback_agg:${promptId}:${period}:*`;
    const keys = await kv_1.kv.keys(pattern);
    // Sort keys by timestamp (newest first)
    const sortedKeys = keys
        .sort((a, b) => b.localeCompare(a))
        .slice(0, limit);
    // Fetch aggregations
    const aggregations = await Promise.all(sortedKeys.map(key => kv_1.kv.get(key)));
    return aggregations.filter((agg) => agg !== null);
}
/**
 * Calculate prompt performance from recent feedback
 */
async function calculatePromptPerformance(promptId, windowHours = 24) {
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
async function getUserPreferenceProfile(userId) {
    const key = exports.kvKeys.userPrefs(userId);
    const existing = await kv_1.kv.get(key);
    if (existing) {
        return existing;
    }
    // Create default profile
    const newProfile = {
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
    await kv_1.kv.set(key, newProfile);
    return newProfile;
}
/**
 * Lock a prompt temporarily (e.g., after poor performance)
 */
async function lockPrompt(promptId, hours = 24) {
    const prompt = await kv_1.kv.get(promptId);
    if (!prompt)
        return;
    const lockUntil = new Date();
    lockUntil.setHours(lockUntil.getHours() + hours);
    prompt.evolution.lockedUntil = lockUntil.toISOString();
    await kv_1.kv.set(promptId, prompt);
}
/**
 * Check if a prompt is locked
 */
async function isPromptLocked(promptId) {
    const prompt = await kv_1.kv.get(promptId);
    if (!prompt || !prompt.evolution.lockedUntil)
        return false;
    return new Date(prompt.evolution.lockedUntil) > new Date();
}
/**
 * Rollback a prompt to a previous version
 */
async function rollbackPrompt(promptId, targetVersion) {
    const prompt = await kv_1.kv.get(promptId);
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
    await kv_1.kv.set(promptId, prompt);
    return prompt;
}
/**
 * Clean up old feedback data
 */
async function cleanupOldFeedback(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const pattern = 'feedback:*';
    const keys = await kv_1.kv.keys(pattern);
    let deletedCount = 0;
    for (const key of keys) {
        const parts = key.split(':');
        const timestamp = parseInt(parts[parts.length - 1]);
        if (timestamp < cutoffDate.getTime()) {
            await kv_1.kv.del(key);
            deletedCount++;
        }
    }
    return deletedCount;
}
