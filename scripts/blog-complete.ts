#!/usr/bin/env tsx
// © 2025 Mark Hustad — MIT License
// CLI script to complete a blog documentation session and generate blog post

import 'dotenv/config';
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
    
    // Analyze git changes
    console.log('\n🔄 Analyzing git changes...');
    
    const { analyzeGitChanges } = await import('../src/utils/gitAnalysis.js');
    const analysis = analyzeGitChanges(activeSession.startCommit, currentCommit);
    
    console.log('\n📊 Change Analysis Summary:');
    console.log(`  Commits: ${analysis.commitCount}`);
    console.log(`  Files Changed: ${analysis.summary.totalFiles}`);
    console.log(`  New Files: ${analysis.summary.newFiles}`);
    console.log(`  Lines Added: ${analysis.summary.totalInsertions}`);
    console.log(`  Lines Removed: ${analysis.summary.totalDeletions}`);
    console.log(`  Primary Languages: ${analysis.summary.primaryLanguages.join(', ')}`);
    console.log(`  Categories: ${analysis.summary.categories.join(', ')}`);
    
    if (analysis.summary.architecturalChanges.length > 0) {
      console.log(`  Architectural Changes: ${analysis.summary.architecturalChanges.join(', ')}`);
    }
    
    console.log(`\n📝 Code Snippets Extracted: ${analysis.codeSnippets.length}`);
    analysis.codeSnippets.forEach((snippet, i) => {
      console.log(`  ${i + 1}. ${snippet.description} (${snippet.file})`);
    });
    
    console.log('\n🤖 Generating blog post with AI...');
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI API key not found. Skipping AI generation.');
      console.log('Set OPENAI_API_KEY environment variable to enable AI blog generation.');
    } else {
      try {
        const { generateBlogPost } = await import('../src/utils/blogGenerator.js');
        
        const generatedBlog = await generateBlogPost(activeSession, analysis, {
          style: 'technical',
          tone: 'professional',
          includeCodeExamples: true,
          targetLength: 'medium'
        });
        
        console.log('\n✨ Blog Post Generated Successfully!');
        console.log(`  Title: ${generatedBlog.metadata.title}`);
        console.log(`  Author: ${generatedBlog.metadata.author}`);
        console.log(`  Reading Time: ${generatedBlog.metadata.readingTime} min`);
        console.log(`  Tags: ${generatedBlog.metadata.tags.join(', ')}`);
        console.log(`  Content Length: ${generatedBlog.content.length} characters`);
        
        // Generate hero image with DALL-E
        console.log('\n🎨 Generating hero image with DALL-E...');
        try {
          const blogId = `${activeSession.featureName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
          
          const imageResponse = await fetch('http://localhost:3000/api/generate-blog-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blogId,
              blogTitle: generatedBlog.metadata.title,
              blogDescription: generatedBlog.metadata.description || activeSession.featureName,
              style: 'technical'
            })
          });
          
          const imageResult = await imageResponse.json();
          
          if (imageResult.success) {
            console.log(`✅ Hero image generated: ${imageResult.localPath}`);
            console.log(`   Image URL: ${imageResult.imageUrl}`);
            console.log(`   Prompt used: ${imageResult.prompt}`);
          } else {
            console.warn(`⚠️  Image generation failed: ${imageResult.error}`);
          }
        } catch (error) {
          console.warn('⚠️  Image generation error:', error.message);
        }
        
        // TODO: In Phase 3D, we'll add the review and publishing workflow
        console.log('\n📤 Publishing to blog system...');
        console.log('(Note: Review and publishing workflow will be implemented in Phase 3D)');
        
      } catch (error) {
        console.error('❌ AI generation failed:', (error as Error).message);
        console.log('Blog analysis completed successfully, but AI generation encountered an error.');
      }
    }
    
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