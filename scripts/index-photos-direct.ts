#!/usr/bin/env tsx
import { config } from 'dotenv';
import { kv } from '@vercel/kv';
import { upsertPhotos, type PhotoMetadata } from '../src/utils/pinecone';
import type { Photo, Tag } from '../src/types';

// Load environment variables
config();

interface PhotoAiEnhancement {
  photo_id: string;
  user_id: string;
  ai_description?: string | null;
  accepted_ai_tags: string[];
  suggestion_source?: string;
  created_at: string;
  updated_at: string;
}

// Fetch photos from CompanyCam API
async function fetchPhotosFromCompanyCam(limit: number = 100, projectId?: string): Promise<Photo[]> {
  const apiKey = process.env.COMPANYCAM_API_KEY || process.env.VITE_APP_COMPANYCAM_API_KEY;
  if (!apiKey) {
    throw new Error('COMPANYCAM_API_KEY or VITE_APP_COMPANYCAM_API_KEY environment variable is required');
  }
  
  console.log('Fetching photos from CompanyCam API...');
  
  try {
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
          const tags = Array.isArray(tagsData) ? tagsData : (tagsData.data || []);
          photo.tags = tags.map((tag: any) => ({
            ...tag,
            id: tag.id.toString(),
            isAiEnhanced: false,
          }));
        } else {
          photo.tags = [];
        }
      } catch (error) {
        console.warn(`Failed to fetch tags for photo ${photo.id}:`, error);
        photo.tags = [];
      }
      
      return photo;
    }));
    
    return photosWithTags;
  } catch (error) {
    console.error('Error fetching photos:', error);
    throw error;
  }
}

// Fetch AI enhancement from Vercel KV
async function fetchAiEnhancement(photoId: string): Promise<PhotoAiEnhancement | null> {
  try {
    const key = `photo_enhancement:${photoId}`;
    const enhancement = await kv.get<PhotoAiEnhancement>(key);
    return enhancement;
  } catch (error) {
    console.warn(`Failed to fetch AI enhancement for photo ${photoId}:`, error);
    return null;
  }
}

// Convert Photo with AI enhancements to PhotoMetadata
async function photoToEnhancedMetadata(photo: Photo): Promise<PhotoMetadata> {
  // Fetch AI enhancement
  const aiEnhancement = await fetchAiEnhancement(photo.id);
  
  // Get existing tags
  const existingTags = photo.tags?.map(tag => tag.value || tag.display_value) || [];
  
  // Apply AI enhancements
  let description = photo.description || '';
  let allTags = [...existingTags];
  
  if (aiEnhancement) {
    // Use AI description if available
    if (aiEnhancement.ai_description) {
      description = aiEnhancement.ai_description;
    }
    
    // Add AI tags
    if (aiEnhancement.accepted_ai_tags && aiEnhancement.accepted_ai_tags.length > 0) {
      // Add AI tags that don't already exist
      aiEnhancement.accepted_ai_tags.forEach(aiTag => {
        if (!allTags.some(t => t.toLowerCase() === aiTag.toLowerCase())) {
          allTags.push(aiTag);
        }
      });
    }
    
    console.log(`  Photo ${photo.id} has AI enhancements: ${aiEnhancement.accepted_ai_tags.length} tags, ${aiEnhancement.ai_description ? 'with' : 'no'} description`);
  }
  
  // Get URLs
  const originalUri = photo.uris?.find(uri => uri.type === 'original');
  const thumbnailUri = photo.uris?.find(uri => uri.type === 'thumbnail');
  const photoUrl = photo.photo_url || originalUri?.uri || `https://app.companycam.com/assets/Image/${photo.id}`;
  const thumbnailUrl = thumbnailUri?.uri || photoUrl;
  
  // Get project info
  const projectName = `Project ${photo.project_id}`;
  
  return {
    id: photo.id,
    project_id: photo.project_id,
    project_name: projectName,
    description,
    tags: allTags,
    captured_at: typeof photo.captured_at === 'number' ? photo.captured_at : Date.now() / 1000,
    creator_id: photo.creator_id,
    creator_name: photo.creator_name,
    url: photoUrl,
    thumbnail_url: thumbnailUrl,
  };
}

async function indexPhotosWithEnhancements() {
  console.log('Starting direct photo indexing with AI enhancements...\n');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const projectIdArg = args.find(arg => arg.startsWith('--project='));
  const projectId = projectIdArg ? projectIdArg.split('=')[1] : undefined;
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  
  if (projectId) {
    console.log(`Filtering photos for project ID: ${projectId}`);
  }
  console.log(`Limiting to ${limit} photos\n`);
  
  try {
    // Fetch photos from CompanyCam
    const photos = await fetchPhotosFromCompanyCam(limit, projectId);
    console.log(`Fetched ${photos.length} photos from CompanyCam\n`);
    
    if (photos.length === 0) {
      console.log('No photos to index');
      return;
    }
    
    // Process each photo with AI enhancements
    console.log('Processing photos with AI enhancements...');
    const photoMetadata: PhotoMetadata[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`\nProcessing photo ${i + 1}/${photos.length} (ID: ${photo.id})`);
      
      const metadata = await photoToEnhancedMetadata(photo);
      
      // Log sample data for first few photos
      if (i < 3) {
        console.log(`  Description: ${metadata.description?.slice(0, 100)}${metadata.description?.length > 100 ? '...' : ''}`);
        console.log(`  Tags: ${metadata.tags?.join(', ') || 'none'}`);
      }
      
      photoMetadata.push(metadata);
    }
    
    // Count photos with content
    const photosWithContent = photoMetadata.filter(p => 
      (p.description && p.description.length > 0) || 
      (p.tags && p.tags.length > 0)
    );
    console.log(`\n${photosWithContent.length} out of ${photoMetadata.length} photos have searchable content`);
    
    if (photosWithContent.length === 0) {
      console.warn('\n⚠️  No photos have tags or descriptions!');
      console.warn('Photos without searchable content cannot be found in searches.');
      console.warn('Consider running your vision pipeline to add AI descriptions and tags.');
      return;
    }
    
    // Index to Pinecone
    console.log('\nIndexing photos to Pinecone...');
    const batchSize = 50;
    for (let i = 0; i < photoMetadata.length; i += batchSize) {
      const batch = photoMetadata.slice(i, i + batchSize);
      console.log(`Indexing batch ${Math.floor(i / batchSize) + 1} (${batch.length} photos)...`);
      await upsertPhotos(batch);
      
      // Small delay between batches
      if (i + batchSize < photoMetadata.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n✅ Successfully indexed ${photoMetadata.length} photos!`);
    console.log('\nYour photos are now searchable by:');
    console.log('  - Descriptions (original or AI-generated)');
    console.log('  - Tags (CompanyCam tags and AI-suggested tags)');
    console.log('  - Visual content analyzed by your vision pipeline');
    
  } catch (error) {
    console.error('\nError indexing photos:', error);
    process.exit(1);
  }
}

// Run the script
indexPhotosWithEnhancements();