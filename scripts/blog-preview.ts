#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getActiveSession } from '../src/utils/blogSession';
import { analyzeGitChanges } from '../src/utils/gitAnalysis';
import { generateBlogPost } from '../src/utils/blogGenerator';
import type { BlogPost } from '../api/blog-posts';

const DRAFTS_DIR = join(process.cwd(), '.blog-drafts');

async function previewBlog() {
  try {
    console.log('📝 Generating blog preview...\n');

    // Load active session
    const session = getActiveSession();
    if (!session) {
      console.error('❌ No active blog session found. Start one with: npm run blog:start');
      process.exit(1);
    }

    console.log(`🎯 Session: ${session.featureName}`);
    console.log(`🌿 Branch: ${session.startBranch}`);
    console.log(`📅 Started: ${new Date(session.createdAt).toLocaleString()}\n`);

    // Analyze git changes
    console.log('🔍 Analyzing git changes...');
    const analysis = await analyzeGitChanges(session.startBranch, session.startCommit);
    
    if (analysis.commitCount === 0) {
      console.warn('⚠️  No commits found since session start. Make some changes first!');
      process.exit(1);
    }

    console.log(`✅ Found ${analysis.commitCount} commits with ${analysis.fileChanges.length} file changes\n`);

    // Generate blog post
    console.log('🤖 Generating blog content with AI...');
    const generatedBlog = await generateBlogPost(session, analysis, {
      includeCodeSnippets: true,
      includeTechnicalDetails: true
    });

    // Create draft structure
    const draft: BlogPost = {
      metadata: {
        id: `draft-${session.id}`,
        title: generatedBlog.title,
        slug: generatedBlog.slug,
        excerpt: generatedBlog.excerpt,
        author: 'CodeCraft AI',
        tags: generatedBlog.tags,
        category: 'development',
        readingTime: Math.ceil(generatedBlog.content.split(' ').length / 200),
        published: false
      },
      content: generatedBlog.content,
      rawContent: generatedBlog.rawMarkdown,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gitCommitHash: analysis.commits[0]?.hash,
      branchName: session.startBranch
    };

    // Ensure drafts directory exists
    if (!existsSync(DRAFTS_DIR)) {
      require('fs').mkdirSync(DRAFTS_DIR, { recursive: true });
    }

    // Save draft
    const draftPath = join(DRAFTS_DIR, `${session.id}.json`);
    writeFileSync(draftPath, JSON.stringify(draft, null, 2));

    // Save markdown for easy editing
    const markdownPath = join(DRAFTS_DIR, `${session.id}.md`);
    const editableMarkdown = `---
title: "${draft.metadata.title}"
excerpt: "${draft.metadata.excerpt}"
tags: [${draft.metadata.tags.map(tag => `"${tag}"`).join(', ')}]
category: "${draft.metadata.category}"
---

${draft.rawContent}`;
    
    writeFileSync(markdownPath, editableMarkdown);

    console.log('✅ Blog preview generated successfully!\n');
    console.log('📄 Files created:');
    console.log(`   Draft: ${draftPath}`);
    console.log(`   Markdown: ${markdownPath}\n`);
    
    console.log('📋 Preview Summary:');
    console.log(`   Title: ${draft.metadata.title}`);
    console.log(`   Excerpt: ${draft.metadata.excerpt}`);
    console.log(`   Tags: ${draft.metadata.tags.join(', ')}`);
    console.log(`   Reading Time: ${draft.metadata.readingTime} min\n`);
    
    console.log('🎯 Next Steps:');
    console.log('   1. Review the markdown file to edit content');
    console.log('   2. Run "npm run blog:publish" to publish the blog post');
    console.log('   3. Or run "npm run blog:preview" again to regenerate');

  } catch (error) {
    console.error('❌ Error generating blog preview:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  previewBlog();
}

export { previewBlog };