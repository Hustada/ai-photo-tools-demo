// © 2025 Mark Hustad — MIT License
// scripts/index-photos.ts - Index photos into Pinecone for chat search

import dotenv from 'dotenv';
import { upsertPhotos, PhotoMetadata } from '../src/utils/pinecone';
import type { Photo } from '../src/types';

// Load environment variables
dotenv.config();

// Fetch real photos from CompanyCam API
async function fetchPhotosFromCompanyCam(limit: number = 1000, projectId?: string): Promise<Photo[]> {
  const apiKey = process.env.COMPANYCAM_API_KEY || process.env.VITE_APP_COMPANYCAM_API_KEY;
  if (!apiKey) {
    throw new Error('COMPANYCAM_API_KEY or VITE_APP_COMPANYCAM_API_KEY environment variable is required');
  }
  
  console.log('Fetching real photos from CompanyCam API...');
  
  try {
    // Build URL with optional project filter
    let url = `https://api.companycam.com/v2/photos?per_page=${Math.min(limit, 100)}`;
    if (projectId) {
      url += `&project_id=${projectId}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response type:', typeof data, 'isArray:', Array.isArray(data));
    console.log('API Response sample:', JSON.stringify(data, null, 2).slice(0, 500));
    
    // CompanyCam API returns array directly, not wrapped in data property
    const photos = Array.isArray(data) ? data : (data.data || []);
    
    // Fetch tags for each photo
    const photosWithTags = await Promise.all(photos.map(async (photo: Photo) => {
      try {
        const tagsResponse = await fetch(`https://api.companycam.com/v2/photos/${photo.id}/tags`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        });
        
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          console.log(`Tags for photo ${photo.id}:`, JSON.stringify(tagsData).slice(0, 200));
          photo.tags = Array.isArray(tagsData) ? tagsData : (tagsData.data || []);
        } else {
          console.log(`Failed to fetch tags for photo ${photo.id}: ${tagsResponse.status}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch tags for photo ${photo.id}:`, error);
      }
      
      return photo;
    }));
    
    console.log(`Fetched ${photosWithTags.length} photos from CompanyCam`);
    return photosWithTags;
  } catch (error) {
    console.error('Error fetching photos from CompanyCam:', error);
    throw error;
  }
}

