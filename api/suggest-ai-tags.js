// api/suggest-ai-tags.js
// © 2025 Mark Hustad — MIT License

import https from 'https';

export default async function handler(event, context) {
  console.log('--- suggest-ai-tags function invoked ---');
  // In Vercel, `event` is the IncomingMessage (request) and `context` is ServerResponse (response).
  const httpMethod = event.method;
  const rawBody = event.body; // Vercel automatically parses JSON if Content-Type is correct.

  // Set CORS headers for all responses
  context.setHeader('Access-Control-Allow-Origin', '*'); // Be more specific in production
  context.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  context.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight request
  if (httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request.');
    context.status(204).end();
    return;
  }

  console.log(`Request Method: ${httpMethod}`);

  if (httpMethod !== 'POST') {
    console.log('Responding with 405 Method Not Allowed');
    context.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GOOGLE_CLOUD_VISION_API_KEY is not set.');
    context.status(500).json({ error: 'Server configuration error: API key missing.' });
    return;
  }

  let requestJsonBody;
  try {
    if (typeof rawBody === 'object' && rawBody !== null) {
      requestJsonBody = rawBody; 
      console.log('Request body already parsed by Vercel.');
    } else if (typeof rawBody === 'string' && rawBody.length > 0) {
      console.log('Attempting to parse string request body.');
      requestJsonBody = JSON.parse(rawBody);
    } else if (!rawBody) {
      console.error('ERROR: Request body is empty or undefined.');
      throw new Error('Request body is empty or undefined.');
    } else {
      console.error('ERROR: Request body is not a string or a parsed object. Type:', typeof rawBody);
      throw new Error('Request body is not a parsable string or a valid object.');
    }
  } catch (e) {
    console.error('ERROR parsing JSON body:', e.message);
    context.status(400).json({ error: 'Invalid JSON body', details: e.message });
    return;
  }

  const imageUrl = requestJsonBody.imageUrl;
  if (!imageUrl) {
    console.error('ERROR: Missing imageUrl in request body.');
    context.status(400).json({ error: 'Missing imageUrl in request body' });
    return;
  }
  console.log(`Image URL received: ${imageUrl}`);

  const visionApiPayload = {
    requests: [
      {
        image: {
          source: { imageUri: imageUrl },
        },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'WEB_DETECTION', maxResults: 5 }, // Added WEB_DETECTION
        ],
      },
    ],
  };

  const options = {
    hostname: 'vision.googleapis.com',
    path: `/v1/images:annotate?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
    },
    timeout: 25000, 
  };

  console.log('Attempting to call Google Vision API...');
  try {
    const visionResponseData = await new Promise((resolve, reject) => {
      console.log('Inside Promise: Making https.request to Google Vision API.');
      const reqHttps = https.request(options, (resHttps) => {
        let data = '';
        console.log(`Google Vision API Response Status: ${resHttps.statusCode}`);
        console.log('Google Vision API Response Headers:', JSON.stringify(resHttps.headers, null, 2));

        resHttps.on('data', (chunk) => {
          data += chunk;
          console.log(`Google Vision API: Received data chunk (length: ${chunk.length})`);
        });

        resHttps.on('end', () => {
          console.log('Google Vision API: Response stream ended.');
          if (resHttps.statusCode >= 200 && resHttps.statusCode < 300) {
            try {
              console.log('Google Vision API: Attempting to parse successful response.');
              const parsedData = JSON.parse(data);
              console.log('Google Vision API: Response parsed successfully.');
              resolve(parsedData);
            } catch (parseError) {
              console.error('ERROR parsing Google Vision API success response:', parseError.message, 'Data:', data);
              reject(new Error('Error parsing Google Vision API success response.'));
            }
          } else {
            console.error('ERROR from Google Vision API (on end):', `Status: ${resHttps.statusCode}`, 'Data:', data);
            reject(new Error(`Google Vision API responded with status ${resHttps.statusCode}. Response: ${data.substring(0, 200)}...`));
          }
        });

        resHttps.on('error', (resError) => {
          console.error('ERROR: Google Vision API response stream error:', resError.message);
          reject(new Error(`Google Vision API response stream error: ${resError.message}`));
        });
      });

      reqHttps.on('error', (reqError) => {
        console.error('ERROR: Google Vision API request error:', reqError.message);
        reject(new Error(`Google Vision API request error: ${reqError.message}`));
      });

      reqHttps.on('timeout', () => {
        console.error('ERROR: Google Vision API request timed out.');
        reqHttps.destroy(); 
        reject(new Error('Google Vision API request timed out.'));
      });

      console.log('Writing payload to Google Vision API request.');
      reqHttps.write(JSON.stringify(visionApiPayload));
      console.log('Ending Google Vision API request (reqHttps.end()).');
      reqHttps.end();
      console.log('After reqHttps.end() call.');
    });

    console.log('Google Vision API call promise resolved/rejected. Processing response.');
    // @ts-ignore
    const visionAnnotations = visionResponseData.responses[0];
    const labels = visionAnnotations?.labelAnnotations || [];
    // @ts-ignore
    const suggestedTags = labels.map(label => label.description).filter(Boolean);

    let suggestedDescription = '';
    const webDetection = visionAnnotations?.webDetection;
    if (webDetection && webDetection.bestGuessLabels && webDetection.bestGuessLabels.length > 0) {
      // Using the first best guess label as a primary description point.
      // You could also join multiple, or use webEntities for more detail.
      suggestedDescription = webDetection.bestGuessLabels[0]?.label || '';
      if (suggestedDescription) {
        // Capitalize the first letter
        suggestedDescription = suggestedDescription.charAt(0).toUpperCase() + suggestedDescription.slice(1);
      }
    }
    
    console.log(`Successfully retrieved and processed tags: ${suggestedTags.length} tags found.`);
    if (suggestedDescription) {
      console.log(`Suggested description: ${suggestedDescription}`);
    }

    context.status(200).json({ suggestedTags, suggestedDescription });
    return;

  } catch (error) {
    console.error('FATAL ERROR in Vision API processing:', error.message, error.stack);
    context.status(500).json({ error: 'Failed to get suggestions from Vision API.', details: error.message });
    return;
  }
}
