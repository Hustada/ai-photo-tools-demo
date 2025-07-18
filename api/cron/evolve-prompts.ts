// © 2025 Mark Hustad — MIT License
// Vercel cron job for prompt evolution

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PromptEvolutionEngine } from '../../src/utils/promptEvolution';

export const config = {
  maxDuration: 300, // 5 minutes max - evolution takes time
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is from Vercel Cron (basic security)
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Starting prompt evolution cycle');
  
  try {
    const engine = new PromptEvolutionEngine();
    const proposals = await engine.runEvolutionCycle();
    
    console.log(`[Cron] Evolution cycle completed with ${proposals.length} proposals`);
    
    res.status(200).json({
      success: true,
      proposals: proposals.map(p => ({
        promptId: p.promptId,
        version: `${p.originalVersion} → ${p.newVersion}`,
        performance: {
          successRate: `${(p.performanceSummary.successRate * 100).toFixed(1)}%`,
          editRate: `${(p.performanceSummary.editRate * 100).toFixed(1)}%`,
        },
        validation: p.validationResults,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Evolution error:', error);
    res.status(500).json({
      error: 'Evolution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}