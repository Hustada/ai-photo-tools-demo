// © 2025 Mark Hustad — MIT License

import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('[ListImages] Scanning source-images directory...');
    
    // Get the source-images directory path
    const sourceImagesPath = path.join(process.cwd(), 'source-images');
    console.log('[ListImages] Scanning path:', sourceImagesPath);
    
    // Check if directory exists
    if (!fs.existsSync(sourceImagesPath)) {
      console.error('[ListImages] Source images directory not found:', sourceImagesPath);
      return res.status(404).json({ 
        error: 'Source images directory not found',
        path: sourceImagesPath 
      });
    }

    // Read directory contents
    const files = fs.readdirSync(sourceImagesPath);
    console.log('[ListImages] Found files:', files.length);
    
    // Filter for image files (jpg, jpeg, png, webp)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    }).sort(); // Sort alphabetically
    
    console.log('[ListImages] Image files found:', imageFiles.length);
    console.log('[ListImages] Files:', imageFiles.slice(0, 10)); // Log first 10 files
    
    // Return the list of image files
    return res.status(200).json({
      images: imageFiles,
      total: imageFiles.length,
      path: sourceImagesPath
    });

  } catch (error: any) {
    console.error('[ListImages] Error scanning directory:', error);
    return res.status(500).json({ 
      error: 'Failed to scan images directory', 
      details: error.message 
    });
  }
}