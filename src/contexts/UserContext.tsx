// © 2025 Mark Hustad — MIT License

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import type {
  CurrentUser,
  CompanyDetails,
  Project,
  UserContextType,
} from '../types'; // Path adjusted from ./types
import { companyCamService } from '../services/companyCamService'; // Path adjusted from ./services/companyCamService

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserContextProviderProps {
  children: ReactNode;
}

export const UserContextProvider: React.FC<UserContextProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation(); // Get location object
  // API key will be retrieved from localStorage within fetchUserContext

  const fetchUserContext = useCallback(async () => {
    const apiKeyFromStorage = localStorage.getItem('companyCamApiKey');
    console.log('[UserContext] Attempting to fetch user context. API Key from localStorage:', apiKeyFromStorage ? 'Found' : 'Not Found');

    if (!apiKeyFromStorage) {
      // setError('API key not found in local storage. Please login.'); // User should be redirected by ProtectedRoute
      // setLoading(false);
      // console.warn('[UserContext] CompanyCam API key is missing from localStorage.');
      // setCurrentUser(null); // Clear user data if no key
      // setCompanyDetails(null);
      // setProjects([]);
      // setLoading(false); // Ensure loading is false if we don't fetch
      // The ProtectedRoute should handle redirection, so this context might not even load
      // if no key. If it does load, it will simply have no user data.
      // For robustness, ensure loading is false and no data is present if no key.
      setCurrentUser(null);
      setCompanyDetails(null);
      setProjects([]);
      setError('No API Key found. Please log in.'); // Informative error if context somehow loads without key
      setLoading(false);
      return;
    }

    // Use apiKeyFromStorage for the rest of the function
    const apiKey = apiKeyFromStorage; // Shadowing for minimal changes below

    if (!apiKey) { // This check is now somewhat redundant due to above but kept for safety / structure
      setError('API key is not configured.');
      setLoading(false);
      console.error('[UserContext] CompanyCam API key is missing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('[UserContext] Fetching current user...');
      const user = await companyCamService.getCurrentUser(apiKey);
      setCurrentUser(user);
      console.log('[UserContext] Current user fetched:', user);

      if (user && user.company_id) {
        console.log(`[UserContext] Fetching company details for company_id: ${user.company_id}...`);
        const company = await companyCamService.getCompanyDetails(apiKey, user.company_id);
        setCompanyDetails(company);
        console.log('[UserContext] Company details fetched:', company);
      }

      console.log('[UserContext] Fetching projects...');
      const userProjects = await companyCamService.getProjects(apiKey);
      setProjects(userProjects);
      console.log('[UserContext] Projects fetched:', userProjects);

    } catch (err: any) {
      console.error('[UserContext] Error fetching user context:', err);
      setError(err.message || 'Failed to fetch user context');
      // Clear data on error to prevent stale display
      setCurrentUser(null);
      setCompanyDetails(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []); // Dependency array is now empty as apiKey is read inside the callback

  useEffect(() => {
    console.log('[UserContext] useEffect triggered due to fetchUserContext or location change. Pathname:', location.pathname);
    fetchUserContext();
  }, [fetchUserContext, location.pathname]); // Add location.pathname as a dependency

  return (
    <UserContext.Provider
      value={{
        currentUser,
        companyDetails,
        projects,
        loading,
        error,
        fetchUserContext, // Expose refetch capability
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserContextProvider');
  }
  return context;
};
