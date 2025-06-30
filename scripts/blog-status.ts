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
    
    // Calculate session duration with better formatting
    const sessionStart = new Date(session.createdAt);
    const now = new Date();
    const durationMs = now.getTime() - sessionStart.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    
    let durationString;
    if (durationDays > 0) {
      durationString = `${durationDays} day${durationDays > 1 ? 's' : ''}`;
      if (durationDays < 7) {
        const remainingHours = Math.round((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (remainingHours > 0) {
          durationString += `, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
        }
      }
    } else if (durationHours > 0) {
      durationString = `${durationHours} hour${durationHours > 1 ? 's' : ''}`;
    } else {
      durationString = `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}`;
    }
    
    console.log(`  Session Duration: ${durationString}`);
    
    // Analyze git activity since session start
    let commitCount = 0;
    let linesAdded = 0;
    let linesRemoved = 0;
    let recentCommits: string[] = [];
    
    if (currentCommit !== session.startCommit) {
      try {
        // Get commit count
        const commitCountOutput = execSync(
          `git rev-list --count ${session.startCommit}..${currentCommit}`,
          { encoding: 'utf8' }
        );
        commitCount = parseInt(commitCountOutput.trim());
        
        // Get line changes
        const diffStats = execSync(
          `git diff --numstat ${session.startCommit}..${currentCommit}`,
          { encoding: 'utf8' }
        );
        
        diffStats.trim().split('\n').forEach(line => {
          if (line.trim()) {
            const [added, removed] = line.split('\t');
            if (added !== '-') linesAdded += parseInt(added);
            if (removed !== '-') linesRemoved += parseInt(removed);
          }
        });
        
        // Get recent commits (last 3)
        const recentCommitsOutput = execSync(
          `git log --pretty=format:"%s (%cr)" ${session.startCommit}..${currentCommit} -3`,
          { encoding: 'utf8' }
        );
        recentCommits = recentCommitsOutput.trim().split('\n').filter(line => line.trim());
        
      } catch (error) {
        console.warn('  (Could not analyze git changes)');
      }
    }
    
    // Show progress summary
    console.log('\n📊 Session Progress:');
    if (commitCount > 0) {
      console.log(`  Commits: ${commitCount}`);
      console.log(`  Lines Added: +${linesAdded}`);
      console.log(`  Lines Removed: -${linesRemoved}`);
      
      if (recentCommits.length > 0) {
        console.log('\n📝 Recent Commits:');
        recentCommits.forEach(commit => {
          console.log(`  • ${commit}`);
        });
      }
    } else {
      console.log(`  No commits yet since session start`);
    }
    
    // Show status indicators and warnings
    if (currentBranch !== session.startBranch) {
      console.log('\n⚠️  Warning: You switched branches since starting the session');
      console.log(`   Started on: ${session.startBranch}`);
      console.log(`   Currently on: ${currentBranch}`);
    }
    
    // Session health warnings
    if (durationDays >= 7) {
      console.log('\n🚨 Very old session (7+ days)');
      console.log('   Consider completing, canceling, or restarting this session');
    } else if (durationDays >= 1) {
      console.log('\n⚠️  Long-running session');
      console.log('   Don\'t forget to complete when your feature is done!');
    }
    
    if (currentCommit === session.startCommit) {
      console.log('\n💡 Tip: No commits yet - make some changes and commit them');
    } else if (commitCount >= 10) {
      console.log('\n🎯 Substantial changes detected - ready for a comprehensive blog post!');
    } else if (commitCount >= 3) {
      console.log('\n✨ Good progress - ready to generate blog post when you complete the session');
    } else {
      console.log('\n📝 Some progress made - continue working or complete when ready');
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