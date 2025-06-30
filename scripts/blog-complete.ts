#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to complete a blog documentation session and generate blog post

import { completeSession, getActiveSession } from '../src/utils/blogSession.js';

async function completeBlogSession() {
  try {
    console.log('🏁 Completing blog documentation session...\n');
    
    // Check if there's an active session
    const activeSession = getActiveSession();
    if (!activeSession) {
      console.error('❌ No active documentation session found');
      console.log('\nStart a session first:');
      console.log('  npm run blog:start "Your Feature Name"');
      process.exit(1);
    }

    console.log('📝 Current Session:');
    console.log(`  Feature: ${activeSession.featureName}`);
    console.log(`  Branch: ${activeSession.startBranch}`);
    console.log(`  Start Commit: ${activeSession.startCommit.substring(0, 8)}`);
    console.log(`  Started: ${new Date(activeSession.createdAt).toLocaleString()}`);
    
    // Get current git info
    const { execSync } = await import('child_process');
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    
    console.log(`\n🔍 Current State:`);
    console.log(`  Current Branch: ${currentBranch}`);
    console.log(`  Current Commit: ${currentCommit.substring(0, 8)}`);
    
    // Check if we're on the same branch
    if (currentBranch !== activeSession.startBranch) {
      console.warn(`⚠️  Warning: Currently on "${currentBranch}" but session started on "${activeSession.startBranch}"`);
      console.log('This may include changes from multiple branches in the analysis.');
    }
    
    // Check if there are any changes
    if (currentCommit === activeSession.startCommit) {
      console.warn('⚠️  Warning: No commits found since session start');
      console.log('Consider making some commits before completing the session.');
    }
    
    // TODO: In Phase 3B, this is where we'll analyze git changes
    console.log('\n🔄 Analyzing changes...');
    console.log('📊 Generating blog post with AI...');
    console.log('(Note: Full change analysis and AI generation will be implemented in Phase 3B-3C)');
    
    // Complete the session
    const completedSession = completeSession();
    
    console.log('\n✅ Documentation session completed!');
    console.log('\nNext steps (coming in Phase 3B-3C):');
    console.log('  ✨ AI will analyze your git changes');
    console.log('  📝 Generate comprehensive blog post');
    console.log('  🖼️  Create hero image with DALL-E');
    console.log('  📤 Publish to blog system');
    
    console.log('\nFor now, you can:');
    console.log('  1. Start a new session: npm run blog:start "Next Feature"');
    console.log('  2. Check session status: npm run blog:status');
    
    // Clean up the session file since it's completed
    const { cleanupSession } = await import('../src/utils/blogSession.js');
    cleanupSession();
    
  } catch (error) {
    console.error('❌ Failed to complete blog session:', (error as Error).message);
    process.exit(1);
  }
}

completeBlogSession();