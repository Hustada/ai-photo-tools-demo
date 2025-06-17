import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy TensorFlow Hub models to avoid CORS issues
 * Allows loading models from tfhub.dev through our own API
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET and OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { modelUrl } = req.query;

  if (!modelUrl || typeof modelUrl !== 'string') {
    return res.status(400).json({ error: 'modelUrl parameter is required' });
  }

  // Validate that it's a TensorFlow Hub URL for security
  const allowedHosts = [
    'tfhub.dev',
    'storage.googleapis.com',
    'www.kaggle.com'
  ];

  let url: URL;
  try {
    url = new URL(modelUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!allowedHosts.includes(url.hostname)) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  try {
    console.log(`[ModelProxy] Proxying request to: ${modelUrl}`);
    
    // For TensorFlow Hub models, we need to handle the model.json and manifest
    let actualUrl = modelUrl;
    
    // If it's a TensorFlow Hub URL without specific file, append model.json
    if (url.hostname === 'tfhub.dev' && !modelUrl.includes('model.json') && !modelUrl.includes('.bin')) {
      actualUrl = `${modelUrl}/model.json?tf-hub-format=compressed`;
    }
    
    const response = await fetch(actualUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TensorFlow.js model loader)',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error(`[ModelProxy] Failed to fetch ${actualUrl}: ${response.status}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch model: ${response.statusText}` 
      });
    }

    // Get content type from the original response
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // Set CORS headers to allow cross-origin requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', contentType);

    // For JSON responses, we need to modify URLs to go through our proxy
    if (contentType.includes('application/json')) {
      const jsonData = await response.text();
      console.log(`[ModelProxy] Processing JSON response, length: ${jsonData.length}`);
      
      try {
        const modelJson = JSON.parse(jsonData);
        
        // Modify weightsManifest URLs to go through our proxy
        if (modelJson.weightsManifest) {
          modelJson.weightsManifest.forEach((manifest: any) => {
            if (manifest.paths) {
              manifest.paths = manifest.paths.map((path: string) => {
                const fullUrl = new URL(path, actualUrl).href;
                return `/api/tensorflow-model-proxy?modelUrl=${encodeURIComponent(fullUrl)}`;
              });
            }
          });
        }
        
        res.json(modelJson);
      } catch (parseError) {
        console.error('[ModelProxy] Failed to parse JSON:', parseError);
        res.send(jsonData); // Send as-is if parsing fails
      }
    } else {
      // For binary files (weights), just proxy them
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error('[ModelProxy] Error proxying request:', error);
    res.status(500).json({ 
      error: 'Failed to proxy model request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}