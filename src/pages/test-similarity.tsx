import React, { useState } from 'react';
import { useVisualSimilarity } from '../hooks/useVisualSimilarity';
import type { Photo } from '../types';

export default function TestSimilarity() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]); // Include filtered groups
  const [currentTest, setCurrentTest] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showCustomTest, setShowCustomTest] = useState<boolean>(false);
  const [showAllGroups, setShowAllGroups] = useState<boolean>(false); // Toggle to show filtered groups

  // Test 1: Skip all filtering - pure AI analysis
  const { analyzeSimilarity: testPureAI, state: pureAIState } = useVisualSimilarity({
    enabledLayers: {
      fileHash: false,     // DISABLED
      tensorFlow: false,   // DISABLED  
      metadata: false,     // DISABLED
      aiAnalysis: true     // ONLY AI analysis
    },
    similarityThreshold: 0.6
  });

  // Test 2: Skip temporal filtering but use TensorFlow
  const { analyzeSimilarity: testWithTensorFlow, state: tensorFlowState } = useVisualSimilarity({
    enabledLayers: {
      fileHash: false,     // DISABLED - test all photos
      tensorFlow: true,    // ENABLED - visual features
      metadata: false,     // DISABLED - no time filtering
      aiAnalysis: true     // ENABLED - AI analysis
    },
    similarityThreshold: 0.6
  });

  // Test 3: Production mode (all layers)
  const { analyzeSimilarity: testProduction, state: productionState } = useVisualSimilarity({
    enabledLayers: {
      fileHash: true,      // ENABLED
      tensorFlow: true,    // ENABLED
      metadata: true,      // ENABLED
      aiAnalysis: true     // ENABLED
    },
    similarityThreshold: 0.6
  });

  // Test 4: Custom selected photos with strict confidence filtering
  const { analyzeSimilarity: testCustom, state: customState, getAllGroups, getFilteredGroups } = useVisualSimilarity({
    enabledLayers: {
      fileHash: false,     // DISABLED - test visual similarity
      tensorFlow: false,   // DISABLED - focus on AI
      metadata: false,     // DISABLED - no filtering
      aiAnalysis: true     // ENABLED - pure AI comparison
    },
    similarityThreshold: 0.5,
    confidenceThreshold: 0.85 // 85% confidence minimum (production default)
  });

  // Test 5: Permissive confidence filtering
  const { analyzeSimilarity: testPermissive, state: permissiveState, getAllGroups: getAllPermissive } = useVisualSimilarity({
    enabledLayers: {
      fileHash: false,
      tensorFlow: false, 
      metadata: false,
      aiAnalysis: true
    },
    similarityThreshold: 0.5,
    confidenceThreshold: 0.65 // Lower 65% confidence for debugging
  });

  // Available source images
  const availableImages = [
    'newworksite.jpg',     // Pyramid construction
    'newworksite1.jpg',    // Construction workers
    'newworksite2.jpg',    // Deck installation
    'newworksite3.jpg',    // Blue house painting
    'newworksite4.jpg',    // Next image
    'newworksite5.jpg',    // Blue house painting (similar to 3)
    'newworksite10.jpg',   // Deck/framing work
    'newworksite15.jpg',   // House with yellow bottom
    'newworksite20.jpg',   // AR/tech overlay
    'newworksite23.jpg',   // Green/yellow house with robot
    'newworksite24.jpg',   // Duplicate of 23
    'newworksite26.jpg',   // Construction site with excavator
    'newworksite27.jpg',   // Duplicate of 26
    'newworksite28.jpg',   // Duplicate of 26
    'newworksite29.jpg',   // Duplicate of 26
    'newworksite30.jpg',   // Duplicate of 26
  ];

  // Create test photos from your source images
  const createTestPhotos = (count: number = 6): Photo[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-photo-${i}`,
      photo_url: `/source-images/newworksite${i === 0 ? '' : i}.jpg`,
      captured_at: new Date(Date.now() + i * 60000).toISOString(), // 1 minute apart
      project_id: 'test-project-1',
      creator_id: 'test-user',
      description: null,
      tags: [],
      coordinates: [
        {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.001,
          longitude: -74.0060 + (Math.random() - 0.5) * 0.001
        }
      ],
      uris: [
        {
          type: 'original',
          uri: `/source-images/newworksite${i === 0 ? '' : i}.jpg`
        }
      ]
    }));
  };

  const runTest1 = async () => {
    setCurrentTest('Pure AI Analysis (No Filtering)');
    console.log('🧪 TEST 1: Pure AI Analysis - All photos through AI');
    
    const testPhotos = createTestPhotos(6);
    console.log('Test photos:', testPhotos.map(p => p.photo_url));
    console.log('⚠️ Note: Google Vision API is currently unavailable (503 error)');
    console.log('   This test validates the pipeline structure but cannot test visual similarity');
    
    try {
      const results = await testPureAI(testPhotos);
      setTestResults(results);
      console.log('✅ Test 1 Results:', results);
      console.log('   Expected: 0 groups (due to API unavailability)');
      console.log('   In production: Would find 1-2 similarity groups');
    } catch (error) {
      console.error('❌ Test 1 Failed:', error);
    }
  };

  const runTest2 = async () => {
    setCurrentTest('TensorFlow + AI (No Temporal Filtering)');
    console.log('🧪 TEST 2: TensorFlow + AI - Skip temporal filtering');
    
    const testPhotos = createTestPhotos(8);
    console.log('Test photos:', testPhotos.map(p => p.photo_url));
    
    try {
      const results = await testWithTensorFlow(testPhotos);
      setTestResults(results);
      console.log('✅ Test 2 Results:', results);
    } catch (error) {
      console.error('❌ Test 2 Failed:', error);
    }
  };

  const runTest3 = async () => {
    setCurrentTest('Production Mode (All Layers)');
    console.log('🧪 TEST 3: Production mode - All layers enabled');
    
    const testPhotos = createTestPhotos(10);
    console.log('Test photos:', testPhotos.map(p => p.photo_url));
    
    try {
      const results = await testProduction(testPhotos);
      setTestResults(results);
      console.log('✅ Test 3 Results:', results);
    } catch (error) {
      console.error('❌ Test 3 Failed:', error);
    }
  };

  const runCustomTest = async () => {
    if (selectedPhotos.length < 2) {
      alert('Please select at least 2 photos to compare');
      return;
    }

    setCurrentTest('Custom Photo Selection');
    console.log('🧪 CUSTOM TEST: Selected photos comparison');
    console.log('Selected photos:', selectedPhotos);
    
    // Create photo objects for selected images
    const customPhotos: Photo[] = selectedPhotos.map((filename, index) => {
      const fullUrl = `${window.location.origin}/source-images/${filename}`;
      return {
        id: `custom-photo-${index}`,
        photo_url: fullUrl,
        captured_at: new Date().toISOString(),
        project_id: 'custom-test-project',
        creator_id: 'test-user',
        description: null,
        tags: [],
        coordinates: [
          {
            latitude: 40.7128 + (Math.random() - 0.5) * 0.001,
            longitude: -74.0060 + (Math.random() - 0.5) * 0.001
          }
        ],
        uris: [
          {
            type: 'original',
            uri: fullUrl
          }
        ]
      };
    });

    console.log('Custom test photos:', customPhotos.map(p => p.photo_url));
    
    try {
      const results = await testCustom(customPhotos);
      setTestResults(results);
      const allGroups = getAllGroups();
      setAllResults(allGroups);
      console.log('✅ Custom Test Results (Filtered >= 85%):', results);
      console.log('📊 All Groups (Including Low Confidence):', allGroups);
      console.log('🔍 Debug - Confidence breakdown:');
      allGroups.forEach((group, i) => {
        const confidence = (group.confidence * 100).toFixed(1);
        const filtered = group.confidence >= 0.85;
        console.log(`  Group ${i + 1}: ${confidence}% confidence ${filtered ? '(SHOWN)' : '(FILTERED OUT)'}`);
      });
    } catch (error) {
      console.error('❌ Custom Test Failed:', error);
    }
  };

  const togglePhotoSelection = (filename: string) => {
    setSelectedPhotos(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const runPermissiveTest = async () => {
    if (selectedPhotos.length < 2) {
      alert('Please select at least 2 photos to compare');
      return;
    }

    setCurrentTest('Permissive Confidence (45%)');
    console.log('🧪 PERMISSIVE TEST: Lower confidence threshold');
    
    const customPhotos: Photo[] = selectedPhotos.map((filename, index) => {
      const fullUrl = `${window.location.origin}/source-images/${filename}`;
      return {
        id: `permissive-photo-${index}`,
        photo_url: fullUrl,
        captured_at: new Date().toISOString(),
        project_id: 'permissive-test-project',
        creator_id: 'test-user',
        description: null,
        tags: [],
        coordinates: [{
          latitude: 40.7128 + (Math.random() - 0.5) * 0.001,
          longitude: -74.0060 + (Math.random() - 0.5) * 0.001
        }],
        uris: [{ type: 'original', uri: fullUrl }]
      };
    });

    try {
      const results = await testPermissive(customPhotos);
      setTestResults(results);
      const allGroups = getAllPermissive();
      setAllResults(allGroups);
      console.log('✅ Permissive Test Results (45% threshold):', results);
      console.log('📊 All Groups (Including Low Confidence):', allGroups);
    } catch (error) {
      console.error('❌ Permissive Test Failed:', error);
    }
  };

  const getCurrentState = () => {
    switch (currentTest) {
      case 'Pure AI Analysis (No Filtering)':
        return pureAIState;
      case 'TensorFlow + AI (No Temporal Filtering)':
        return tensorFlowState;
      case 'Production Mode (All Layers)':
        return productionState;
      case 'Custom Photo Selection':
        return customState;
      case 'Permissive Confidence (45%)':
        return permissiveState;
      default:
        return { isAnalyzing: false, progress: 0, error: null };
    }
  };

  const state = getCurrentState();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔍 Visual Similarity Layer Toggle Tests</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Test your 36 construction images with different pipeline configurations</strong></p>
        <p>Open browser console (F12) to see detailed logs</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={runTest1}
          disabled={state.isAnalyzing}
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#007acc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: state.isAnalyzing ? 'not-allowed' : 'pointer'
          }}
        >
          Test 1: Pure AI Analysis
        </button>
        
        <button 
          onClick={runTest2}
          disabled={state.isAnalyzing}
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: state.isAnalyzing ? 'not-allowed' : 'pointer'
          }}
        >
          Test 2: TensorFlow + AI
        </button>
        
        <button 
          onClick={runTest3}
          disabled={state.isAnalyzing}
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: state.isAnalyzing ? 'not-allowed' : 'pointer'
          }}
        >
          Test 3: Production Mode
        </button>
        
        <button 
          onClick={() => setShowCustomTest(!showCustomTest)}
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#6f42c1', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {showCustomTest ? 'Hide' : 'Show'} Custom Photo Selector
        </button>
      </div>

      {showCustomTest && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '5px'
        }}>
          <h3>🖼️ Custom Photo Selection</h3>
          <p>Select 2 or more photos to test visual similarity (bypasses all filtering)</p>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '10px',
            marginBottom: '15px'
          }}>
            {availableImages.map(filename => (
              <div 
                key={filename}
                onClick={() => togglePhotoSelection(filename)}
                style={{
                  padding: '10px',
                  border: selectedPhotos.includes(filename) ? '2px solid #007acc' : '1px solid #ccc',
                  borderRadius: '5px',
                  backgroundColor: selectedPhotos.includes(filename) ? '#e9f7ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {filename}
                </div>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  {filename === 'newworksite.jpg' && '🏺 Pyramid'}
                  {filename === 'newworksite3.jpg' && '🏠 Blue House'}
                  {filename === 'newworksite5.jpg' && '🏠 Blue House (Similar)'}
                  {filename === 'newworksite2.jpg' && '🔨 Deck Work'}
                  {filename === 'newworksite10.jpg' && '🔨 Framing'}
                  {filename === 'newworksite23.jpg' && '🏡 Green House'}
                  {filename === 'newworksite24.jpg' && '🏡 Green House (Duplicate)'}
                  {filename.includes('26') || filename.includes('27') || filename.includes('28') || filename.includes('29') || filename.includes('30') ? '🚧 Construction Site' : ''}
                </div>
                {selectedPhotos.includes(filename) && (
                  <div style={{ color: '#007acc', fontWeight: 'bold', fontSize: '14px' }}>
                    ✓ Selected
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <strong>Selected:</strong> {selectedPhotos.length} photos
            {selectedPhotos.length > 0 && (
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}>
                ({selectedPhotos.join(', ')})
              </span>
            )}
          </div>

          {selectedPhotos.length > 0 && (
            <div style={{ 
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '5px'
            }}>
              <h4 style={{ margin: '0 0 10px 0' }}>📸 Selected Photos Preview:</h4>
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                flexWrap: 'wrap',
                overflowX: 'auto'
              }}>
                {selectedPhotos.map(filename => (
                  <div key={filename} style={{ 
                    textAlign: 'center',
                    minWidth: '120px'
                  }}>
                    <img 
                      src={`/source-images/${filename}`}
                      alt={filename}
                      style={{
                        width: '120px',
                        height: '90px',
                        objectFit: 'cover',
                        border: '2px solid #007acc',
                        borderRadius: '5px',
                        marginBottom: '5px'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{ 
                      fontSize: '10px', 
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      {filename}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={runCustomTest}
              disabled={selectedPhotos.length < 2 || state.isAnalyzing}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: selectedPhotos.length >= 2 ? '#6f42c1' : '#ccc',
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: selectedPhotos.length >= 2 && !state.isAnalyzing ? 'pointer' : 'not-allowed'
              }}
            >
              Test Selected Photos
            </button>
            
            <button 
              onClick={() => setSelectedPhotos([])}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#6c757d', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Clear Selection
            </button>
            
            <button 
              onClick={() => setSelectedPhotos(['newworksite23.jpg', 'newworksite24.jpg'])}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Quick: Exact Duplicates
            </button>
            
            <button 
              onClick={runPermissiveTest}
              disabled={selectedPhotos.length < 2 || state.isAnalyzing}
              style={{ 
                padding: '10px 15px', 
                backgroundColor: selectedPhotos.length >= 2 ? '#fd7e14' : '#ccc',
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: selectedPhotos.length >= 2 && !state.isAnalyzing ? 'pointer' : 'not-allowed'
              }}
            >
              Test Permissive (45%)
            </button>
          </div>
        </div>
      )}

      {state.isAnalyzing && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#e9f7ff', 
          border: '1px solid #007acc', 
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3>🔄 {currentTest}</h3>
          <div>Progress: {state.progress}%</div>
          <div style={{ 
            width: '100%', 
            height: '10px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '5px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${state.progress}%`,
              height: '100%',
              backgroundColor: '#007acc',
              transition: 'width 0.3s'
            }}></div>
          </div>
        </div>
      )}

      {state.error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#ffebee', 
          border: '1px solid #dc3545', 
          borderRadius: '5px',
          marginBottom: '20px',
          color: '#dc3545'
        }}>
          <h3>❌ Error</h3>
          <pre>{state.error}</pre>
        </div>
      )}

      {testResults.length > 0 && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '5px'
        }}>
          <h3>📊 Results for: {currentTest}</h3>
          <div style={{ marginBottom: '15px' }}>
            <strong>High-Confidence Groups: {testResults.length}</strong>
            {allResults.length > testResults.length && (
              <span style={{ marginLeft: '15px', color: '#856404' }}>
                ({allResults.length - testResults.length} low-confidence groups filtered out)
              </span>
            )}
            {testResults.length === 0 && (
              <span style={{ color: '#dc3545', marginLeft: '10px' }}>
                No high-confidence groups detected
              </span>
            )}
            
            {allResults.length > testResults.length && (
              <button
                onClick={() => setShowAllGroups(!showAllGroups)}
                style={{
                  marginLeft: '15px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  backgroundColor: showAllGroups ? '#dc3545' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                {showAllGroups ? 'Hide' : 'Show'} Filtered Groups
              </button>
            )}
          </div>
          
          {(showAllGroups ? allResults : testResults).map((group, index) => {
            const isFiltered = !testResults.includes(group);
            return (
              <div key={group.id} style={{ 
                margin: '15px 0', 
                padding: '15px', 
                backgroundColor: isFiltered ? '#fff3cd' : 'white', 
                border: `2px solid ${isFiltered ? '#ffc107' : '#28a745'}`,
                borderRadius: '8px',
                opacity: isFiltered ? 0.8 : 1
              }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>🔗 Similar Group {index + 1}</strong>
                {isFiltered && (
                  <span style={{ 
                    marginLeft: '10px', 
                    padding: '2px 8px', 
                    backgroundColor: '#dc3545', 
                    color: 'white', 
                    borderRadius: '10px', 
                    fontSize: '12px' 
                  }}>
                    FILTERED OUT
                  </span>
                )}
                <span style={{ 
                  marginLeft: '10px', 
                  padding: '2px 8px', 
                  backgroundColor: isFiltered ? '#ffc107' : '#28a745', 
                  color: 'white', 
                  borderRadius: '10px', 
                  fontSize: '12px' 
                }}>
                  {group.groupType.replace('_', ' ')}
                </span>
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <div><strong>Photos:</strong> {group.photos.length}</div>
                <div><strong>Confidence:</strong> {(group.confidence * 100).toFixed(1)}%</div>
                <div><strong>Visual Similarity:</strong> {((group.similarity?.visualSimilarity || 0) * 100).toFixed(1)}%</div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <strong>📁 Files:</strong> {group.photos.map((p: any) => p.photo_url.split('/').pop()).join(', ')}
              </div>

              <div>
                <strong>🖼️ Visual Comparison:</strong>
                <div style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  marginTop: '10px',
                  flexWrap: 'wrap'
                }}>
                  {group.photos.map((photo: any, photoIndex: number) => (
                    <div key={photo.id} style={{ 
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <img 
                        src={photo.photo_url}
                        alt={photo.photo_url.split('/').pop()}
                        style={{
                          width: '150px',
                          height: '112px',
                          objectFit: 'cover',
                          border: '2px solid #28a745',
                          borderRadius: '5px',
                          marginBottom: '5px'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: 'bold',
                        color: '#333'
                      }}>
                        {photo.photo_url.split('/').pop()}
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        left: '5px',
                        backgroundColor: isFiltered ? '#ffc107' : '#28a745',
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        #{photoIndex + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7', 
        borderRadius: '5px'
      }}>
        <h3>🎯 Expected Results</h3>
        <ul>
          <li><strong>Test 1 (Pure AI):</strong> Should detect semantic similarities between photos (similar activities, objects, scenes)</li>
          <li><strong>Test 2 (TensorFlow + AI):</strong> Should detect visual + semantic similarities using computer vision</li>
          <li><strong>Test 3 (Production):</strong> Should efficiently find exact duplicates and time-based clusters</li>
          <li><strong>Custom Tests (85% confidence):</strong> Production-ready, only very confident groups</li>
          <li><strong>Debug Tests (65% confidence):</strong> Lower threshold for testing and comparison</li>
        </ul>
        
        <div style={{ 
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#e9f7ff',
          borderRadius: '5px'
        }}>
          <strong>📊 How to Interpret Results:</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li><strong>High-Confidence Groups:</strong> Green-bordered groups above the confidence threshold</li>
            <li><strong>Filtered Groups:</strong> Yellow-bordered groups that were filtered out (shown when toggled)</li>
            <li><strong>Confidence &gt; 85%:</strong> Production threshold for showing groups (adjustable per test)</li>
            <li><strong>Visual Similarity &gt; 60%:</strong> Strong visual resemblance using semantic embeddings</li>
            <li><strong>"FILTERED OUT" badge:</strong> Indicates low-confidence groups that wouldn't normally be shown</li>
          </ul>
          <p style={{ margin: '5px 0', fontSize: '14px' }}>
            <strong>🔍 Test Strategy:</strong> Compare 85% vs 65% confidence thresholds to see how filtering affects results. Use "Show Filtered Groups" to understand what gets hidden!
          </p>
        </div>
      </div>
    </div>
  );
}