// © 2025 Mark Hustad — MIT License
import React from 'react';
import { PhotoChatBubble } from '../components/PhotoChatBubble';

export const ChatTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Photo Chat Test Page
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="space-y-2 text-gray-700">
            <li>1. Click the orange chat bubble in the bottom-right corner</li>
            <li>2. Try queries like:
              <ul className="ml-6 mt-2 space-y-1 text-sm">
                <li>• "Show foundation photos"</li>
                <li>• "Find roofing damage from March"</li>
                <li>• "Show all plumbing issues"</li>
              </ul>
            </li>
            <li>3. Check the console for found photos</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> If no photos are found, you may need to run{' '}
            <code className="bg-yellow-100 px-1 py-0.5 rounded">npm run index:photos</code>{' '}
            to populate the Pinecone index with test data.
          </p>
        </div>
      </div>

      <PhotoChatBubble
        onPhotosFound={(photos) => {
          console.log('[ChatTest] Found photos:', photos);
          alert(`Found ${photos.length} photos! Check the console for details.`);
        }}
      />
    </div>
  );
};