/**
 * TensorFlow.js Visual Similarity Detection
 * Layer 2 of the duplicate detection pipeline
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as mobilenet from '@tensorflow-models/mobilenet';

export interface VisualFeatures {
  photoId: string;
  features: Float32Array;
  extractionTime: number;
  imageUrl: string;
}

interface SimilarityResult {
  photo1Id: string;
  photo2Id: string;
  similarity: number;
  comparisonTime: number;
}

interface TensorFlowStats {
  modelLoadTime: number;
  totalExtractionTime: number;
  totalComparisonTime: number;
  featuresExtracted: number;
  comparisonsPerformed: number;
  averageExtractionTime: number;
  averageComparisonTime: number;
}

let visionModel: tf.LayersModel | mobilenet.MobileNet | null = null;
let mobileNetModel: mobilenet.MobileNet | null = null;
let modelLoadStartTime = 0;
let stats: TensorFlowStats = {
  modelLoadTime: 0,
  totalExtractionTime: 0,
  totalComparisonTime: 0,
  featuresExtracted: 0,
  comparisonsPerformed: 0,
  averageExtractionTime: 0,
  averageComparisonTime: 0
};

/**
 * Initialize TensorFlow.js and load ResNet feature extraction model
 */
export async function initializeTensorFlow(): Promise<void> {
  console.log('[TensorFlow] Initializing TensorFlow.js...');
  const initStartTime = Date.now();
  
  try {
    // Set backend to WebGL for GPU acceleration, with CPU fallback
    console.log('[TensorFlow] Setting up backend...');
    
    try {
      await tf.setBackend('webgl');
      console.log('[TensorFlow] WebGL backend set successfully');
      console.log('[TensorFlow] Backend:', tf.getBackend());
    } catch (webglError) {
      console.warn('[TensorFlow] WebGL backend failed, falling back to CPU:', webglError.message);
      await tf.setBackend('cpu');
      console.log('[TensorFlow] CPU backend set as fallback');
    }
    
    // Ready the backend
    await tf.ready();
    console.log('[TensorFlow] Backend ready:', tf.getBackend());
    
    // Log memory info
    const memInfo = tf.memory();
    console.log('[TensorFlow] Initial memory state:', {
      numTensors: memInfo.numTensors,
      numDataBuffers: memInfo.numDataBuffers,
      numBytes: memInfo.numBytes,
      unreliable: memInfo.unreliable
    });
    
    if (!visionModel && !mobileNetModel) {
      console.log('[TensorFlow] Loading MobileNet model for feature extraction...');
      modelLoadStartTime = Date.now();
      
      try {
        // Try the official MobileNet package first (most reliable)
        console.log('[TensorFlow] Attempting to load MobileNet via @tensorflow-models/mobilenet...');
        mobileNetModel = await mobilenet.load({
          version: 2, // Use MobileNet V2
          alpha: 1.0  // Full width model
        });
        console.log('[TensorFlow] Successfully loaded MobileNet V2 via official package');
        visionModel = mobileNetModel;
        
      } catch (mobileNetError) {
        console.warn('[TensorFlow] MobileNet package failed, trying manual model loading:', mobileNetError.message);
        
        // Fallback to manual model loading
        try {
          // Try loading models directly first, then fallback to proxy
          const modelConfigs = [
            {
              url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json',
              direct: true
            },
            {
              url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json',
              direct: true
            },
            {
              url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json',
              direct: false // Try via proxy
            }
          ];
          
          let modelLoaded = false;
          for (const config of modelConfigs) {
            try {
              console.log(`[TensorFlow] Trying to load model ${config.direct ? 'directly' : 'via proxy'}: ${config.url}`);
              const modelUrl = config.direct 
                ? config.url 
                : `/api/tensorflow-model-proxy?modelUrl=${encodeURIComponent(config.url)}`;
              
              visionModel = await tf.loadLayersModel(modelUrl);
              console.log(`[TensorFlow] Successfully loaded pre-trained model: ${config.url}`);
              modelLoaded = true;
              break;
            } catch (modelError) {
              console.warn(`[TensorFlow] Model ${config.url} failed (${config.direct ? 'direct' : 'proxy'}):`, modelError.message);
              continue;
            }
          }
          
          if (!modelLoaded) {
            throw new Error('All pre-trained models failed to load');
          }
        } catch (error) {
          console.error('[TensorFlow] All fallback models failed:', error);
          throw new Error(`Could not load any pre-trained model: ${error.message}`);
        }
      }
      
      stats.modelLoadTime = Date.now() - modelLoadStartTime;
      console.log('[TensorFlow] Model loaded successfully');
      console.log('[TensorFlow] Model load time:', stats.modelLoadTime, 'ms');
      
      if (mobileNetModel) {
        console.log('[TensorFlow] Using MobileNet V2 for feature extraction (1280-dimensional embeddings)');
      } else if (visionModel && 'inputs' in visionModel) {
        console.log('[TensorFlow] Model input shape:', visionModel.inputs[0].shape);
        console.log('[TensorFlow] Model output shape:', visionModel.outputs[0].shape);
        console.log('[TensorFlow] This is a proper feature extraction model, not classification');
      }
    }
    
    const totalInitTime = Date.now() - initStartTime;
    console.log('[TensorFlow] Initialization complete in', totalInitTime, 'ms');
    
  } catch (error) {
    console.error('[TensorFlow] Initialization failed:', error);
    throw new Error(`TensorFlow initialization failed: ${error}`);
  }
}


