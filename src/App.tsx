// 2025 Mark Hustad — MIT License
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import TestSimilarity from './pages/test-similarity';
import BlogPage from './pages/BlogPage';

// Simple component to protect routes
const ProtectedRoute: React.FC = () => {
  const apiKey = localStorage.getItem('companyCamApiKey');
  console.log('ProtectedRoute: Checking for API Key. Found:', apiKey ? 'Yes' : 'No');
  if (!apiKey) {
    console.log('ProtectedRoute: No API Key found, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  // If API key exists, render the child routes (e.g., HomePage)
  return <Outlet />;
};

function App() {
  console.log('App component rendering - setting up routes');
  return (
      <div className="w-full min-h-screen"> {/* Base container for the app */}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route element={<ProtectedRoute />}>
            {/* Routes nested under ProtectedRoute require an API key */}
            <Route path="/" element={<HomePage />} />
            <Route path="/test-similarity" element={<TestSimilarity />} />
            {/* Add other protected routes here if needed */}
          </Route>
          {/* Fallback route for any undefined paths, could redirect to / or a 404 page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
  );
}

export default App;
