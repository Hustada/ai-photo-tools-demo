// © 2025 Mark Hustad — MIT License

import type { GenerateBlogImageRequest, GenerateBlogImageResponse } from '../../api/generate-blog-image';

export interface ImageGenerationOptions {
  style?: 'technical' | 'modern' | 'minimalist' | 'professional';
  forceRegenerate?: boolean;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  prompt?: string;
  error?: string;
  cached?: boolean;
}

// Check if we have a cached image via API (which checks KV storage)
const checkCachedImageViaAPI = async (
  blogId: string, 
  blogTitle: string, 
  blogDescription: string, 
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult | null> => {
  try {
    // Make a request to the API which will check KV cache first
    const response = await fetch('/api/generate-blog-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blogId,
        blogTitle,
        blogDescription,
        style: options.style || 'technical'
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          imageUrl: result.imageUrl,
          localPath: result.localPath,
          prompt: result.prompt,
          cached: result.cached || false
        };
      }
    }
    return null;
  } catch (error) {
    console.warn(`[ImageGeneration] Error checking cached image for ${blogId}:`, error);
    return null;
  }
};

// Generate a hero image for a blog post using ChatGPT/DALL-E
export const generateBlogHeroImage = async (
  blogId: string,
  blogTitle: string,
  blogDescription: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> => {
  try {
    console.log(`[ImageGeneration] Starting image generation for blog: ${blogId}`);

    // The API will automatically check KV cache first and return cached result if available
    // We always call the API since it handles caching internally
    const result = await checkCachedImageViaAPI(blogId, blogTitle, blogDescription, options);
    
    if (result) {
      if (result.cached) {
        console.log(`[ImageGeneration] Using cached image from KV for blog: ${blogId}`);
      } else {
        console.log(`[ImageGeneration] Generated new image for blog: ${blogId}`);
      }
      return result;
    }

    // If we get here, something went wrong
    throw new Error('Failed to generate or retrieve image from API');

  } catch (error: unknown) {
    console.error(`[ImageGeneration] Error generating image for blog ${blogId}:`, error);
    
    const errorResult: ImageGenerationResult = {
      success: false,
      error: (error as Error).message || 'Failed to generate blog hero image',
      cached: false
    };

    return errorResult;
  }
};

// Batch generate images for multiple blog posts
export const generateMultipleBlogImages = async (
  blogPosts: Array<{
    id: string;
    title: string;
    description: string;
  }>,
  options: ImageGenerationOptions = {}
): Promise<Map<string, ImageGenerationResult>> => {
  console.log(`[ImageGeneration] Starting batch generation for ${blogPosts.length} blog posts`);

  const results = new Map<string, ImageGenerationResult>();
  const promises = blogPosts.map(async (post) => {
    try {
      const result = await generateBlogHeroImage(
        post.id,
        post.title,
        post.description,
        options
      );
      results.set(post.id, result);
    } catch (error: unknown) {
      console.error(`[ImageGeneration] Failed to generate image for ${post.id}:`, error);
      results.set(post.id, {
        success: false,
        error: (error as Error).message,
        cached: false
      });
    }
  });

  await Promise.allSettled(promises);

  const successCount = Array.from(results.values()).filter(r => r.success).length;
  console.log(`[ImageGeneration] Batch generation complete: ${successCount}/${blogPosts.length} successful`);

  return results;
};

// Preload images for better user experience
export const preloadBlogImages = (imageUrls: string[]): Promise<void[]> => {
  console.log(`[ImageGeneration] Preloading ${imageUrls.length} blog images`);

  const preloadPromises = imageUrls.map((url) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log(`[ImageGeneration] Preloaded image: ${url}`);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[ImageGeneration] Failed to preload image: ${url}`);
        reject(new Error(`Failed to preload ${url}`));
      };
      img.src = url;
    });
  });

  return Promise.allSettled(preloadPromises) as Promise<void[]>;
};

// Note: Image caching is now handled by KV storage in the API
// These functions are maintained for backward compatibility but delegate to the API

// Utility function to create a fallback image URL
export const getFallbackImageUrl = (): string => {
  // Return a placeholder or default hero image
  return `/blog-images/default-hero.jpg`;
};

// Check if an image exists (useful for error handling)
export const checkImageExists = async (imageUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn(`[ImageGeneration] Failed to check image existence: ${imageUrl}`, error);
    return false;
  }
};