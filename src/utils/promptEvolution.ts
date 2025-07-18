// © 2025 Mark Hustad — MIT License
// Prompt Evolution Engine - The self-improving AI system

import OpenAI from 'openai';
import { kv } from '@vercel/kv';
import {
  EvolvingPrompt,
  FeedbackMetrics,
  kvKeys,
  getEvolvingPrompt,
  getFeedbackAggregations,
  isPromptLocked,
  calculatePromptPerformance,
} from './kvSchemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PerformanceSummary {
  promptId: string;
  successRate: number;
  editRate: number;
  totalInteractions: number;
  topPatterns: Array<{
    pattern: string;
    frequency: number;
  }>;
  recommendation: 'evolve' | 'maintain' | 'review';
}

interface MutationProposal {
  promptId: string;
  originalVersion: number;
  newVersion: number;
  originalPrompt: string;
  proposedPrompt: string;
  performanceSummary: PerformanceSummary;
  validationResults: ValidationResult;
  proposedAt: string;
}

interface ValidationResult {
  passed: boolean;
  boundaryCheck: boolean;
  regressionCheck: boolean;
  safetyCheck: boolean;
  details: string[];
}

export class PromptEvolutionEngine {
  private readonly MIN_INTERACTIONS_FOR_EVOLUTION = 50;
  private readonly SUCCESS_RATE_THRESHOLD = 0.7;
  private readonly EDIT_RATE_THRESHOLD = 0.3;
  
  /**
   * Main evolution cycle - analyze all prompts and propose improvements
   */
  async runEvolutionCycle(): Promise<MutationProposal[]> {
    console.log('[PromptEvolution] Starting evolution cycle');
    
    // Get all active prompt keys
    const promptPattern = 'prompt:*';
    const promptKeys = await kv.keys(promptPattern);
    
    // Filter out proposed prompts and locked prompts
    const activePromptKeys = promptKeys.filter(key => 
      !key.includes(':proposed:') && !key.includes(':v')
    );
    
    const proposals: MutationProposal[] = [];
    
    for (const promptId of activePromptKeys) {
      try {
        // Skip if prompt is locked
        if (await isPromptLocked(promptId)) {
          console.log(`[PromptEvolution] Skipping locked prompt: ${promptId}`);
          continue;
        }
        
        // Analyze performance
        const performance = await this.analyzePerformance(promptId);
        
        if (performance.recommendation === 'evolve') {
          // Get current prompt
          const prompt = await kv.get<EvolvingPrompt>(promptId);
          if (!prompt) continue;
          
          // Generate mutation
          const newPrompt = await this.generateMutation(
            prompt.currentPrompt,
            performance,
            prompt.evolution.boundaries
          );
          
          // Validate mutation
          const validation = await this.validateMutation(
            newPrompt,
            prompt.evolution.boundaries
          );
          
          if (validation.passed) {
            // Propose mutation
            const proposal = await this.proposeMutation(
              promptId,
              prompt,
              newPrompt,
              performance,
              validation
            );
            proposals.push(proposal);
          } else {
            console.log(`[PromptEvolution] Validation failed for ${promptId}:`, validation.details);
          }
        }
      } catch (error) {
        console.error(`[PromptEvolution] Error processing ${promptId}:`, error);
      }
    }
    
    console.log(`[PromptEvolution] Completed cycle with ${proposals.length} proposals`);
    return proposals;
  }
  
