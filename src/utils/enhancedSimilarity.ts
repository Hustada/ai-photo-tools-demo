/**
 * Enhanced Visual Similarity Detection
 * Combines multiple approaches for better discrimination
 */

import * as tf from '@tensorflow/tfjs';

export interface EnhancedFeatures {
  photoId: string;
  mobileNetFeatures?: Float32Array;
  colorHistogram?: Float32Array;
  edgeFeatures?: Float32Array;
  perceptualHash?: string;
}

/**
 * Calculate color histogram from image tensor
 */
export function calculateColorHistogram(imageTensor: tf.Tensor3D, bins: number = 16): Float32Array {
  const pixels = imageTensor.arraySync();
  const histogram = new Float32Array(bins * 3); // RGB channels
  
  const binSize = 256 / bins;
  
  for (let y = 0; y < pixels.length; y++) {
    for (let x = 0; x < pixels[y].length; x++) {
      const [r, g, b] = pixels[y][x];
      
      // Calculate bin indices
      const rBin = Math.floor(r / binSize);
      const gBin = Math.floor(g / binSize);
      const bBin = Math.floor(b / binSize);
      
      // Update histogram
      histogram[rBin]++;
      histogram[bins + gBin]++;
      histogram[bins * 2 + bBin]++;
    }
  }
  
  // Normalize histogram
  const totalPixels = pixels.length * pixels[0].length;
  for (let i = 0; i < histogram.length; i++) {
    histogram[i] /= totalPixels;
  }
  
  return histogram;
}

/**
 * Calculate edge features using Sobel operator
 */
export async function calculateEdgeFeatures(imageTensor: tf.Tensor3D): Promise<Float32Array> {
  // Convert to grayscale
  const grayscale = tf.mean(imageTensor, 2, true);
  
  // Sobel operators
  const sobelX = tf.tensor2d([
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ]);
  
  const sobelY = tf.tensor2d([
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ]);
  
  // Apply convolution
  const edgesX = tf.conv2d(
    grayscale.expandDims(0) as tf.Tensor4D,
    sobelX.expandDims(2).expandDims(3) as tf.Tensor4D,
    1,
    'same'
  );
  
  const edgesY = tf.conv2d(
    grayscale.expandDims(0) as tf.Tensor4D,
    sobelY.expandDims(2).expandDims(3) as tf.Tensor4D,
    1,
    'same'
  );
  
  // Calculate magnitude
  const magnitude = tf.sqrt(tf.add(tf.square(edgesX), tf.square(edgesY)));
  
  // Pool to reduce dimensionality
  const pooled = tf.maxPool(magnitude, 4, 4, 'same');
  const features = await pooled.data();
  
  // Cleanup
  grayscale.dispose();
  sobelX.dispose();
  sobelY.dispose();
  edgesX.dispose();
  edgesY.dispose();
  magnitude.dispose();
  pooled.dispose();
  
  return new Float32Array(features);
}

/**
 * Combined similarity calculation with multiple features
 */
export function calculateCombinedSimilarity(
  features1: EnhancedFeatures,
  features2: EnhancedFeatures
): number {
  let totalSimilarity = 0;
  let weights = 0;
  
  // MobileNet features (if available)
  if (features1.mobileNetFeatures && features2.mobileNetFeatures) {
    const mobileSim = cosineSimilarity(features1.mobileNetFeatures, features2.mobileNetFeatures);
    // Reduce weight due to poor discrimination
    totalSimilarity += mobileSim * 0.3;
    weights += 0.3;
  }
  
  // Color histogram similarity
  if (features1.colorHistogram && features2.colorHistogram) {
    const colorSim = 1 - chiSquaredDistance(features1.colorHistogram, features2.colorHistogram);
    totalSimilarity += colorSim * 0.4;
    weights += 0.4;
  }
  
  // Edge features similarity
  if (features1.edgeFeatures && features2.edgeFeatures) {
    const edgeSim = cosineSimilarity(features1.edgeFeatures, features2.edgeFeatures);
    totalSimilarity += edgeSim * 0.3;
    weights += 0.3;
  }
  
  return weights > 0 ? totalSimilarity / weights : 0;
}

/**
 * Chi-squared distance for histogram comparison
 */
function chiSquaredDistance(hist1: Float32Array, hist2: Float32Array): number {
  let distance = 0;
  
  for (let i = 0; i < hist1.length; i++) {
    const sum = hist1[i] + hist2[i];
    if (sum > 0) {
      distance += Math.pow(hist1[i] - hist2[i], 2) / sum;
    }
  }
  
  return distance / 2;
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  return dotProduct / (normA * normB);
}