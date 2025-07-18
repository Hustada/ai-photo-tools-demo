// © 2025 Mark Hustad — MIT License
// Vercel cron job for feedback aggregation

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runAggregationCycle } from '../../src/utils/feedbackAggregator';

export const config = {
  maxDuration: 60, // 60 seconds max
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

  console.log('[Cron] Starting feedback aggregation cycle');
  
  try {
    // Run hourly aggregation
    const hourlyCount = await runAggregationCycle('hour');
    console.log(`[Cron] Aggregated ${hourlyCount} prompts (hourly)`);
    
    // Run daily aggregation if it's midnight UTC
    const now = new Date();
    let dailyCount = 0;
    if (now.getUTCHours() === 0) {
      dailyCount = await runAggregationCycle('day');
      console.log(`[Cron] Aggregated ${dailyCount} prompts (daily)`);
    }
    
    // Run weekly aggregation if it's Sunday at midnight UTC
    let weeklyCount = 0;
    if (now.getUTCHours() === 0 && now.getUTCDay() === 0) {
      weeklyCount = await runAggregationCycle('week');
      console.log(`[Cron] Aggregated ${weeklyCount} prompts (weekly)`);
    }
    
    // Run monthly aggregation if it's the first day of month at midnight UTC
    let monthlyCount = 0;
    if (now.getUTCHours() === 0 && now.getUTCDate() === 1) {
      monthlyCount = await runAggregationCycle('month');
      console.log(`[Cron] Aggregated ${monthlyCount} prompts (monthly)`);
    }
    
    res.status(200).json({
      success: true,
      aggregations: {
        hourly: hourlyCount,
        daily: dailyCount,
        weekly: weeklyCount,
        monthly: monthlyCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Aggregation error:', error);
    res.status(500).json({
      error: 'Aggregation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}