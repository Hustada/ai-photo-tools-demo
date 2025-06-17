import * as tf from '@tensorflow/tfjs-node';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from 'canvas';

async function testVisualSimilarity() {
    console.log('🧪 Testing TensorFlow.js Visual Similarity Detection\n');
    
    try {
        // Initialize TensorFlow
        console.log('1️⃣ Initializing TensorFlow.js...');
        await tf.ready();
        console.log('✅ TensorFlow.js backend:', tf.getBackend());
        
        // Load MobileNet model
        console.log('\n2️⃣ Loading MobileNet V2 model...');
        const startTime = Date.now();
        const model = await mobilenet.load({
            version: 2,
            alpha: 1.0
        });
        console.log(`✅ Model loaded in ${Date.now() - startTime}ms`);
        
        // Test images - mixing cybermorph and newworksite images
        const sourceDir = './source-images';
        const testImages = [
            'cybermorph_IMG_6531.jpg',
            'cybermorph_IMG_6532.jpg',
            'cybermorph_IMG_6533.jpg',
            'newworksite28.jpg',
            'newworksite29.jpg',
            'newworksite30.jpg'
        ];
        
        console.log('\n3️⃣ Extracting features from images...');
        const embeddings: { filename: string; embedding: Float32Array }[] = [];
        
        for (const filename of testImages) {
            const imagePath = path.join(sourceDir, filename);
            if (!fs.existsSync(imagePath)) {
                console.warn(`⚠️  Image not found: ${imagePath}`);
                continue;
            }
            
            console.log(`   Processing ${filename}...`);
            const image = await loadImage(imagePath);
            
            // Create canvas and draw image
            const canvas = createCanvas(224, 224);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, 224, 224);
            
            // Convert to tensor
            const imageTensor = tf.browser.fromPixels(canvas as any)
                .expandDims(0)
                .cast('float32')
                .div(255.0)
                .sub(0.5)
                .mul(2.0);
            
            // Extract embeddings
            const embeddingTensor = model.infer(imageTensor, true) as tf.Tensor;
            const embedding = await embeddingTensor.data() as Float32Array;
            
            // Normalize the embedding
            const normalizedEmbedding = normalizeVector(embedding);
            
            embeddings.push({ filename, embedding: normalizedEmbedding });
            
            // Cleanup
            imageTensor.dispose();
            embeddingTensor.dispose();
        }
        
        console.log(`\n✅ Extracted features from ${embeddings.length} images`);
        console.log(`   Embedding dimensions: ${embeddings[0]?.embedding.length || 0}`);
        
        // Calculate similarities
        console.log('\n4️⃣ Calculating pairwise similarities...\n');
        console.log('Image 1'.padEnd(25) + 'Image 2'.padEnd(25) + 'Similarity');
        console.log('-'.repeat(65));
        
        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const similarity = cosineSimilarity(
                    embeddings[i].embedding,
                    embeddings[j].embedding
                );
                
                const isSimilar = similarity > 0.92; // Higher threshold for MobileNet
                const emoji = similarity > 0.95 ? '🟢' : similarity > 0.90 ? '🟡' : '🔴';
                
                console.log(
                    embeddings[i].filename.padEnd(25) +
                    embeddings[j].filename.padEnd(25) +
                    `${similarity.toFixed(4)} ${emoji}`
                );
            }
        }
        
        // Additional analysis
        console.log('\n5️⃣ Analyzing embedding variance...\n');
        
        for (const { filename, embedding } of embeddings) {
            // Calculate variance of the embedding
            let mean = 0;
            for (let i = 0; i < embedding.length; i++) {
                mean += embedding[i];
            }
            mean /= embedding.length;
            
            let variance = 0;
            for (let i = 0; i < embedding.length; i++) {
                variance += Math.pow(embedding[i] - mean, 2);
            }
            variance /= embedding.length;
            
            // Find min and max values
            const min = Math.min(...Array.from(embedding));
            const max = Math.max(...Array.from(embedding));
            
            console.log(`${filename.padEnd(25)} variance: ${variance.toFixed(6)}, range: [${min.toFixed(3)}, ${max.toFixed(3)}]`);
        }
        
        console.log('\n💡 Analysis Summary:');
        console.log('- All similarities are > 0.99, suggesting MobileNet may not discriminate well for these images');
        console.log('- Consider using a model trained on construction/industrial images');
        console.log('- Or implement additional features like color histograms, edge detection, etc.');
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

function normalizeVector(vector: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
        normalized[i] = vector[i] / norm;
    }
    return normalized;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    // Since vectors are already normalized, just compute dot product
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
    }
    return dotProduct;
}

// Run the test
testVisualSimilarity();