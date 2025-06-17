/**
 * Perceptual Hashing for Near-Duplicate Detection
 * Layer 1.5 of the duplicate detection pipeline
 */

export interface PerceptualHashResult {
  photoId: string;
  hash: string;
  imageUrl: string;
}

/**
 * Calculate dHash (difference hash) - good for detecting similar images
 * Compares adjacent pixels to create a hash that's resilient to small changes
 */
export async function calculateDHash(imageUrl: string, size: number = 8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas and resize to (size+1) x size
        const canvas = document.createElement('canvas');
        canvas.width = size + 1;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        
        // Draw and resize image to grayscale
        ctx.drawImage(img, 0, 0, size + 1, size);
        const imageData = ctx.getImageData(0, 0, size + 1, size);
        
        // Convert to grayscale and calculate differences
        const pixels: number[] = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size + 1; x++) {
            const i = (y * (size + 1) + x) * 4;
            const gray = Math.round(
              imageData.data[i] * 0.299 +     // R
              imageData.data[i + 1] * 0.587 + // G
              imageData.data[i + 2] * 0.114   // B
            );
            pixels.push(gray);
          }
        }
        
        // Calculate horizontal differences
        let hash = '';
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const left = pixels[y * (size + 1) + x];
            const right = pixels[y * (size + 1) + x + 1];
            hash += left < right ? '1' : '0';
          }
        }
        
        // Convert binary to hex
        const hexHash = binaryToHex(hash);
        resolve(hexHash);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

/**
 * Calculate Hamming distance between two hashes
 * Lower distance = more similar images
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length');
  }
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Calculate similarity percentage from Hamming distance
 */
export function hashSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  const maxDistance = hash1.length * 4; // 4 bits per hex char
  return 1 - (distance / maxDistance);
}

/**
 * Batch calculate perceptual hashes
 */
export async function batchCalculateHashes(
  photos: Array<{ id: string; imageUrl: string }>,
  batchSize: number = 3
): Promise<PerceptualHashResult[]> {
  console.log(`[PerceptualHash] Calculating hashes for ${photos.length} photos`);
  const results: PerceptualHashResult[] = [];
  
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    console.log(`[PerceptualHash] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)}`);
    
    const batchPromises = batch.map(async photo => {
      try {
        const hash = await calculateDHash(photo.imageUrl);
        return {
          photoId: photo.id,
          hash,
          imageUrl: photo.imageUrl
        };
      } catch (error) {
        console.error(`[PerceptualHash] Failed to hash ${photo.id}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });
    
    // Small delay between batches
    if (i + batchSize < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`[PerceptualHash] Successfully calculated ${results.length} hashes`);
  return results;
}

/**
 * Find perceptually similar images using hash comparison
 */
export function findPerceptualSimilarities(
  hashes: PerceptualHashResult[],
  similarityThreshold: number = 0.85 // 85% similar or higher
): Array<{ photos: PerceptualHashResult[]; averageSimilarity: number }> {
  console.log(`[PerceptualHash] Finding similarities among ${hashes.length} hashes (threshold: ${similarityThreshold})`);
  
  const groups: Array<{ photos: PerceptualHashResult[]; averageSimilarity: number }> = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < hashes.length; i++) {
    if (processed.has(hashes[i].photoId)) continue;
    
    const currentGroup: PerceptualHashResult[] = [hashes[i]];
    processed.add(hashes[i].photoId);
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let j = i + 1; j < hashes.length; j++) {
      if (processed.has(hashes[j].photoId)) continue;
      
      const similarity = hashSimilarity(hashes[i].hash, hashes[j].hash);
      comparisons++;
      
      console.log(`[PerceptualHash] ${hashes[i].photoId} vs ${hashes[j].photoId}: ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity >= similarityThreshold) {
        currentGroup.push(hashes[j]);
        processed.add(hashes[j].photoId);
        totalSimilarity += similarity;
        
        console.log(`[PerceptualHash] ✅ GROUPED: ${hashes[j].photoId} (similarity: ${(similarity * 100).toFixed(1)}%)`);
      }
    }
    
    if (currentGroup.length > 1) {
      const averageSimilarity = totalSimilarity / (currentGroup.length - 1);
      groups.push({ photos: currentGroup, averageSimilarity });
      
      console.log(`[PerceptualHash] Created group with ${currentGroup.length} photos (avg similarity: ${(averageSimilarity * 100).toFixed(1)}%)`);
    }
  }
  
  console.log(`[PerceptualHash] Found ${groups.length} perceptual similarity groups`);
  return groups;
}

/**
 * Convert binary string to hexadecimal
 */
function binaryToHex(binary: string): string {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.substr(i, 4).padEnd(4, '0');
    const decimal = parseInt(chunk, 2);
    hex += decimal.toString(16);
  }
  return hex;
}

/**
 * Debug helper - visualize hash as ASCII art
 */
export function visualizeHash(hash: string, size: number = 8): string {
  const binary = hex2bin(hash);
  let visual = '';
  
  for (let i = 0; i < binary.length; i += size) {
    const row = binary.substr(i, size);
    visual += row.replace(/0/g, '░').replace(/1/g, '█') + '\n';
  }
  
  return visual;
}

function hex2bin(hex: string): string {
  return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
}