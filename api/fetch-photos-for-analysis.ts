// © 2025 Mark Hustad — MIT License
// API endpoint to fetch CompanyCam photos with comprehensive metadata for duplicate analysis

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';

interface PhotoAnalysisRequest {
  page?: number;
  perPage?: number;
  projectId?: string;
  maxPhotos?: number;
}

interface PhotoMetadata {
  id: string;
  photo_url: string;
  uris: Array<{
    type: string;
    uri: string;
    url: string;
  }>;
  captured_at: number;
  created_at: number;
  updated_at: number;
  coordinates: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
  }>;
  hash: string;
  description: string | null;
  creator_id: string;
  creator_name: string;
  project_id: string;
  company_id: string;
  processing_status: string;
  internal: boolean;
}

interface PhotoAnalysisResponse {
  photos: PhotoMetadata[];
  totalFetched: number;
  fetchedPages: number;
  metadata: {
    fetchTime: string;
    apiSource: 'CompanyCam API v2';
    rateLimitStatus: {
      requestsMade: number;
      timeWindow: string;
    };
  };
}

// Rate limiting tracker
let requestCount = 0;
let windowStart = Date.now();
const RATE_LIMIT = 30; // requests per minute
const WINDOW_MS = 60000; // 1 minute

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    // Reset window
    requestCount = 0;
    windowStart = now;
  }
  return requestCount < RATE_LIMIT;
}

function recordRequest(): void {
  requestCount++;
}

// Helper function to make CompanyCam API request
async function fetchPhotosFromAPI(
  apiKey: string,
  page: number = 1,
  perPage: number = 50,
  projectId?: string
): Promise<PhotoMetadata[]> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      sort: '-captured_at', // Sort by capture time (newest first)
    });

    if (projectId) {
      params.append('project_id', projectId);
    }

    const options = {
      hostname: 'api.companycam.com',
      path: `/v2/photos?${params.toString()}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-CompanyCam-Source': 'cc-ai-photo-analysis-backend;vercel-serverless',
      },
    };

    console.log(`[PhotoAnalysis] Fetching photos - Page ${page}, Per Page ${perPage}, Project: ${projectId || 'All'}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        recordRequest();
        
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const photos: PhotoMetadata[] = JSON.parse(data);
            console.log(`[PhotoAnalysis] Successfully fetched ${photos.length} photos from page ${page}`);
            resolve(photos);
          } catch (e) {
            console.error('[PhotoAnalysis] Error parsing photos response:', e);
            reject(new Error(`Failed to parse photos response: ${e}`));
          }
        } else {
          console.error(`[PhotoAnalysis] API error - Status: ${res.statusCode}, Response: ${data}`);
          reject(new Error(`CompanyCam API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[PhotoAnalysis] Request error:', err);
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[PhotoAnalysis] Request timed out');
      reject(new Error('Request timed out'));
    });

    req.setTimeout(30000); // 30 second timeout
    req.end();
  });
}

// Main handler function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Get API key from environment
  const apiKey = process.env.VITE_APP_COMPANYCAM_API_KEY || process.env.COMPANYCAM_API_KEY;
  if (!apiKey) {
    console.error('[PhotoAnalysis] CompanyCam API key not configured');
    return res.status(500).json({ error: 'Server configuration error: CompanyCam API key missing' });
  }

  try {
    const requestBody: PhotoAnalysisRequest = req.body || {};
    const {
      page = 1,
      perPage = 50,
      projectId,
      maxPhotos = 100
    } = requestBody;

    console.log(`[PhotoAnalysis] Starting photo fetch - Max Photos: ${maxPhotos}, Project: ${projectId || 'All'}`);

    // Check rate limit
    if (!checkRateLimit()) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please wait before making more requests.',
        retryAfter: Math.ceil((WINDOW_MS - (Date.now() - windowStart)) / 1000)
      });
    }

    const startTime = Date.now();
    const allPhotos: PhotoMetadata[] = [];
    let currentPage = page;
    let fetchedPages = 0;

    // Fetch photos in batches until we reach maxPhotos or no more photos
    while (allPhotos.length < maxPhotos) {
      const photosPerPage = Math.min(perPage, maxPhotos - allPhotos.length);
      
      try {
        const pagePhotos = await fetchPhotosFromAPI(apiKey, currentPage, photosPerPage, projectId);
        
        if (pagePhotos.length === 0) {
          console.log(`[PhotoAnalysis] No more photos found at page ${currentPage}`);
          break;
        }

        allPhotos.push(...pagePhotos);
        fetchedPages++;
        currentPage++;

        // Rate limiting: wait between requests if needed
        if (allPhotos.length < maxPhotos && pagePhotos.length === photosPerPage) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error) {
        console.error(`[PhotoAnalysis] Error fetching page ${currentPage}:`, error);
        break; // Stop fetching on error, return what we have
      }
    }

    const response: PhotoAnalysisResponse = {
      photos: allPhotos.slice(0, maxPhotos), // Ensure we don't exceed maxPhotos
      totalFetched: allPhotos.length,
      fetchedPages,
      metadata: {
        fetchTime: new Date().toISOString(),
        apiSource: 'CompanyCam API v2',
        rateLimitStatus: {
          requestsMade: requestCount,
          timeWindow: `${WINDOW_MS}ms`
        }
      }
    };

    console.log(`[PhotoAnalysis] Successfully fetched ${response.totalFetched} photos in ${Date.now() - startTime}ms`);
    res.status(200).json(response);

  } catch (error: any) {
    console.error('[PhotoAnalysis] Error in photo analysis pipeline:', error);
    res.status(500).json({ 
      error: 'Failed to fetch photos for analysis', 
      details: error.message 
    });
  }
}