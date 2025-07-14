#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to clean up old or stale blog documentation sessions

import { getActiveSession, cleanupSession } from '../src/utils/blogSession.js';

async function cleanupBlogSession() {
  try {
    console.log('🧹 Cleaning up blog documentation sessions...\n');
    
    // Check if there's an active session
    const activeSession = getActiveSession();
    if (!activeSession) {
      console.log('✅ No active session found - nothing to clean up');
      return;
    }

    console.log('📝 Found Active Session:');
    console.log(`  Feature: ${activeSession.featureName}`);
    console.log(`  Started: ${new Date(activeSession.createdAt).toLocaleString()}`);
    
    // Calculate session age
    const sessionStart = new Date(activeSession.createdAt);
    const now = new Date();
    const durationMs = now.getTime() - sessionStart.getTime();
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));
    
    if (durationDays > 0) {
      console.log(`  Age: ${durationDays} day${durationDays > 1 ? 's' : ''}`);
    } else {
      console.log(`  Age: ${durationHours} hour${durationHours > 1 ? 's' : ''}`);
    }
    
    // Decide on cleanup action based on age
    if (durationDays >= 7) {
      console.log('\n🚨 Session is very old (7+ days)');
      console.log('🗑️  Automatically cleaning up stale session...');
      cleanupSession();
      console.log('✅ Stale session cleaned up successfully');
      console.log('\nYou can now start a fresh session:');
      console.log('  npm run docs:start "Your Feature Name"');
    } else if (durationDays >= 3) {
      console.log('\n⚠️  Session is getting old (3+ days)');
      console.log('🤔 Consider completing or canceling this session:');
      console.log('  npm run docs:complete  # Generate blog and finish');
      console.log('  npm run docs:cancel    # Cancel without generating blog');
      console.log('\nOr force cleanup:');
      console.log('  rm .blog-session.json  # Manual cleanup (not recommended)');
    } else {
      console.log('\n✅ Session age is reasonable');
      console.log('💡 No cleanup needed - continue working or complete when ready:');
      console.log('  npm run docs:status    # Check session progress');
      console.log('  npm run docs:complete  # Complete and generate blog');
    }
    
  } catch (error) {
    console.error('❌ Failed to clean up session:', (error as Error).message);
    process.exit(1);
  }
}

cleanupBlogSession();