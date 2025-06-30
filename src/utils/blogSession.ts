// © 2025 Mark Hustad — MIT License
// Blog documentation session management

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface BlogSession {
  id: string;
  featureName: string;
  startBranch: string;
  startCommit: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
  description?: string;
  tags?: string[];
}

const SESSION_FILE = '.blog-session.json';

// Get the current active session
export const getActiveSession = (): BlogSession | null => {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    
    const sessionData = fs.readFileSync(SESSION_FILE, 'utf8');
    const session = JSON.parse(sessionData) as BlogSession;
    
    return session.status === 'active' ? session : null;
  } catch (error) {
    console.warn('[BlogSession] Error reading session file:', error);
    return null;
  }
};

// Create a new documentation session
export const createSession = (featureName: string, description?: string, tags?: string[]): BlogSession => {
  // Check if there's already an active session
  const existingSession = getActiveSession();
  if (existingSession) {
    throw new Error(`Active session already exists: "${existingSession.featureName}". Complete or cancel it first.`);
  }

  const session: BlogSession = {
    id: generateSessionId(),
    featureName,
    startBranch: getCurrentBranch(),
    startCommit: getCurrentCommit(),
    createdAt: new Date().toISOString(),
    status: 'active',
    description,
    tags
  };

  saveSession(session);
  console.log(`[BlogSession] ✅ Started documentation session: "${featureName}"`);
  console.log(`[BlogSession] Branch: ${session.startBranch}`);
  console.log(`[BlogSession] Starting commit: ${session.startCommit}`);
  
  return session;
};

// Complete the current session
export const completeSession = (): BlogSession => {
  const session = getActiveSession();
  if (!session) {
    throw new Error('No active documentation session found. Start one with blog:start first.');
  }

  session.status = 'completed';
  saveSession(session);
  
  console.log(`[BlogSession] ✅ Completed documentation session: "${session.featureName}"`);
  return session;
};

// Cancel the current session
export const cancelSession = (): void => {
  const session = getActiveSession();
  if (!session) {
    throw new Error('No active documentation session found.');
  }

  session.status = 'cancelled';
  saveSession(session);
  
  console.log(`[BlogSession] ❌ Cancelled documentation session: "${session.featureName}"`);
};

// Get session status info
export const getSessionStatus = (): { hasActiveSession: boolean; session?: BlogSession } => {
  const session = getActiveSession();
  return {
    hasActiveSession: session !== null,
    session: session || undefined
  };
};

// Helper functions
const saveSession = (session: BlogSession): void => {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (error) {
    console.error('[BlogSession] Error saving session:', error);
    throw new Error('Failed to save session data');
  }
};

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getCurrentBranch = (): string => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('[BlogSession] Could not get current branch:', error);
    return 'unknown';
  }
};

const getCurrentCommit = (): string => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('[BlogSession] Could not get current commit:', error);
    return 'unknown';
  }
};

// Clean up session file (for completed/cancelled sessions)
export const cleanupSession = (): void => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
      console.log('[BlogSession] Session file cleaned up');
    }
  } catch (error) {
    console.warn('[BlogSession] Error cleaning up session file:', error);
  }
};