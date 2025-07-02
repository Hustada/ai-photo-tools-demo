// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { GitChangeAnalysis } from '../src/utils/gitAnalysis.js';
import type { BlogSession } from '../src/utils/blogSession.js';

export interface BlogPostMetadata {
  id: string;
  title: string;
  author: string;
  date: string;
  description: string;
  filename: string;
  readingTime: number;
  tags: string[];
  heroImage?: string;
}

export interface BlogPost {
  metadata: BlogPostMetadata;
  content: string;
  rawContent: string;
  createdAt: string;
  updatedAt: string;
  gitCommitHash?: string;
  branchName?: string;
  // Enhanced data for regeneration
  gitAnalysis?: GitChangeAnalysis;  // Complete git analysis for regeneration
  sessionData?: BlogSession;        // Original session data
  startCommit?: string;             // Start commit for git range
  endCommit?: string;               // End commit for git range
}

interface BlogPostsResponse {
  success: boolean;
  posts?: BlogPost[];
  post?: BlogPost;
  error?: string;
}

// KV Storage utility functions
const getBlogPostKey = (id: string): string => `blog:post:${id}`;
const getBlogPostListKey = (): string => 'blog:posts:list';

// Get all blog post IDs from the list
const getAllBlogPostIds = async (): Promise<string[]> => {
  try {
    const ids = await kv.get<string[]>(getBlogPostListKey());
    return ids || [];
  } catch (error) {
    console.warn('[BlogPosts] Error getting post IDs:', error);
    return [];
  }
};

// Add a blog post ID to the list
const addBlogPostToList = async (id: string): Promise<void> => {
  try {
    const currentIds = await getAllBlogPostIds();
    if (!currentIds.includes(id)) {
      currentIds.push(id);
      await kv.set(getBlogPostListKey(), currentIds);
    }
  } catch (error) {
    console.warn('[BlogPosts] Error adding post to list:', error);
  }
};

// Remove a blog post ID from the list
const removeBlogPostFromList = async (id: string): Promise<void> => {
  try {
    const currentIds = await getAllBlogPostIds();
    const filteredIds = currentIds.filter(postId => postId !== id);
    await kv.set(getBlogPostListKey(), filteredIds);
  } catch (error) {
    console.warn('[BlogPosts] Error removing post from list:', error);
  }
};

// Get a single blog post
const getBlogPost = async (id: string): Promise<BlogPost | null> => {
  try {
    const post = await kv.get<BlogPost>(getBlogPostKey(id));
    return post;
  } catch (error) {
    console.warn(`[BlogPosts] Error getting post ${id}:`, error);
    return null;
  }
};

// Save a blog post
const saveBlogPost = async (post: BlogPost): Promise<void> => {
  try {
    await kv.set(getBlogPostKey(post.metadata.id), post);
    await addBlogPostToList(post.metadata.id);
    console.log(`[BlogPosts] Saved blog post: ${post.metadata.id}`);
  } catch (error) {
    console.error(`[BlogPosts] Error saving post ${post.metadata.id}:`, error);
    throw error;
  }
};

// Delete a blog post
const deleteBlogPost = async (id: string): Promise<void> => {
  try {
    await kv.del(getBlogPostKey(id));
    await removeBlogPostFromList(id);
    console.log(`[BlogPosts] Deleted blog post: ${id}`);
  } catch (error) {
    console.error(`[BlogPosts] Error deleting post ${id}:`, error);
    throw error;
  }
};

// Main API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[BlogPosts] API call started, method:', req.method);

  try {
    switch (req.method) {
      case 'GET': {
        const { id } = req.query;

        if (id && typeof id === 'string') {
          // Get a specific blog post
          const post = await getBlogPost(id);
          if (post) {
            return res.status(200).json({
              success: true,
              post
            } as BlogPostsResponse);
          } else {
            return res.status(404).json({
              success: false,
              error: 'Blog post not found'
            } as BlogPostsResponse);
          }
        } else {
          // Get all blog posts
          const postIds = await getAllBlogPostIds();
          const posts: BlogPost[] = [];

          for (const postId of postIds) {
            const post = await getBlogPost(postId);
            if (post) {
              posts.push(post);
            }
          }

          // Sort by date (newest first) - handle mixed date formats
          posts.sort((a, b) => {
            const dateA = a.metadata.date ? new Date(a.metadata.date).getTime() : 0;
            const dateB = b.metadata.date ? new Date(b.metadata.date).getTime() : 0;
            
            // Handle invalid dates by treating them as very old
            const validDateA = isNaN(dateA) ? 0 : dateA;
            const validDateB = isNaN(dateB) ? 0 : dateB;
            
            return validDateB - validDateA;
          });

          return res.status(200).json({
            success: true,
            posts
          } as BlogPostsResponse);
        }
      }

      case 'POST': {
        const blogPost = req.body as BlogPost;

        // Validate required fields
        if (!blogPost.metadata?.id || !blogPost.metadata?.title || !blogPost.content) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: metadata.id, metadata.title, and content are required'
          } as BlogPostsResponse);
        }

        // Set timestamps
        const now = new Date().toISOString();
        blogPost.createdAt = blogPost.createdAt || now;
        blogPost.updatedAt = now;

        await saveBlogPost(blogPost);

        return res.status(201).json({
          success: true,
          post: blogPost
        } as BlogPostsResponse);
      }

      case 'PUT': {
        const { id } = req.query;
        const updates = req.body;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Blog post ID is required'
          } as BlogPostsResponse);
        }

        const existingPost = await getBlogPost(id);
        if (!existingPost) {
          return res.status(404).json({
            success: false,
            error: 'Blog post not found'
          } as BlogPostsResponse);
        }

        // Merge updates
        const updatedPost: BlogPost = {
          ...existingPost,
          ...updates,
          metadata: {
            ...existingPost.metadata,
            ...updates.metadata
          },
          updatedAt: new Date().toISOString()
        };

        await saveBlogPost(updatedPost);

        return res.status(200).json({
          success: true,
          post: updatedPost
        } as BlogPostsResponse);
      }

      case 'DELETE': {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Blog post ID is required'
          } as BlogPostsResponse);
        }

        const existingPost = await getBlogPost(id);
        if (!existingPost) {
          return res.status(404).json({
            success: false,
            error: 'Blog post not found'
          } as BlogPostsResponse);
        }

        await deleteBlogPost(id);

        return res.status(200).json({
          success: true
        } as BlogPostsResponse);
      }

      default: {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} Not Allowed`
        } as BlogPostsResponse);
      }
    }
  } catch (error: unknown) {
    console.error('[BlogPosts] API error:', error);
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    } as BlogPostsResponse);
  }
}

// Export types for use in other files
export type { BlogPostsResponse };