/**
 * Preprocess image for ResNet input
 */
async function preprocessImage(imageUrl: string): Promise<tf.Tensor4D> {
  console.log('[TensorFlow] Preprocessing image:', imageUrl);
  const preprocessStartTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        console.log('[TensorFlow] Image loaded, dimensions:', img.width, 'x', img.height);
        
        // Create canvas and resize to 224x224 (MobileNet input size)
        const canvas = document.createElement('canvas');
        canvas.width = 224;
        canvas.height = 224;
        const ctx = canvas.getContext('2d')!;
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, 224, 224);
        
        // Convert to tensor with proper MobileNet preprocessing
        const tensor = tf.browser.fromPixels(canvas, 3) // RGB channels
          .expandDims(0) // Add batch dimension
          .cast('float32') // Ensure float32
          .div(255.0) // Normalize to [0,1] for MobileNet
          .sub(0.5) // Center around 0 
          .mul(2.0); // Scale to [-1,1] for MobileNet
        
        const preprocessTime = Date.now() - preprocessStartTime;
        console.log('[TensorFlow] Image preprocessed in', preprocessTime, 'ms');
        console.log('[TensorFlow] Tensor shape:', tensor.shape);
        
        resolve(tensor as tf.Tensor4D);
      } catch (error) {
        console.error('[TensorFlow] Preprocessing failed:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('[TensorFlow] Image load failed:', error);
      reject(new Error(`Failed to load image: ${imageUrl}`));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Extract visual features from an image using ResNet feature extractor
 */
export async function extractVisualFeatures(
  photoId: string, 
  imageUrl: string
): Promise<VisualFeatures> {
  console.log(`[TensorFlow] Extracting features for photo ${photoId} using pre-trained vision model`);
  const extractionStartTime = Date.now();
  
  if (!visionModel && !mobileNetModel) {
    console.log('[TensorFlow] Vision model not loaded, initializing...');
    await initializeTensorFlow();
  }
  
  try {
    // Preprocess image
    const preprocessedImage = await preprocessImage(imageUrl);
    console.log('[TensorFlow] Starting feature extraction with pre-trained model...');
    
    // Extract features from the model
    let featureTensor: tf.Tensor;
    
    if (mobileNetModel) {
      // Use MobileNet's infer method to get embeddings
      // Try using an earlier layer for more discriminative features
      // The second argument (true) returns embeddings instead of logits
      featureTensor = mobileNetModel.infer(preprocessedImage, 'conv_pw_13_relu') as tf.Tensor;
      console.log('[TensorFlow] Extracted features from MobileNet conv_pw_13_relu layer');
      
      // Flatten the tensor if needed
      if (featureTensor.shape.length > 2) {
        featureTensor = featureTensor.reshape([featureTensor.shape[0], -1]);
      }
    } else if (visionModel && 'layers' in visionModel && visionModel.layers.length > 2) {
      // Create a feature extractor from the dense layer before final classification
      const featureLayerIndex = visionModel.layers.length - 2;
      const featureExtractor = tf.model({
        inputs: visionModel.inputs,
        outputs: visionModel.layers[featureLayerIndex].output
      });
      
      featureTensor = featureExtractor.predict(preprocessedImage) as tf.Tensor;
      featureExtractor.dispose();
      console.log('[TensorFlow] Extracted features from custom layers model');
    } else if (visionModel && 'predict' in visionModel) {
      // Fallback: use the full model output
      featureTensor = visionModel.predict(preprocessedImage) as tf.Tensor;
      console.log('[TensorFlow] Extracted features using full model output');
    } else {
      throw new Error('No valid model available for feature extraction');
    }
    
    const rawFeatures = await featureTensor.data() as Float32Array;
    
    // Normalize features for better similarity comparison
    const features = normalizeFeatures(rawFeatures);
    
    // Cleanup tensors
    preprocessedImage.dispose();
    featureTensor.dispose();
    
    const extractionTime = Date.now() - extractionStartTime;
    stats.totalExtractionTime += extractionTime;
    stats.featuresExtracted += 1;
    stats.averageExtractionTime = stats.totalExtractionTime / stats.featuresExtracted;
    
    console.log(`[TensorFlow] Features extracted for ${photoId}:`, {
      extractionTime: extractionTime + 'ms',
      featureCount: features.length,
      averageExtractionTime: Math.round(stats.averageExtractionTime) + 'ms',
      totalFeatures: stats.featuresExtracted,
      featureSample: Array.from(features.slice(0, 10)).map(f => f.toFixed(3)), // First 10 features
      featureStats: {
        min: Math.min(...features).toFixed(3),
        max: Math.max(...features).toFixed(3),
        avg: (features.reduce((a, b) => a + b, 0) / features.length).toFixed(3),
        norm: Math.sqrt(features.reduce((a, b) => a + b * b, 0)).toFixed(3) // Should be ~1.0 after normalization
      }
    });
    
    // Log memory usage
    const memInfo = tf.memory();
    console.log('[TensorFlow] Memory after extraction:', {
      numTensors: memInfo.numTensors,
      numBytes: memInfo.numBytes
    });
    
    return {
      photoId,
      features,
      extractionTime,
      imageUrl
    };
    
  } catch (error) {
    console.error(`[TensorFlow] Feature extraction failed for ${photoId}:`, error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two feature vectors
 * Enhanced with L2 normalization and better numerical stability
 */
function calculateCosineSimilarity(features1: Float32Array, features2: Float32Array): number {
  if (features1.length !== features2.length) {
    throw new Error('Feature vectors must have the same length');
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  // Calculate dot product and norms in one pass for efficiency
  for (let i = 0; i < features1.length; i++) {
    const f1 = features1[i];
    const f2 = features2[i];
    
    dotProduct += f1 * f2;
    norm1 += f1 * f1;
    norm2 += f2 * f2;
  }
  
  // Apply epsilon for numerical stability
  const epsilon = 1e-8;
  norm1 = Math.sqrt(norm1 + epsilon);
  norm2 = Math.sqrt(norm2 + epsilon);
  
  // Cosine similarity: dot product / (||a|| * ||b||)
  const similarity = dotProduct / (norm1 * norm2);
  
  // Clamp to [-1, 1] range due to floating point precision
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Normalize feature vector using L2 normalization
 * This ensures all vectors have unit length for better similarity comparison
 */
function normalizeFeatures(features: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < features.length; i++) {
    norm += features[i] * features[i];
  }
  norm = Math.sqrt(norm);
  
  if (norm === 0) {
    return features; // Return original if zero vector
  }
  
  const normalized = new Float32Array(features.length);
  for (let i = 0; i < features.length; i++) {
    normalized[i] = features[i] / norm;
  }
  
  return normalized;
}

/**
 * Compare visual similarity between two photos
 */
export function compareVisualFeatures(
  features1: VisualFeatures,
  features2: VisualFeatures
): SimilarityResult {
  console.log(`[TensorFlow] Comparing ${features1.photoId} vs ${features2.photoId}`);
  const comparisonStartTime = Date.now();
  
  const similarity = calculateCosineSimilarity(features1.features, features2.features);
  const comparisonTime = Date.now() - comparisonStartTime;
  
  stats.totalComparisonTime += comparisonTime;
  stats.comparisonsPerformed += 1;
  stats.averageComparisonTime = stats.totalComparisonTime / stats.comparisonsPerformed;
  
  console.log(`[TensorFlow] Similarity calculated:`, {
    photo1: features1.photoId,
    photo2: features2.photoId,
    similarity: similarity.toFixed(4),
    comparisonTime: comparisonTime + 'ms',
    averageComparisonTime: Math.round(stats.averageComparisonTime * 100) / 100 + 'ms',
    // Debug: Show first few feature comparisons
    feature1Sample: Array.from(features1.features.slice(0, 5)).map(f => f.toFixed(3)),
    feature2Sample: Array.from(features2.features.slice(0, 5)).map(f => f.toFixed(3)),
    // Check if features are too similar (indicating a problem)
    suspiciouslyHigh: similarity > 0.99 ? 'SUSPICIOUS - Features too similar' : 'normal'
  });
  
  return {
    photo1Id: features1.photoId,
    photo2Id: features2.photoId,
    similarity,
    comparisonTime
  };
}

/**
 * Batch extract features for multiple photos
 */
export async function batchExtractFeatures(
  photos: Array<{ id: string; imageUrl: string }>,
  batchSize: number = 3
): Promise<VisualFeatures[]> {
  console.log(`[TensorFlow] Starting batch feature extraction for ${photos.length} photos (batch size: ${batchSize})`);
  const batchStartTime = Date.now();
  
  const features: VisualFeatures[] = [];
  
  // Ensure model is loaded
  if (!visionModel && !mobileNetModel) {
    await initializeTensorFlow();
  }
  
  // Process in batches to avoid overwhelming memory
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    console.log(`[TensorFlow] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)} (${batch.length} photos)`);
    
    const batchPromises = batch.map(photo => 
      extractVisualFeatures(photo.id, photo.imageUrl)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        features.push(result.value);
      } else {
        console.error(`[TensorFlow] Feature extraction failed for ${batch[index].id}:`, result.reason);
      }
    });
    
    // Small delay between batches to prevent browser freezing
    if (i + batchSize < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const totalBatchTime = Date.now() - batchStartTime;
  console.log(`[TensorFlow] Batch extraction complete:`, {
    totalTime: totalBatchTime + 'ms',
    successfulExtractions: features.length,
    failedExtractions: photos.length - features.length,
    averageTimePerPhoto: Math.round(totalBatchTime / photos.length) + 'ms'
  });
  
  return features;
}

/**
 * Find similar photos based on visual features
 */
export function findVisualSimilarities(
  features: VisualFeatures[],
  similarityThreshold: number = 0.8
): Array<{ group: VisualFeatures[]; averageSimilarity: number }> {
  console.log(`[TensorFlow] Finding visual similarities among ${features.length} photos (threshold: ${similarityThreshold})`);
  const findStartTime = Date.now();
  
  const groups: Array<{ group: VisualFeatures[]; averageSimilarity: number }> = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < features.length; i++) {
    if (processed.has(features[i].photoId)) continue;
    
    const currentGroup: VisualFeatures[] = [features[i]];
    processed.add(features[i].photoId);
    let totalSimilarity = 0;
    let comparisonCount = 0;
    
    for (let j = i + 1; j < features.length; j++) {
      if (processed.has(features[j].photoId)) continue;
      
      const similarity = compareVisualFeatures(features[i], features[j]);
      
      // More stringent checking for construction photos
      const isHighSimilarity = similarity.similarity >= similarityThreshold;
      const isVeryHighSimilarity = similarity.similarity >= 0.98; // Almost identical
      
      console.log(`[TensorFlow] Comparing ${features[i].photoId} vs ${features[j].photoId}:`, {
        similarity: similarity.similarity.toFixed(4),
        threshold: similarityThreshold,
        passes: isHighSimilarity,
        almostIdentical: isVeryHighSimilarity,
        url1: features[i].imageUrl.substring(features[i].imageUrl.lastIndexOf('/') + 1, features[i].imageUrl.length - 4),
        url2: features[j].imageUrl.substring(features[j].imageUrl.lastIndexOf('/') + 1, features[j].imageUrl.length - 4)
      });
      
      if (isHighSimilarity) {
        currentGroup.push(features[j]);
        processed.add(features[j].photoId);
        totalSimilarity += similarity.similarity;
        
        console.log(`[TensorFlow] ⚠️ GROUPED: ${features[j].photoId} (similarity: ${similarity.similarity.toFixed(4)}) - CHECK IF THIS IS CORRECT`);
      }
    }
    
    if (currentGroup.length > 1) {
      const averageSimilarity = totalSimilarity / (currentGroup.length - 1);
      groups.push({ group: currentGroup, averageSimilarity });
      
      console.log(`[TensorFlow] Created group with ${currentGroup.length} photos (avg similarity: ${averageSimilarity.toFixed(4)})`);
    }
  }
  
  const findTime = Date.now() - findStartTime;
  console.log(`[TensorFlow] Similarity grouping complete:`, {
    totalTime: findTime + 'ms',
    groupsFound: groups.length,
    photosGrouped: groups.reduce((sum, g) => sum + g.group.length, 0),
    totalComparisons: stats.comparisonsPerformed
  });
  
  return groups;
}

/**
 * Get comprehensive performance statistics
 */
export function getTensorFlowStats(): TensorFlowStats {
  return { ...stats };
}

/**
 * Reset statistics
 */
export function resetTensorFlowStats(): void {
  console.log('[TensorFlow] Resetting statistics');
  stats = {
    modelLoadTime: stats.modelLoadTime, // Keep model load time
    totalExtractionTime: 0,
    totalComparisonTime: 0,
    featuresExtracted: 0,
    comparisonsPerformed: 0,
    averageExtractionTime: 0,
    averageComparisonTime: 0
  };
}

/**
 * Cleanup TensorFlow resources
 */
export function cleanupTensorFlow(): void {
  console.log('[TensorFlow] Cleaning up resources...');
  
  if (mobileNetModel) {
    // MobileNet models don't have a dispose method, just null the reference
    mobileNetModel = null;
  }
  
  if (visionModel && 'dispose' in visionModel) {
    visionModel.dispose();
    visionModel = null;
  }
  
  // Force garbage collection
  tf.disposeVariables();
  
  const memInfo = tf.memory();
  console.log('[TensorFlow] Memory after cleanup:', {
    numTensors: memInfo.numTensors,
    numDataBuffers: memInfo.numDataBuffers,
    numBytes: memInfo.numBytes
  });
}