#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to check blog documentation session status

import { getSessionStatus } from '../src/utils/blogSession.js';

async function checkBlogStatus() {
  try {
    console.log('📊 Blog Documentation Session Status\n');
    
    const { hasActiveSession, session } = getSessionStatus();
    
    if (!hasActiveSession) {
      console.log('❌ No active documentation session');
      console.log('\nStart a new session:');
      console.log('  npm run blog:start "Your Feature Name"');
      return;
    }
    
    if (!session) {
      console.log('❌ Session data unavailable');
      return;
    }
    
    console.log('✅ Active Session Found');
    console.log('\n📝 Session Details:');
    console.log(`  Feature: ${session.featureName}`);
    console.log(`  Branch: ${session.startBranch}`);
    console.log(`  Start Commit: ${session.startCommit.substring(0, 8)}`);
    console.log(`  Started: ${new Date(session.createdAt).toLocaleString()}`);
    console.log(`  Status: ${session.status}`);
    
    if (session.description) {
      console.log(`  Description: ${session.description}`);
    }
    
    if (session.tags && session.tags.length > 0) {
      console.log(`  Tags: ${session.tags.join(', ')}`);
    }
    
    // Get current git info for comparison
    const { execSync } = await import('child_process');
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    
    console.log('\n🔍 Current State:');
    console.log(`  Current Branch: ${currentBranch}`);
    console.log(`  Current Commit: ${currentCommit.substring(0, 8)}`);
    
    // Calculate session duration
    const sessionStart = new Date(session.createdAt);
    const now = new Date();
    const duration = Math.round((now.getTime() - sessionStart.getTime()) / (1000 * 60)); // minutes
    console.log(`  Session Duration: ${duration} minutes`);
    
    // Show status indicators
    if (currentBranch !== session.startBranch) {
      console.log('\n⚠️  Warning: You switched branches since starting the session');
    }
    
    if (currentCommit === session.startCommit) {
      console.log('\n💡 Tip: No commits yet - make some changes and commit them');
    } else {
      console.log('\n✨ Ready to generate blog post when you complete the session');
    }
    
    console.log('\n🎛️  Available Commands:');
    console.log('  npm run blog:complete  # Complete session and generate blog');
    console.log('  npm run blog:cancel    # Cancel current session');
    console.log('  npm run blog:status    # Show this status (current command)');
    
  } catch (error) {
    console.error('❌ Failed to check blog status:', (error as Error).message);
    process.exit(1);
  }
}

checkBlogStatus();