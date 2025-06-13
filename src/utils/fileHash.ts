/**
 * File hash utilities for exact duplicate detection
 * Uses SHA-256 to generate deterministic hashes from image data
 */

/**
 * Generate SHA-256 hash from image URL
 * Fetches the image and hashes its binary data
 */
export async function generateImageHash(imageUrl: string): Promise<string> {
  try {
    console.log('[FileHash] Generating hash for:', imageUrl);
    
    // Fetch image as blob
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Get array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Generate hash using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('[FileHash] Generated hash:', hashHex.substring(0, 16) + '...');
    return hashHex;
  } catch (error) {
    console.error('[FileHash] Error generating hash:', error);
    // Return empty string on error to avoid breaking flow
    return '';
  }
}

/**
 * Generate hash from File object (for future upload support)
 */
export async function generateFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('[FileHash] Error hashing file:', error);
    return '';
  }
}

/**
 * Check if two hashes match (exact duplicate)
 */
export function areHashesEqual(hash1: string, hash2: string): boolean {
  return hash1 !== '' && hash2 !== '' && hash1 === hash2;
}

/**
 * Batch hash generation for multiple URLs
 */
export async function batchGenerateHashes(
  imageUrls: string[]
): Promise<Map<string, string>> {
  console.log(`[FileHash] Batch generating hashes for ${imageUrls.length} images`);
  const hashes = new Map<string, string>();
  
  // Process in batches to avoid overwhelming the browser
  const batchSize = 3;
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    const batchPromises = batch.map(async (url) => {
      const hash = await generateImageHash(url);
      return { url, hash };
    });
    
    const results = await Promise.allSettled(batchPromises);
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.hash) {
        hashes.set(result.value.url, result.value.hash);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[FileHash] Generated ${hashes.size} hashes successfully`);
  return hashes;
}

/**
 * Find exact duplicates in a set of photos
 */
export interface DuplicateGroup {
  hash: string;
  urls: string[];
  photoIds: string[];
}

export function findExactDuplicates(
  photoHashMap: Map<string, { hash: string; photoId: string }>
): DuplicateGroup[] {
  const hashGroups = new Map<string, { urls: string[]; photoIds: string[] }>();
  
  // Group by hash
  photoHashMap.forEach((value, url) => {
    if (!value.hash) return;
    
    if (!hashGroups.has(value.hash)) {
      hashGroups.set(value.hash, { urls: [], photoIds: [] });
    }
    
    const group = hashGroups.get(value.hash)!;
    group.urls.push(url);
    group.photoIds.push(value.photoId);
  });
  
  // Return only groups with duplicates
  const duplicates: DuplicateGroup[] = [];
  hashGroups.forEach((group, hash) => {
    if (group.urls.length > 1) {
      duplicates.push({ hash, ...group });
    }
  });
  
  console.log(`[FileHash] Found ${duplicates.length} duplicate groups`);
  return duplicates;
}