  /**
   * Analyze prompt performance based on aggregated feedback
   */
  private async analyzePerformance(promptId: string): Promise<PerformanceSummary> {
    // Get last 7 days of feedback
    const aggregations = await getFeedbackAggregations(promptId, 'day', 7);
    
    // Calculate overall metrics
    let totalPositive = 0;
    let totalNegative = 0;
    let totalEdits = 0;
    let totalInteractions = 0;
    const patternFrequency = new Map<string, number>();
    
    for (const agg of aggregations) {
      totalPositive += agg.metrics.positive;
      totalNegative += agg.metrics.negative;
      totalEdits += agg.metrics.edits;
      totalInteractions += agg.metrics.totalInteractions;
      
      // Aggregate patterns
      for (const pattern of agg.metrics.patterns) {
        const current = patternFrequency.get(pattern.pattern) || 0;
        patternFrequency.set(pattern.pattern, current + pattern.frequency);
      }
    }
    
    const totalFeedback = totalPositive + totalNegative;
    const successRate = totalFeedback > 0 ? totalPositive / totalFeedback : 0.5;
    const editRate = totalInteractions > 0 ? totalEdits / totalInteractions : 0;
    
    // Get top patterns
    const topPatterns = Array.from(patternFrequency.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    // Determine recommendation
    let recommendation: 'evolve' | 'maintain' | 'review' = 'maintain';
    
    if (totalInteractions < this.MIN_INTERACTIONS_FOR_EVOLUTION) {
      recommendation = 'maintain'; // Not enough data
    } else if (successRate < this.SUCCESS_RATE_THRESHOLD || editRate > this.EDIT_RATE_THRESHOLD) {
      recommendation = 'evolve'; // Performance below threshold
    } else if (successRate < 0.5 || editRate > 0.5) {
      recommendation = 'review'; // Significant issues, needs human review
    }
    
    return {
      promptId,
      successRate,
      editRate,
      totalInteractions,
      topPatterns,
      recommendation,
    };
  }
  
  /**
   * Generate an improved prompt using AI
   */
  private async generateMutation(
    currentPrompt: string,
    performance: PerformanceSummary,
    boundaries: string[]
  ): Promise<string> {
    // Construct meta-prompt for the AI prompt engineer
    const metaPrompt = `You are an expert AI Prompt Engineer. Your task is to improve the following prompt based on the provided performance data.

CURRENT PROMPT:
${currentPrompt}

PERFORMANCE DATA:
- Success Rate: ${(performance.successRate * 100).toFixed(1)}%
- Edit Rate: ${(performance.editRate * 100).toFixed(1)}%
- Total Interactions: ${performance.totalInteractions}

TOP USER EDIT PATTERNS:
${performance.topPatterns.map(p => `- "${p.pattern}" (${p.frequency} times)`).join('\n')}

IMMUTABLE BOUNDARIES (must be preserved):
${boundaries.map(b => `- ${b}`).join('\n')}

TASK:
Propose a new version of the prompt that addresses the performance issues while:
1. Maintaining all immutable boundaries
2. Preserving the core personality and purpose
3. Improving based on the edit patterns observed

Focus particularly on the most frequent edit patterns. For example, if users frequently "shortened response", make the prompt more concise.

OUTPUT ONLY THE NEW PROMPT TEXT, nothing else.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are an expert prompt engineer. Output only the improved prompt, no explanations.',
        }, {
          role: 'user',
          content: metaPrompt,
        }],
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      const newPrompt = response.choices[0]?.message?.content?.trim();
      if (!newPrompt) {
        throw new Error('No prompt generated');
      }
      
      return newPrompt;
    } catch (error) {
      console.error('[PromptEvolution] Error generating mutation:', error);
      throw error;
    }
  }
  
  /**
   * Validate the new prompt for safety and effectiveness
   */
  private async validateMutation(
    newPrompt: string,
    boundaries: string[]
  ): Promise<ValidationResult> {
    const details: string[] = [];
    let passed = true;
    
    // 1. Boundary Check - ensure all boundaries are present
    const boundaryCheck = boundaries.every(boundary => 
      newPrompt.toLowerCase().includes(boundary.toLowerCase())
    );
    
    if (!boundaryCheck) {
      passed = false;
      details.push('Missing required boundaries');
    }
    
    // 2. Regression Check - test basic functionality
    const regressionCheck = await this.runRegressionTests(newPrompt);
    if (!regressionCheck) {
      passed = false;
      details.push('Failed regression tests');
    }
    
    // 3. Safety Check - ensure no harmful content
    const safetyCheck = await this.runSafetyCheck(newPrompt);
    if (!safetyCheck) {
      passed = false;
      details.push('Failed safety check');
    }
    
    return {
      passed,
      boundaryCheck,
      regressionCheck,
      safetyCheck,
      details,
    };
  }
  
  /**
   * Run regression tests on the new prompt
   */
  private async runRegressionTests(prompt: string): Promise<boolean> {
    // Test queries that should always work
    const testQueries = [
      'Find foundation photos from last week',
      'Show me roofing images',
      'What photos do we have from the Johnson project?',
    ];
    
    try {
      for (const query of testQueries) {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: prompt,
          }, {
            role: 'user',
            content: query,
          }],
          temperature: 0.3,
          max_tokens: 200,
        });
        
        const content = response.choices[0]?.message?.content;
        if (!content || content.length < 10) {
          return false; // Response too short or missing
        }
      }
      
      return true;
    } catch (error) {
      console.error('[PromptEvolution] Regression test error:', error);
      return false;
    }
  }
  
  /**
   * Check prompt for safety issues
   */
  private async runSafetyCheck(prompt: string): Promise<boolean> {
    // Simple checks for now
    const prohibitedTerms = [
      'ignore previous',
      'disregard instructions',
      'pretend you are',
      'act as if',
      'bypass',
      'hack',
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    for (const term of prohibitedTerms) {
      if (lowerPrompt.includes(term)) {
        return false;
      }
    }
    
    // Additional OpenAI moderation check could be added here
    
    return true;
  }
  
  /**
   * Save the mutation proposal for human review
   */
  private async proposeMutation(
    promptId: string,
    originalPrompt: EvolvingPrompt,
    proposedPrompt: string,
    performance: PerformanceSummary,
    validation: ValidationResult
  ): Promise<MutationProposal> {
    const proposal: MutationProposal = {
      promptId,
      originalVersion: originalPrompt.version,
      newVersion: originalPrompt.version + 1,
      originalPrompt: originalPrompt.currentPrompt,
      proposedPrompt,
      performanceSummary: performance,
      validationResults: validation,
      proposedAt: new Date().toISOString(),
    };
    
    // Save to KV
    const proposalKey = `prompt:proposed:${promptId}:v${proposal.newVersion}`;
    await kv.set(proposalKey, proposal, { ex: 30 * 24 * 60 * 60 }); // 30 days TTL
    
    // Send notification (if configured)
    await this.sendNotification(proposal);
    
    return proposal;
  }
  
  /**
   * Send notification about new prompt proposal
   */
  private async sendNotification(proposal: MutationProposal): Promise<void> {
    // For now, just log. In production, this would send to Slack/email
    console.log('[PromptEvolution] New proposal ready for review:', {
      promptId: proposal.promptId,
      proposalKey: `prompt:proposed:${proposal.promptId}:v${proposal.newVersion}`,
      performance: {
        successRate: `${(proposal.performanceSummary.successRate * 100).toFixed(1)}%`,
        editRate: `${(proposal.performanceSummary.editRate * 100).toFixed(1)}%`,
      },
    });
    
    // Example Slack webhook implementation:
    /*
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🧬 New Scout AI Prompt Evolution Proposal`,
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Prompt:* ${proposal.promptId}\n*Version:* ${proposal.originalVersion} → ${proposal.newVersion}\n*Success Rate:* ${(proposal.performanceSummary.successRate * 100).toFixed(1)}%\n*Edit Rate:* ${(proposal.performanceSummary.editRate * 100).toFixed(1)}%`,
            },
          }],
        }),
      });
    }
    */
  }
}