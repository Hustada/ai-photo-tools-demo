// © 2025 Mark Hustad — MIT License

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
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

  const apiKey = import.meta.env.VITE_APP_COMPANYCAM_API_KEY;

  const fetchUserContext = useCallback(async () => {
    if (!apiKey) {
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
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchUserContext();
  }, [fetchUserContext]);

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
