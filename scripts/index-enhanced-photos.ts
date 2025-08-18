#!/usr/bin/env tsx
import { config } from 'dotenv';
import { upsertPhotos, type PhotoMetadata } from '../src/utils/pinecone';
import { fetchPhotosWithEnhancements } from '../src/lib/queries/photoQueries';
import type { Photo } from '../src/types';

// Load environment variables
config();

// Convert enhanced Photo to PhotoMetadata for Pinecone
function photoToMetadata(photo: Photo, projectName?: string): PhotoMetadata {
  // Extract tag values from Tag objects (both CompanyCam and AI tags)
  const tagValues = photo.tags?.map(tag => tag.value || tag.display_value) || [];
  
  // Get thumbnail URL from uris
  const thumbnailUri = photo.uris?.find(uri => uri.type === 'thumbnail');
  const originalUri = photo.uris?.find(uri => uri.type === 'original');
  const thumbnailUrl = thumbnailUri?.url || thumbnailUri?.uri || photo.photo_url;
  const photoUrl = photo.photo_url || originalUri?.url || originalUri?.uri || `https://app.companycam.com/assets/Image/${photo.id}`;
  
  // Use the description (which may be AI-enhanced)
  const description = photo.description || '';
  
  return {
    id: photo.id,
    project_id: photo.project_id,
    project_name: projectName || `Project ${photo.project_id}`,
    description,
    tags: tagValues,
    captured_at: typeof photo.captured_at === 'number' ? photo.captured_at : Date.now() / 1000,
    creator_id: photo.creator_id,
    creator_name: photo.creator_name,
    url: photoUrl,
    thumbnail_url: thumbnailUrl,
  };
}

async function indexEnhancedPhotos() {
  console.log('Starting enhanced photo indexing process...');
  console.log('This will fetch photos with AI-generated descriptions and tags.');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  const pageArg = args.find(arg => arg.startsWith('--page='));
  const startPage = pageArg ? parseInt(pageArg.split('=')[1]) : 1;
  
  const apiKey = process.env.COMPANYCAM_API_KEY || process.env.VITE_APP_COMPANYCAM_API_KEY;
  if (!apiKey) {
    throw new Error('COMPANYCAM_API_KEY or VITE_APP_COMPANYCAM_API_KEY environment variable is required');
  }
  
  console.log(`Starting from page ${startPage}, limiting to ${limit} photos total`);
  
  try {
    let allPhotos: Photo[] = [];
    let currentPage = startPage;
    const perPage = 20; // Match the default in fetchPhotosWithEnhancements
    
    // Fetch photos page by page until we have enough
    while (allPhotos.length < limit) {
      console.log(`\nFetching page ${currentPage}...`);
      
      const photos = await fetchPhotosWithEnhancements(
        apiKey,
        currentPage,
        perPage,
        undefined, // no tag filter
        true // force refresh to bypass cache
      );
      
      if (photos.length === 0) {
        console.log('No more photos to fetch');
        break;
      }
      
      allPhotos = allPhotos.concat(photos);
      console.log(`Fetched ${photos.length} photos (total: ${allPhotos.length})`);
      
      // Check how many have AI enhancements
      const photosWithAI = photos.filter(p => 
        p.tags?.some(t => t.isAiEnhanced) || 
        p.description?.includes('AI') // Rough check for AI descriptions
      );
      console.log(`  ${photosWithAI.length} photos have AI enhancements`);
      
      currentPage++;
      
      // Stop if we've reached the limit
      if (allPhotos.length >= limit) {
        allPhotos = allPhotos.slice(0, limit);
        break;
      }
    }
    
    if (allPhotos.length === 0) {
      console.log('No photos to index');
      return;
    }
    
    // Convert to metadata format
    console.log(`\nPreparing ${allPhotos.length} photos for indexing...`);
    const photoMetadata = allPhotos.map(photo => {
      const metadata = photoToMetadata(photo);
      
      // Log a sample of what we're indexing
      if (allPhotos.indexOf(photo) < 3) {
        console.log(`\nPhoto ${photo.id}:`);
        console.log(`  Description: ${metadata.description?.slice(0, 100)}${metadata.description?.length > 100 ? '...' : ''}`);
        console.log(`  Tags: ${metadata.tags?.join(', ') || 'none'}`);
      }
      
      return metadata;
    });
    
    // Count photos with content
    const photosWithContent = photoMetadata.filter(p => 
      (p.description && p.description.length > 0) || 
      (p.tags && p.tags.length > 0)
    );
    console.log(`\n${photosWithContent.length} out of ${photoMetadata.length} photos have searchable content`);
    
    // Index in batches
    console.log('\nIndexing to Pinecone...');
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
    
    console.log(`\n✅ Successfully indexed ${allPhotos.length} photos with enhancements!`);
    console.log('\nYour photos are now searchable by:');
    console.log('  - AI-generated descriptions');
    console.log('  - Both original and AI-suggested tags');
    console.log('  - Visual content from your vision pipeline');
    
  } catch (error) {
    console.error('Error indexing photos:', error);
    process.exit(1);
  }
}

// Run the script
indexEnhancedPhotos();