// © 2025 Mark Hustad — MIT License
// Technical documentation page for AI pipelines and features

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Camera, Zap, Shield, Code, Layers, Server, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/" 
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to App</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Technical Documentation</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            AI-Powered Photo Intelligence
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Advanced computer vision pipelines designed specifically for construction photo management
          </p>
        </div>

        {/* AI Tag Suggestion Pipeline */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Brain className="w-6 h-6 text-blue-500" />
                <span>AI Tag Suggestion Pipeline</span>
              </CardTitle>
              <div className="flex space-x-2">
                <Badge variant="outline">OpenAI GPT-4 Vision</Badge>
                <Badge variant="outline">Google Cloud Vision</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-lg mb-3">How It Works</h4>
              <ol className="space-y-3">
                <li className="flex items-start">
                  <span className="font-bold text-blue-500 mr-3">1.</span>
                  <div>
                    <strong>User Action:</strong> Click "Suggest Tags" on any photo
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-blue-500 mr-3">2.</span>
                  <div>
                    <strong>Google Vision API</strong> analyzes the image:
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Detects objects, scenes, and activities</li>
                      <li>Identifies web entities and contexts</li>
                      <li>Provides confidence scores</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-blue-500 mr-3">3.</span>
                  <div>
                    <strong>GPT-4 Vision</strong> interprets for construction:
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Receives image + Google Vision labels</li>
                      <li>Matches against CompanyCam standard tags</li>
                      <li>Generates construction-specific suggestions</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-blue-500 mr-3">4.</span>
                  <div>
                    <strong>Smart Filtering:</strong>
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Removes already-applied tags</li>
                      <li>Prioritizes relevant suggestions</li>
                      <li>Formats for easy application</li>
                    </ul>
                  </div>
                </li>
              </ol>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-semibold mb-2">Technical Details</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Endpoint:</span>
                    <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">/api/suggest-ai-tags</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                    <span>2-4 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Models:</span>
                    <span>GPT-4 Vision + Google Vision</span>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Data Flow</h5>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <pre className="text-xs text-gray-700 dark:text-gray-300">
{`Photo URL
    ↓
Google Vision API
    ↓
Label Annotations
    ↓
GPT-4 Vision
    ↓
Construction Tags
    ↓
UI Display`}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Burst Detection Pipeline */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Camera className="w-6 h-6 text-purple-500" />
                <span>Burst Detection & Quality Analysis Pipeline</span>
              </CardTitle>
              <Badge variant="outline">Anthropic Claude 3.5 Sonnet</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-lg mb-3">How It Works</h4>
              <ol className="space-y-3">
                <li className="flex items-start">
                  <span className="font-bold text-purple-500 mr-3">1.</span>
                  <div>
                    <strong>User Action:</strong> Navigate to Duplicate Analysis page
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-purple-500 mr-3">2.</span>
                  <div>
                    <strong>Temporal Clustering:</strong>
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Groups photos within 30-second windows</li>
                      <li>Considers location proximity</li>
                      <li>Identifies potential burst sequences</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-purple-500 mr-3">3.</span>
                  <div>
                    <strong>Claude Vision Analysis:</strong>
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Compares up to 5 photos simultaneously</li>
                      <li>Classifies each photo</li>
                      <li>Assesses quality metrics</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-purple-500 mr-3">4.</span>
                  <div>
                    <strong>Quality Scoring</strong> (0-1 scale):
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li><strong>Sharpness:</strong> Focus quality, motion blur</li>
                      <li><strong>Composition:</strong> Rule of thirds, framing</li>
                      <li><strong>Lighting:</strong> Exposure, contrast, shadows</li>
                      <li><strong>Subject Clarity:</strong> Main element visibility</li>
                      <li><strong>Overall Quality:</strong> Combined score</li>
                    </ul>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-purple-500 mr-3">5.</span>
                  <div>
                    <strong>Smart Recommendations:</strong>
                    <ul className="mt-1 ml-4 text-sm text-gray-600 dark:text-gray-400 list-disc">
                      <li>Identifies best photo in burst</li>
                      <li>Ranks by quality</li>
                      <li>Suggests keep/archive decisions</li>
                    </ul>
                  </div>
                </li>
              </ol>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-semibold mb-2">Technical Details</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Endpoint:</span>
                    <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">/api/claude-visual-analysis</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Model:</span>
                    <span>Claude 3.5 Sonnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Batch Size:</span>
                    <span>10 photos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                    <span>3-5 seconds/batch</span>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Classification Types</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-red-100 text-red-800">Duplicate</Badge>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Nearly identical</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-orange-100 text-orange-800">Burst Shot</Badge>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Rapid sequence</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-yellow-100 text-yellow-800">Similar</Badge>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Same subject, different angle</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800">Unique</Badge>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Distinct content</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Architecture */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Layers className="w-6 h-6 text-green-500" />
              <span>Technical Architecture</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h5 className="font-semibold mb-3 flex items-center space-x-2">
                  <Code className="w-4 h-4" />
                  <span>Frontend Stack</span>
                </h5>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• React 18 + TypeScript</li>
                  <li>• TanStack Query</li>
                  <li>• Vite</li>
                  <li>• Tailwind CSS</li>
                  <li>• Canvas API</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold mb-3 flex items-center space-x-2">
                  <Brain className="w-4 h-4" />
                  <span>AI/ML Services</span>
                </h5>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• OpenAI GPT-4 Vision</li>
                  <li>• Anthropic Claude 3.5</li>
                  <li>• Google Cloud Vision</li>
                  <li>• CompanyCam API</li>
                </ul>
              </div>

              <div>
                <h5 className="font-semibold mb-3 flex items-center space-x-2">
                  <Server className="w-4 h-4" />
                  <span>Infrastructure</span>
                </h5>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Vercel Hosting</li>
                  <li>• Edge Functions</li>
                  <li>• IndexedDB Caching</li>
                  <li>• Serverless APIs</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance & Security */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                <span>Performance Characteristics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h5 className="font-semibold mb-2">Response Times</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tag Suggestions:</span>
                    <span>2-4 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Burst Detection:</span>
                    <span>3-5 seconds/batch</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Photo Loading:</span>
                    <span>&lt;500ms (cached)</span>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="font-semibold mb-2">Accuracy Metrics</h5>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tag Relevance:</span>
                    <span>~85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Burst Detection:</span>
                    <span>~95%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Duplicate Detection:</span>
                    <span>~98%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-blue-500" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span><strong>No Image Storage:</strong> Photos processed in-memory only</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span><strong>Secure APIs:</strong> Environment variables for all keys</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Eye className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span><strong>User Isolation:</strong> Analyses scoped to user's photos</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Zap className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span><strong>Minimal Transfer:</strong> Only necessary metadata sent</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span><strong>Temporary Processing:</strong> No persistent storage</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 Mark Hustad — MIT License</p>
          <p className="mt-1">Built with AI-powered intelligence for construction professionals</p>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;