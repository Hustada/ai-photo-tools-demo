import { 
  calculateDHash, 
  hammingDistance, 
  hashSimilarity,
  batchCalculateHashes,
  findPerceptualSimilarities,
  visualizeHash 
} from './src/utils/perceptualHash';

async function testPerceptualHashing() {
  console.log('🔍 Testing Perceptual Hashing (dHash)\n');
  
  const testImages = [
    { id: 'cybermorph_6531', imageUrl: '/source-images/cybermorph_IMG_6531.jpg' },
    { id: 'cybermorph_6532', imageUrl: '/source-images/cybermorph_IMG_6532.jpg' },
    { id: 'cybermorph_6533', imageUrl: '/source-images/cybermorph_IMG_6533.jpg' },
    { id: 'newworksite28', imageUrl: '/source-images/newworksite28.jpg' },
    { id: 'newworksite6', imageUrl: '/source-images/newworksite6.jpg' }
  ];
  
  try {
    console.log('1️⃣ Calculating perceptual hashes...\n');
    
    const hashes = await batchCalculateHashes(testImages);
    
    if (hashes.length === 0) {
      console.log('❌ No hashes calculated - check image paths');
      return;
    }
    
    console.log('✅ Hash calculation complete!\n');
    
    // Show individual hashes
    console.log('📝 Individual Hashes:\n');
    hashes.forEach(hash => {
      console.log(`${hash.photoId.padEnd(20)} ${hash.hash}`);
      console.log(`${' '.repeat(20)} ${visualizeHash(hash.hash, 8)}`);
    });
    
    console.log('\n2️⃣ Calculating pairwise similarities...\n');
    console.log('Image 1'.padEnd(20) + 'Image 2'.padEnd(20) + 'Similarity');
    console.log('-'.repeat(60));
    
    // Calculate all pairwise similarities
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        const similarity = hashSimilarity(hashes[i].hash, hashes[j].hash);
        const distance = hammingDistance(hashes[i].hash, hashes[j].hash);
        
        const emoji = similarity > 0.88 ? '🟢' : similarity > 0.75 ? '🟡' : '🔴';
        
        console.log(
          hashes[i].photoId.padEnd(20) +
          hashes[j].photoId.padEnd(20) +
          `${(similarity * 100).toFixed(1)}% (dist: ${distance}) ${emoji}`
        );
      }
    }
    
    console.log('\n3️⃣ Finding similarity groups...\n');
    
    const groups = findPerceptualSimilarities(hashes, 0.88); // 88% threshold
    
    if (groups.length === 0) {
      console.log('✨ No similarity groups found above 88% threshold');
    } else {
      console.log(`✅ Found ${groups.length} similarity groups:\n`);
      groups.forEach((group, index) => {
        console.log(`Group ${index + 1}: ${group.photos.map(p => p.photoId).join(', ')}`);
        console.log(`Average similarity: ${(group.averageSimilarity * 100).toFixed(1)}%\n`);
      });
    }
    
    console.log('\n💡 Expected Results:');
    console.log('- cybermorph_6531, 6532, 6533 should be highly similar (retry shots)');
    console.log('- newworksite images should be different from cybermorph');
    console.log('- Similarities should be much more discriminative than MobileNet');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPerceptualHashing();