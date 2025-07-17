// © 2025 Mark Hustad — MIT License
// scripts/index-photos.ts - Index photos into Pinecone for chat search

import dotenv from 'dotenv';
import { upsertPhotos, PhotoMetadata } from '../src/utils/pinecone';
import type { Photo } from '../src/types';

// Load environment variables
dotenv.config();

// Mock function to get photos - in production, this would fetch from your database
async function fetchPhotosFromDatabase(limit: number = 1000): Promise<Photo[]> {
  // This is a placeholder - replace with actual database query
  console.log('Note: Using mock data. Replace this with actual database fetch.');
  
  // Example mock photos for testing
  const mockPhotos: Photo[] = [
    {
      id: 'photo_001',
      project_id: 'proj_123',
      photo_url: 'https://example.com/photo1.jpg',
      tags: ['foundation', 'crack', 'structural'],
      description: 'Large crack in foundation wall, approximately 3 inches wide',
      captured_at: '2024-03-15T10:30:00Z',
      created_at: '2024-03-15T10:30:00Z',
      updated_at: '2024-03-15T10:30:00Z',
      creator_id: 'user_001',
      creator_name: 'John Doe',
      ai_description: 'Significant structural crack in concrete foundation requiring immediate attention',
      similarity_score: 0,
      is_favorite: false,
      width: 1920,
      height: 1080,
    },
    {
      id: 'photo_002',
      project_id: 'proj_123',
      photo_url: 'https://example.com/photo2.jpg',
      tags: ['roofing', 'shingles', 'damage'],
      description: 'Missing shingles on north side of roof after storm',
      captured_at: '2024-03-20T14:15:00Z',
      created_at: '2024-03-20T14:15:00Z',
      updated_at: '2024-03-20T14:15:00Z',
      creator_id: 'user_002',
      creator_name: 'Jane Smith',
      ai_description: 'Storm damage to asphalt shingles showing exposed underlayment',
      similarity_score: 0,
      is_favorite: false,
      width: 1920,
      height: 1080,
    },
    {
      id: 'photo_003',
      project_id: 'proj_456',
      photo_url: 'https://example.com/photo3.jpg',
      tags: ['plumbing', 'leak', 'bathroom'],
      description: 'Water damage under bathroom sink from leaking pipe',
      captured_at: '2024-04-01T09:00:00Z',
      created_at: '2024-04-01T09:00:00Z',
      updated_at: '2024-04-01T09:00:00Z',
      creator_id: 'user_001',
      creator_name: 'John Doe',
      ai_description: 'Active plumbing leak causing water damage to vanity cabinet',
      similarity_score: 0,
      is_favorite: false,
      width: 1920,
      height: 1080,
    },
  ];
  
  return mockPhotos;
}

// Convert Photo to PhotoMetadata for Pinecone
function photoToMetadata(photo: Photo, projectName?: string): PhotoMetadata {
  // Combine description and AI description
  const descriptions = [];
  if (photo.description) descriptions.push(photo.description);
  if (photo.ai_description) descriptions.push(photo.ai_description);
  
  return {
    id: photo.id,
    project_id: photo.project_id,
    project_name: projectName,
    description: descriptions.join('. '),
    tags: photo.tags || [],
    captured_at: new Date(photo.captured_at).getTime() / 1000, // Convert to Unix timestamp
    creator_id: photo.creator_id,
    creator_name: photo.creator_name,
    url: photo.photo_url,
    thumbnail_url: photo.photo_url, // Use same URL for now
    width: photo.width,
    height: photo.height,
  };
}

async function indexPhotos() {
  console.log('Starting photo indexing process...');
  
  try {
    // Fetch photos from database
    const photos = await fetchPhotosFromDatabase();
    console.log(`Fetched ${photos.length} photos to index`);
    
    if (photos.length === 0) {
      console.log('No photos to index');
      return;
    }
    
    // Convert to metadata format
    const photoMetadata = photos.map(photo => 
      photoToMetadata(photo, `Project ${photo.project_id}`) // In production, fetch actual project names
    );
    
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