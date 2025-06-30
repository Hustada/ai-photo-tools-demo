// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateBlogImageRequest {
  blogTitle: string;
  blogDescription: string;
  blogId: string;
  style?: 'technical' | 'modern' | 'minimalist' | 'professional';
}

interface GenerateBlogImageResponse {
  success: boolean;
  imageUrl?: string;
  localPath?: string;
  prompt?: string;
  error?: string;
  cached?: boolean;
}

interface StoredImageData {
  blogId: string;
  imageUrl: string;
  localPath: string;
  prompt: string;
  style: string;
  createdAt: string;
  blogTitle: string;
  blogDescription: string;
}

// Download image from URL and save locally
const downloadImage = async (imageUrl: string, localPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    
    https.get(imageUrl, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(localPath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// KV Storage utility functions
const getImageCacheKey = (blogId: string, style: string): string => {
  return `blog:image:${blogId}:${style}`;
};

const getCachedImage = async (blogId: string, style: string): Promise<StoredImageData | null> => {
  try {
    const key = getImageCacheKey(blogId, style);
    const cached = await kv.get<StoredImageData>(key);
    if (cached) {
      console.log(`[GenerateBlogImage] Found cached image for: ${blogId}`);
      return cached;
    }
    return null;
  } catch (error) {
    console.warn(`[GenerateBlogImage] Error retrieving cached image for ${blogId}:`, error);
    return null;
  }
};

const storeCachedImage = async (imageData: StoredImageData): Promise<void> => {
  try {
    const key = getImageCacheKey(imageData.blogId, imageData.style);
    await kv.set(key, imageData);
    console.log(`[GenerateBlogImage] Cached image data for: ${imageData.blogId}`);
  } catch (error) {
    console.warn(`[GenerateBlogImage] Error caching image for ${imageData.blogId}:`, error);
  }
};

// Generate a descriptive prompt for the blog hero image
const generateImagePrompt = (title: string, description: string, style: string = 'technical'): string => {
  const basePrompts = {
    technical: 'A clean, modern technical illustration with subtle technology elements',
    modern: 'A sleek, contemporary design with bold geometric shapes',
    minimalist: 'A minimal, clean design with plenty of white space',
    professional: 'A sophisticated, professional design suitable for corporate settings'
  };

  const techKeywords = [
    'code', 'development', 'programming', 'software', 'algorithm', 'data',
    'performance', 'optimization', 'testing', 'architecture', 'system',
    'component', 'framework', 'library', 'api', 'database', 'cloud'
  ];

  // Extract technical keywords from title and description
  const content = `${title} ${description}`.toLowerCase();
  const foundKeywords = techKeywords.filter(keyword => content.includes(keyword));

  const stylePrompt = basePrompts[style as keyof typeof basePrompts] || basePrompts.technical;
  
  let prompt = `${stylePrompt}, featuring `;

  // Customize based on detected technical concepts
  if (foundKeywords.includes('performance') || foundKeywords.includes('optimization')) {
    prompt += 'performance graphs, speed indicators, and efficiency symbols, ';
  } else if (foundKeywords.includes('testing') || foundKeywords.includes('development')) {
    prompt += 'code elements, testing symbols, and development tools, ';
  } else if (foundKeywords.includes('architecture') || foundKeywords.includes('system')) {
    prompt += 'system diagrams, architectural blueprints, and structural elements, ';
  } else if (foundKeywords.includes('data') || foundKeywords.includes('algorithm')) {
    prompt += 'data visualization, algorithmic patterns, and information flow, ';
  } else {
    prompt += 'abstract technology patterns, coding symbols, and digital elements, ';
  }

  prompt += `using a color palette of orange (#ff6b35), dark gray (#374151), and white. `;
  prompt += `The image should be 16:9 aspect ratio, professional quality, suitable for a technical blog header. `;
  prompt += `No text or typography in the image. Clean, modern aesthetic that conveys innovation and technical expertise.`;

  return prompt;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GenerateBlogImage] API call started');

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { blogTitle, blogDescription, blogId, style }: GenerateBlogImageRequest = req.body;

    // Validate required fields
    if (!blogTitle || !blogDescription || !blogId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: blogTitle, blogDescription, and blogId are required.'
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[GenerateBlogImage] OpenAI API key not configured');
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const imageStyle = style || 'technical';
    console.log(`[GenerateBlogImage] Processing request for blog: ${blogId}, style: ${imageStyle}`);

    // Check KV cache first
    const cachedImage = await getCachedImage(blogId, imageStyle);
    if (cachedImage) {
      console.log(`[GenerateBlogImage] Returning cached image for blog: ${blogId}`);
      return res.status(200).json({
        success: true,
        imageUrl: cachedImage.imageUrl,
        localPath: cachedImage.localPath,
        prompt: cachedImage.prompt,
        cached: true
      } as GenerateBlogImageResponse);
    }

    console.log(`[GenerateBlogImage] No cached image found, generating new image for blog: ${blogId}`);

    // Generate the image prompt
    const imagePrompt = generateImagePrompt(blogTitle, blogDescription, style);
    console.log(`[GenerateBlogImage] Generated prompt: ${imagePrompt}`);

    // Generate image with DALL-E
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024", // 16:9 aspect ratio
      quality: "standard", // Use "hd" for higher quality if budget allows
      style: "natural" // More photorealistic style
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log(`[GenerateBlogImage] Image generated successfully: ${imageUrl}`);

    // Create public/blog-images directory if it doesn't exist
    const blogImagesDir = path.join(process.cwd(), 'public', 'blog-images');
    if (!fs.existsSync(blogImagesDir)) {
      fs.mkdirSync(blogImagesDir, { recursive: true });
      console.log(`[GenerateBlogImage] Created directory: ${blogImagesDir}`);
    }

    // Download and save the image locally
    const localFileName = `${blogId}-hero.jpg`;
    const localPath = path.join(blogImagesDir, localFileName);
    
    try {
      await downloadImage(imageUrl, localPath);
      console.log(`[GenerateBlogImage] Image saved locally: ${localPath}`);
    } catch (downloadError) {
      console.warn(`[GenerateBlogImage] Failed to save image locally:`, downloadError);
      // Continue without local save - return the OpenAI URL
    }

    const publicUrl = `/blog-images/${localFileName}`;

    // Store the image data in KV cache for future requests
    const imageData: StoredImageData = {
      blogId,
      imageUrl: publicUrl,
      localPath: localPath,
      prompt: imagePrompt,
      style: imageStyle,
      createdAt: new Date().toISOString(),
      blogTitle,
      blogDescription
    };

    await storeCachedImage(imageData);

    return res.status(200).json({
      success: true,
      imageUrl: publicUrl,
      localPath: localPath,
      prompt: imagePrompt,
      cached: false
    } as GenerateBlogImageResponse);

  } catch (error: unknown) {
    console.error('[GenerateBlogImage] Error generating image:', error);
    
    // Handle specific OpenAI errors
    const openAIError = error as { type?: string; message?: string };
    
    if (openAIError.type === 'insufficient_quota') {
      return res.status(429).json({
        success: false,
        error: 'OpenAI quota exceeded. Please try again later.'
      });
    }
    
    if (openAIError.type === 'invalid_request_error') {
      return res.status(400).json({
        success: false,
        error: `Invalid request: ${openAIError.message || 'Unknown error'}`
      });
    }

    return res.status(500).json({
      success: false,
      error: `Failed to generate image: ${openAIError.message || 'Unknown error'}`
    } as GenerateBlogImageResponse);
  }
}

// Export types for use in other files
export type { GenerateBlogImageRequest, GenerateBlogImageResponse };