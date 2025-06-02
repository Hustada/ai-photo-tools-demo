import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App';
import { UserContextProvider } from './contexts/UserContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserContextProvider>
      <App />
    </UserContextProvider>
  </StrictMode>,
)
