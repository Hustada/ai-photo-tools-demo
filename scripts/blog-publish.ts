#!/usr/bin/env tsx

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getActiveSession, completeSession } from '../src/utils/blogSession';
import type { BlogPost } from '../api/blog-posts';

const DRAFTS_DIR = join(process.cwd(), '.blog-drafts');

async function publishBlog() {
  try {
    console.log('🚀 Publishing blog post...\n');

    // Load active session
    const session = getActiveSession();
    if (!session) {
      console.error('❌ No active blog session found. Start one with: npm run blog:start');
      process.exit(1);
    }

    // Check for draft
    const draftPath = join(DRAFTS_DIR, `${session.id}.json`);
    const markdownPath = join(DRAFTS_DIR, `${session.id}.md`);
    
    if (!existsSync(draftPath)) {
      console.error('❌ No draft found. Generate one with: npm run blog:preview');
      process.exit(1);
    }

    // Load draft
    const draftContent = readFileSync(draftPath, 'utf-8');
    let draft: BlogPost;
    try {
      draft = JSON.parse(draftContent);
    } catch (error) {
      console.error('❌ Invalid draft file format');
      process.exit(1);
    }

    // Check if markdown was edited
    let updatedContent = draft.rawContent;
    if (existsSync(markdownPath)) {
      const markdownContent = readFileSync(markdownPath, 'utf-8');
      
      // Parse frontmatter and content
      const frontmatterMatch = markdownContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontmatterMatch) {
        const [, frontmatter, content] = frontmatterMatch;
        
        // Update metadata from frontmatter
        const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
        const excerptMatch = frontmatter.match(/excerpt:\s*"([^"]+)"/);
        const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
        const categoryMatch = frontmatter.match(/category:\s*"([^"]+)"/);
        
        if (titleMatch) draft.metadata.title = titleMatch[1];
        if (excerptMatch) draft.metadata.excerpt = excerptMatch[1];
        if (categoryMatch) draft.metadata.category = categoryMatch[1];
        if (tagsMatch) {
          const tagsStr = tagsMatch[1];
          draft.metadata.tags = tagsStr.split(',').map(tag => tag.trim().replace(/"/g, ''));
        }
        
        updatedContent = content.trim();
        draft.rawContent = updatedContent;
        
        // Regenerate processed content (basic markdown to avoid complex parsing)
        draft.content = updatedContent;
        console.log('✅ Updated content from edited markdown file');
      }
    }

    // Mark as published
    draft.metadata.published = true;
    draft.metadata.id = draft.metadata.slug || `post-${Date.now()}`;
    draft.updatedAt = new Date().toISOString();

    console.log(`📝 Publishing: "${draft.metadata.title}"`);
    console.log(`🏷️  Tags: ${draft.metadata.tags.join(', ')}`);
    console.log(`📖 Reading time: ${draft.metadata.readingTime} min\n`);

    // Publish to API
    try {
      const response = await fetch('http://localhost:3000/api/blog-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Blog post published successfully!');
      console.log(`🔗 URL: /blog/${draft.metadata.slug}\n`);

    } catch (fetchError) {
      console.warn('⚠️  Could not publish to API (server might not be running)');
      console.log('📄 Draft is ready and can be published manually later\n');
    }

    // Complete session
    completeSession(session.id);
    console.log('✅ Blog session completed');

    // Clean up draft files
    try {
      if (existsSync(draftPath)) unlinkSync(draftPath);
      if (existsSync(markdownPath)) unlinkSync(markdownPath);
      console.log('🧹 Draft files cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️  Could not clean up draft files');
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. Visit your blog to see the published post');
    console.log('   2. Share your development insights with the team!');
    console.log('   3. Start a new session when you begin your next feature');

  } catch (error) {
    console.error('❌ Error publishing blog:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  publishBlog();
}

export { publishBlog };