#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to start a blog documentation session

import { createSession, getSessionStatus } from '../src/utils/blogSession.js';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Feature name is required');
  console.log('\nUsage:');
  console.log('  npm run blog:start "Feature Name"');
  console.log('  npm run blog:start "Feature Name" --description "Optional description"');
  console.log('  npm run blog:start "Feature Name" --tags "tag1,tag2,tag3"');
  console.log('\nExample:');
  console.log('  npm run blog:start "Mobile-First FilterBar" --description "Responsive design improvements" --tags "UI,Mobile,Performance"');
  process.exit(1);
}

const featureName = args[0];
let description: string | undefined;
let tags: string[] | undefined;

// Parse optional flags
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--description' && args[i + 1]) {
    description = args[i + 1];
    i++; // Skip the next argument
  } else if (args[i] === '--tags' && args[i + 1]) {
    tags = args[i + 1].split(',').map(tag => tag.trim());
    i++; // Skip the next argument
  }
}

async function startBlogSession() {
  try {
    console.log('🚀 Starting blog documentation session...\n');
    
    // Check current status
    const { hasActiveSession, session } = getSessionStatus();
    if (hasActiveSession && session) {
      console.error(`❌ Active session already exists: "${session.featureName}"`);
      console.log('Complete or cancel the current session before starting a new one:');
      console.log('  npm run blog:complete  # Complete and generate blog');
      console.log('  npm run blog:cancel    # Cancel current session');
      process.exit(1);
    }

    // Create new session
    const newSession = createSession(featureName, description, tags);
    
    console.log('\n📝 Session Details:');
    console.log(`  Feature: ${newSession.featureName}`);
    console.log(`  Branch: ${newSession.startBranch}`);
    console.log(`  Start Commit: ${newSession.startCommit.substring(0, 8)}`);
    if (description) {
      console.log(`  Description: ${description}`);
    }
    if (tags && tags.length > 0) {
      console.log(`  Tags: ${tags.join(', ')}`);
    }
    console.log(`  Created: ${new Date(newSession.createdAt).toLocaleString()}`);
    
    console.log('\n✅ Documentation session started!');
    console.log('\nNow you can:');
    console.log('  1. Work on your feature normally (git add, commit, etc.)');
    console.log('  2. When ready, run: npm run blog:complete');
    console.log('  3. CodeCraft will analyze your changes and generate a blog post');
    
    console.log('\nOther commands:');
    console.log('  npm run blog:status    # Check current session status');
    console.log('  npm run blog:cancel    # Cancel current session');
    
  } catch (error) {
    console.error('❌ Failed to start blog session:', (error as Error).message);
    process.exit(1);
  }
}

startBlogSession();