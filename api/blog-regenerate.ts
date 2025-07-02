// © 2025 Mark Hustad — MIT License
// API endpoint for regenerating blog posts from stored git data

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { BlogPost } from './blog-posts.js';
import { generateBlogPost, type BlogGenerationOptions } from '../src/utils/blogGenerator.js';

interface RegenerateRequest {
  blogId: string;
  options?: BlogGenerationOptions;
}

interface RegenerateResponse {
  success: boolean;
  post?: BlogPost;
  error?: string;
}

// Get a blog post from KV storage
const getBlogPost = async (id: string): Promise<BlogPost | null> => {
  try {
    const post = await kv.get<BlogPost>(`blog:post:${id}`);
    return post;
  } catch (error) {
    console.warn(`[BlogRegenerate] Error getting post ${id}:`, error);
    return null;
  }
};

// Save a blog post to KV storage
const saveBlogPost = async (post: BlogPost): Promise<void> => {
  try {
    await kv.set(`blog:post:${post.metadata.id}`, post);
    console.log(`[BlogRegenerate] Updated blog post: ${post.metadata.id}`);
  } catch (error) {
    console.error(`[BlogRegenerate] Error saving post ${post.metadata.id}:`, error);
    throw error;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[BlogRegenerate] API call started, method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    } as RegenerateResponse);
  }

  try {
    const { blogId, options }: RegenerateRequest = req.body;

    if (!blogId) {
      return res.status(400).json({
        success: false,
        error: 'Blog ID is required'
      } as RegenerateResponse);
    }

    // Get the existing blog post
    const existingPost = await getBlogPost(blogId);
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        error: 'Blog post not found'
      } as RegenerateResponse);
    }

    // Check if the post has the required data for regeneration
    if (!existingPost.gitAnalysis || !existingPost.sessionData) {
      return res.status(400).json({
        success: false,
        error: 'Blog post does not have git analysis data for regeneration'
      } as RegenerateResponse);
    }

    console.log(`[BlogRegenerate] Regenerating blog post: ${blogId}`);

    // Generate new content using stored git analysis and session data
    const generationOptions = {
      style: 'technical',
      tone: 'professional',
      includeCodeExamples: true,
      targetLength: 'medium',
      ...options
    } as Required<BlogGenerationOptions>;

    const generatedBlog = await generateBlogPost(
      existingPost.sessionData,
      existingPost.gitAnalysis,
      generationOptions
    );

    // Update the blog post with new content, preserving metadata and creation date
    const updatedPost: BlogPost = {
      ...existingPost,
      content: generatedBlog.content,
      rawContent: generatedBlog.rawContent,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...existingPost.metadata,
        title: generatedBlog.metadata.title,
        description: generatedBlog.metadata.description,
        readingTime: generatedBlog.metadata.readingTime,
        tags: generatedBlog.metadata.tags,
        author: generatedBlog.metadata.author
      }
    };

    // Save the updated post
    await saveBlogPost(updatedPost);

    console.log(`[BlogRegenerate] Successfully regenerated blog post: ${blogId}`);

    return res.status(200).json({
      success: true,
      post: updatedPost
    } as RegenerateResponse);

  } catch (error: unknown) {
    console.error('[BlogRegenerate] Error regenerating blog post:', error);
    return res.status(500).json({
      success: false,
      error: `Failed to regenerate blog post: ${(error as Error).message}`
    } as RegenerateResponse);
  }
}

// Export types for use in other files
export type { RegenerateRequest, RegenerateResponse };