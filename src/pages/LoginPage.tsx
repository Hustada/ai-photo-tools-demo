// © 2024 Mark Hustad — MIT License
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string>('');

  const handleLogin = () => {
    console.log('LoginPage: Attempting to login with API Key:', apiKey.substring(0, 10) + '...'); // Log a snippet for security
    if (apiKey.trim() === '') {
      alert('Please enter an API Key.');
      console.warn('LoginPage: API Key input is empty.');
      return;
    }
    localStorage.setItem('companyCamApiKey', apiKey);
    console.log('LoginPage: API Key stored in localStorage.');
    setApiKey(''); // Clear the input field
    console.log('LoginPage: Navigating to /');
    navigate('/'); // Navigate to HomePage 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-200 p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-sky-400 mb-6 text-center">Login</h1>
        <p className="text-gray-400 mb-6 text-center text-sm">
          Enter your CompanyCam API Key to access Scout AI.
        </p>
        <div className="mb-4">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
            CompanyCam API Key
          </label>
          <input
            type="password" // Use password type to obscure the key visually
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-gray-500"
            placeholder="Paste your API key here"
          />
        </div>
        <button
          onClick={handleLogin}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          Login
        </button>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Your API key will be stored locally in your browser.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
