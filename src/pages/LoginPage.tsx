// © 2024 Mark Hustad — MIT License
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import scoutAiAvatar from '../assets/scout-ai-avatar-orange2.png';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const demoApiKey = import.meta.env.VITE_DEMO_API_KEY;

  const handleLogin = () => {
    console.log('LoginPage: Attempting to login with API Key:', apiKey.substring(0, 10) + '...'); // Log a snippet for security
    if (apiKey.trim() === '') {
      alert('Please enter an API Key.');
      console.warn('LoginPage: API Key input is empty.');
      return;
    }
    localStorage.setItem('companyCamApiKey', apiKey);
    localStorage.removeItem('isDemo'); // Clear demo flag if using own key
    // Clear photo cache to force fresh fetch from API
    localStorage.removeItem('scout-ai-photos-cache');
    console.log('LoginPage: API Key stored and cache cleared.');
    setApiKey(''); // Clear the input field
    console.log('LoginPage: Navigating to /');
    navigate('/'); // Navigate to HomePage 
  };

  const handleDemoLogin = () => {
    if (!demoApiKey) {
      alert('Demo mode is not configured. Please use your own API key.');
      return;
    }
    console.log('LoginPage: Starting demo mode');
    localStorage.setItem('companyCamApiKey', demoApiKey);
    localStorage.setItem('isDemo', 'true');
    // Clear photo cache to force fresh fetch from API
    localStorage.removeItem('scout-ai-photos-cache');
    console.log('LoginPage: Demo mode activated, cache cleared, navigating to /');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-200 p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img 
            src={scoutAiAvatar} 
            alt="Scout AI" 
            className="w-16 h-16 rounded-full object-cover shadow-lg mb-4"
          />
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Scout AI</h1>
          <p className="text-gray-400 text-center text-sm">
            Experience AI-powered photo intelligence
          </p>
        </div>
        
        {/* Demo Mode Button - Primary */}
        <button
          onClick={handleDemoLogin}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 px-4 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 mb-3"
        >
          🚀 Try Demo
        </button>
        <p className="text-xs text-gray-500 text-center mb-4">
          {demoApiKey ? 'Explore with sample project data' : 'Demo mode requires configuration'}
        </p>
        
        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">OR</span>
          </div>
        </div>
        
        {/* API Key Section - Collapsible */}
        {!showApiKeyInput ? (
          <button
            onClick={() => setShowApiKeyInput(true)}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 border border-gray-600"
          >
            🔑 Use Your Own API Key
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-center">
              Connect to your own CompanyCam project to analyze your photos
            </p>
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
                CompanyCam API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
                placeholder="Paste your project API key here"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 border border-gray-600"
            >
              Login with API Key
            </button>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-4 text-center">
          {showApiKeyInput ? 'Your API key will be stored locally in your browser.' : 'No account needed to try the demo'}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
