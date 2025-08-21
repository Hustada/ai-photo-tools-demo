// © 2025 Mark Hustad — MIT License
import React from 'react';
import { useNavigate } from 'react-router-dom';

const DemoBanner: React.FC = () => {
  const navigate = useNavigate();
  const isDemo = localStorage.getItem('isDemo') === 'true';

  if (!isDemo) return null;

  const handleExitDemo = () => {
    localStorage.removeItem('companyCamApiKey');
    localStorage.removeItem('isDemo');
    navigate('/login');
  };

  return (
    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 text-center relative">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm font-medium">
          🎭 Demo Mode - Using test project data
        </span>
        <button
          onClick={handleExitDemo}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
        >
          Exit Demo
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;