// Mock function to get photos - fallback for testing
async function fetchMockPhotos(): Promise<Photo[]> {
  console.log('Using mock data for testing.');
  
  // Example mock photos for testing - matching CompanyCam Photo type structure
  const mockPhotos: Photo[] = [
    {
      id: 'photo_001',
      company_id: 'company_123',
      creator_id: 'user_001',
      creator_type: 'User',
      creator_name: 'John Doe',
      project_id: '83951011',
      processing_status: 'processed',
      coordinates: [],
      uris: [
        { type: 'original', uri: 'https://example.com/photo1.jpg', url: 'https://example.com/photo1.jpg' },
        { type: 'web', uri: 'https://example.com/photo1_web.jpg', url: 'https://example.com/photo1_web.jpg' },
        { type: 'thumbnail', uri: 'https://example.com/photo1_thumb.jpg', url: 'https://example.com/photo1_thumb.jpg' },
      ],
      hash: 'abc123',
      description: 'Large crack in foundation wall, approximately 3 inches wide',
      internal: false,
      photo_url: 'https://example.com/photo1.jpg',
      captured_at: new Date('2024-03-15T10:30:00Z').getTime() / 1000,
      created_at: new Date('2024-03-15T10:30:00Z').getTime() / 1000,
      updated_at: new Date('2024-03-15T10:30:00Z').getTime() / 1000,
      tags: [
        { id: 'tag_001', company_id: 'company_123', display_value: 'Foundation', value: 'foundation', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_002', company_id: 'company_123', display_value: 'Crack', value: 'crack', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_003', company_id: 'company_123', display_value: 'Structural', value: 'structural', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
      ],
    },
    {
      id: 'photo_002',
      company_id: 'company_123',
      creator_id: 'user_002',
      creator_type: 'User',
      creator_name: 'Jane Smith',
      project_id: '83951011',
      processing_status: 'processed',
      coordinates: [],
      uris: [
        { type: 'original', uri: 'https://example.com/photo2.jpg', url: 'https://example.com/photo2.jpg' },
        { type: 'web', uri: 'https://example.com/photo2_web.jpg', url: 'https://example.com/photo2_web.jpg' },
        { type: 'thumbnail', uri: 'https://example.com/photo2_thumb.jpg', url: 'https://example.com/photo2_thumb.jpg' },
      ],
      hash: 'def456',
      description: 'Missing shingles on north side of roof after storm',
      internal: false,
      photo_url: 'https://example.com/photo2.jpg',
      captured_at: new Date('2024-03-20T14:15:00Z').getTime() / 1000,
      created_at: new Date('2024-03-20T14:15:00Z').getTime() / 1000,
      updated_at: new Date('2024-03-20T14:15:00Z').getTime() / 1000,
      tags: [
        { id: 'tag_004', company_id: 'company_123', display_value: 'Roofing', value: 'roofing', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_005', company_id: 'company_123', display_value: 'Shingles', value: 'shingles', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_006', company_id: 'company_123', display_value: 'Damage', value: 'damage', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
      ],
    },
    {
      id: 'photo_003',
      company_id: 'company_123',
      creator_id: 'user_001',
      creator_type: 'User',
      creator_name: 'John Doe',
      project_id: '83951011',
      processing_status: 'processed',
      coordinates: [],
      uris: [
        { type: 'original', uri: 'https://example.com/photo3.jpg', url: 'https://example.com/photo3.jpg' },
        { type: 'web', uri: 'https://example.com/photo3_web.jpg', url: 'https://example.com/photo3_web.jpg' },
        { type: 'thumbnail', uri: 'https://example.com/photo3_thumb.jpg', url: 'https://example.com/photo3_thumb.jpg' },
      ],
      hash: 'ghi789',
      description: 'Water damage under bathroom sink from leaking pipe',
      internal: false,
      photo_url: 'https://example.com/photo3.jpg',
      captured_at: new Date('2024-04-01T09:00:00Z').getTime() / 1000,
      created_at: new Date('2024-04-01T09:00:00Z').getTime() / 1000,
      updated_at: new Date('2024-04-01T09:00:00Z').getTime() / 1000,
      tags: [
        { id: 'tag_007', company_id: 'company_123', display_value: 'Plumbing', value: 'plumbing', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_008', company_id: 'company_123', display_value: 'Leak', value: 'leak', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
        { id: 'tag_009', company_id: 'company_123', display_value: 'Bathroom', value: 'bathroom', created_at: Date.now() / 1000, updated_at: Date.now() / 1000 },
      ],
    },
  ];
  
  return mockPhotos;
}

// Convert Photo to PhotoMetadata for Pinecone
function photoToMetadata(photo: Photo, projectName?: string): PhotoMetadata {
  // Extract tag values from Tag objects
  const tagValues = photo.tags?.map(tag => tag.value) || [];
  
  // Get URLs from uris or construct from ID
  const originalUri = photo.uris?.find(uri => uri.type === 'original');
  const thumbnailUri = photo.uris?.find(uri => uri.type === 'thumbnail');
  
  // CompanyCam photos have a URL pattern
  const photoUrl = photo.photo_url || originalUri?.uri || `https://app.companycam.com/assets/Image/${photo.id}`;
  const thumbnailUrl = thumbnailUri?.uri || `https://img.companycam.com/nvKGzvf4El8J1KwxYypfDfUA_Obggalg4CcCvwcqE2A/rs:fit:250:250/q:80/aHR0cHM6Ly9jb21w/YW55Y2FtLXBlbmRp/bmcuczMuYW1hem9u/YXdzLmNvbS8yYTJk/MzZmZC1mNjdlLTRh/MWMtODVmNS0xOTRh/OGJmM2M3ZjEuanBn.jpg`;
  
  return {
    id: photo.id,
    project_id: photo.project_id,
    project_name: projectName,
    description: photo.description || '',
    tags: tagValues,
    captured_at: typeof photo.captured_at === 'number' ? photo.captured_at : Date.now() / 1000,
    creator_id: photo.creator_id,
    creator_name: photo.creator_name,
    url: photoUrl,
    thumbnail_url: thumbnailUrl,
    // Note: width and height are not in the Photo type, so we'll omit them
  };
}

async function indexPhotos() {
  console.log('Starting photo indexing process...');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const projectIdArg = args.find(arg => arg.startsWith('--project='));
  const projectId = projectIdArg ? projectIdArg.split('=')[1] : undefined;
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  
  if (projectId) {
    console.log(`Filtering photos for project ID: ${projectId}`);
  }
  console.log(`Limiting to ${limit} photos`);
  
  try {
    // Try to fetch real photos first, fall back to mock if no API key
    let photos: Photo[];
    const useMock = args.includes('--mock');
    
    if (useMock) {
      console.log('Using mock data as requested');
      photos = await fetchMockPhotos();
    } else {
      try {
        photos = await fetchPhotosFromCompanyCam(limit, projectId);
        // If real photos have no tags/descriptions, warn the user
        const hasContent = photos.some(p => p.tags?.length > 0 || p.description);
        if (!hasContent && photos.length > 0) {
          console.warn('\n⚠️  WARNING: Real photos have no tags or descriptions!');
          console.warn('Photos without tags/descriptions cannot be searched effectively.');
          console.warn('Consider using --mock flag to test with tagged photos.\n');
        }
      } catch (error: any) {
        if (error.message.includes('COMPANYCAM_API_KEY')) {
          console.log('No API key found, falling back to mock data for testing');
          photos = await fetchMockPhotos();
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Fetched ${photos.length} photos to index`);
    
    if (photos.length === 0) {
      console.log('No photos to index');
      return;
    }
    
    // Convert to metadata format
    console.log('First photo sample:', JSON.stringify(photos[0], null, 2).slice(0, 500));
    const photoMetadata = photos.map(photo => 
      photoToMetadata(photo, `Project ${photo.project_id}`) // In production, fetch actual project names
    );
    console.log('First metadata sample:', JSON.stringify(photoMetadata[0], null, 2));
    
    // Index in batches
    const batchSize = 50;
    for (let i = 0; i < photoMetadata.length; i += batchSize) {
      const batch = photoMetadata.slice(i, i + batchSize);
      console.log(`Indexing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(photoMetadata.length / batchSize)} (${batch.length} photos)...`);
      
      await upsertPhotos(batch);
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < photoMetadata.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Successfully indexed ${photos.length} photos`);
    
  } catch (error) {
    console.error('Error indexing photos:', error);
    process.exit(1);
  }
}

// Run the indexing
indexPhotos().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});