// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'error';
  message: string;
  data?: any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { timestamp, level, message, data }: LogEntry = req.body;

    // Color coding for terminal output
    const colors = {
      info: '\x1b[34m',     // Blue
      success: '\x1b[32m',  // Green
      error: '\x1b[31m',    // Red
      reset: '\x1b[0m'      // Reset
    };

    // Format the log message for terminal
    const colorCode = colors[level] || colors.info;
    const formattedMessage = `${colorCode}[PIPELINE] ${timestamp} - ${message}${colors.reset}`;
    
    // Log to server console (visible in terminal)
    console.log(formattedMessage);
    
    // If there's additional data, log it too
    if (data) {
      console.log(`${colors.info}[DATA]${colors.reset}`, JSON.stringify(data, null, 2));
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[PIPELINE-LOG] Error:', error);
    res.status(500).json({ error: 'Logging failed' });
  }
}