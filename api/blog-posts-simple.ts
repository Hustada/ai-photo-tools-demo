import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[BlogPosts] Request:', req.method, req.url);
  
  if (req.method === 'GET') {
    try {
      // Get all blog post IDs
      const ids = await kv.get<string[]>('blog:posts:list') || [];
      console.log('[BlogPosts] Found IDs:', ids.length);
      
      // Fetch all posts
      const posts = [];
      for (const id of ids) {
        const post = await kv.get(`blog:post:${id}`);
        if (post) {
          posts.push(post);
        }
      }
      
      console.log('[BlogPosts] Returning posts:', posts.length);
      return res.status(200).json(posts);
      
    } catch (error) {
      console.error('[BlogPosts] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}