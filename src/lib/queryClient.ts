// © 2025 Mark Hustad — MIT License

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30 minutes - photos don't change frequently
      staleTime: 30 * 60 * 1000,
      // Keep in cache for 2 hours
      gcTime: 2 * 60 * 60 * 1000,
      // Retry failed requests with smart logic for rate limiting
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 429 (rate limit)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status === 429) {
            // Retry rate limit errors up to 5 times
            return failureCount < 5;
          }
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      // Exponential backoff: 1s, 2s, 4s
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Don't refetch on window focus to reduce API calls
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data exists
      refetchOnMount: false,
      // Refetch on network reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});