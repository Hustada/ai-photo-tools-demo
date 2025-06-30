#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to cancel a blog documentation session

import { cancelSession, getActiveSession, cleanupSession } from '../src/utils/blogSession.js';

async function cancelBlogSession() {
  try {
    console.log('🚫 Cancelling blog documentation session...\n');
    
    // Check if there's an active session
    const activeSession = getActiveSession();
    if (!activeSession) {
      console.error('❌ No active documentation session found');
      console.log('\nNothing to cancel. Start a new session:');
      console.log('  npm run blog:start "Your Feature Name"');
      process.exit(1);
    }

    console.log('📝 Current Session:');
    console.log(`  Feature: ${activeSession.featureName}`);
    console.log(`  Branch: ${activeSession.startBranch}`);
    console.log(`  Started: ${new Date(activeSession.createdAt).toLocaleString()}`);
    
    // Calculate session duration
    const sessionStart = new Date(activeSession.createdAt);
    const now = new Date();
    const duration = Math.round((now.getTime() - sessionStart.getTime()) / (1000 * 60)); // minutes
    console.log(`  Duration: ${duration} minutes`);
    
    // Cancel the session
    cancelSession();
    
    // Clean up the session file
    cleanupSession();
    
    console.log('\n✅ Session cancelled and cleaned up');
    console.log('\nYou can now:');
    console.log('  1. Start a new session: npm run blog:start "New Feature Name"');
    console.log('  2. Check status: npm run blog:status');
    
  } catch (error) {
    console.error('❌ Failed to cancel blog session:', (error as Error).message);
    process.exit(1);
  }
}

cancelBlogSession();