// © 2025 Mark Hustad — MIT License

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryClient } from '../queryClient';

describe('queryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be an instance of QueryClient', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('should have correct default options', () => {
    const defaultOptions = queryClient.getDefaultOptions();
    
    expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000); // 5 minutes
    expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000); // 10 minutes
  });

  describe('retry logic', () => {
    it('should not retry 4xx errors', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const error4xx = Object.assign(new Error('Client error'), { status: 400 });
      const shouldRetry = retryFn(0, error4xx);
      
      expect(shouldRetry).toBe(false);
    });

    it('should not retry 401 unauthorized errors', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const error401 = Object.assign(new Error('Unauthorized'), { status: 401 });
      const shouldRetry = retryFn(0, error401);
      
      expect(shouldRetry).toBe(false);
    });

    it('should not retry 403 forbidden errors', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const error403 = Object.assign(new Error('Forbidden'), { status: 403 });
      const shouldRetry = retryFn(0, error403);
      
      expect(shouldRetry).toBe(false);
    });

    it('should not retry 404 not found errors', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const error404 = Object.assign(new Error('Not Found'), { status: 404 });
      const shouldRetry = retryFn(0, error404);
      
      expect(shouldRetry).toBe(false);
    });

    it('should retry 5xx server errors up to 3 times', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const error500 = Object.assign(new Error('Server Error'), { status: 500 });
      
      expect(retryFn(0, error500)).toBe(true);  // First retry
      expect(retryFn(1, error500)).toBe(true);  // Second retry
      expect(retryFn(2, error500)).toBe(true);  // Third retry
      expect(retryFn(3, error500)).toBe(false); // Should not retry after 3 attempts
    });

    it('should retry network errors up to 3 times', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const networkError = new Error('Network error');
      
      expect(retryFn(0, networkError)).toBe(true);  // First retry
      expect(retryFn(1, networkError)).toBe(true);  // Second retry
      expect(retryFn(2, networkError)).toBe(true);  // Third retry
      expect(retryFn(3, networkError)).toBe(false); // Should not retry after 3 attempts
    });

    it('should retry non-HTTP errors up to 3 times', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry as Function;
      
      const genericError = new Error('Generic error');
      
      expect(retryFn(0, genericError)).toBe(true);
      expect(retryFn(1, genericError)).toBe(true);
      expect(retryFn(2, genericError)).toBe(true);
      expect(retryFn(3, genericError)).toBe(false);
    });
  });

  describe('retry delay', () => {
    it('should implement exponential backoff', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryDelayFn = defaultOptions.queries?.retryDelay as Function;
      
      expect(retryDelayFn(0)).toBe(1000);  // 1 second for first retry
      expect(retryDelayFn(1)).toBe(2000);  // 2 seconds for second retry
      expect(retryDelayFn(2)).toBe(4000);  // 4 seconds for third retry
      expect(retryDelayFn(3)).toBe(8000);  // 8 seconds for fourth retry
    });

    it('should cap retry delay at 30 seconds', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryDelayFn = defaultOptions.queries?.retryDelay as Function;
      
      expect(retryDelayFn(10)).toBe(30000); // Should be capped at 30 seconds
      expect(retryDelayFn(20)).toBe(30000); // Should remain capped
    });
  });

  describe('query methods', () => {
    it('should be able to set and get query data', () => {
      const testKey = ['test', 'key'];
      const testData = { id: 1, name: 'Test' };
      
      queryClient.setQueryData(testKey, testData);
      const retrievedData = queryClient.getQueryData(testKey);
      
      expect(retrievedData).toEqual(testData);
    });

    it('should be able to invalidate queries', async () => {
      const testKey = ['test', 'invalidate'];
      const testData = { id: 1, name: 'Test' };
      
      queryClient.setQueryData(testKey, testData);
      
      // This should not throw an error
      await queryClient.invalidateQueries({ queryKey: testKey });
      
      // After invalidation, data should still be there but stale
      const retrievedData = queryClient.getQueryData(testKey);
      expect(retrievedData).toEqual(testData);
    });

    it('should be able to clear all queries', () => {
      const testKey1 = ['test', 'clear', '1'];
      const testKey2 = ['test', 'clear', '2'];
      
      queryClient.setQueryData(testKey1, { id: 1 });
      queryClient.setQueryData(testKey2, { id: 2 });
      
      queryClient.clear();
      
      expect(queryClient.getQueryData(testKey1)).toBeUndefined();
      expect(queryClient.getQueryData(testKey2)).toBeUndefined();
    });
  });

  describe('query state management', () => {
    it('should track query states correctly', () => {
      const testKey = ['test', 'state'];
      
      // Initially no query should exist
      expect(queryClient.getQueryState(testKey)).toBeUndefined();
      
      // Set some data
      queryClient.setQueryData(testKey, { test: 'data' });
      
      // Now query state should exist
      const queryState = queryClient.getQueryState(testKey);
      expect(queryState).toBeDefined();
      expect(queryState?.data).toEqual({ test: 'data' });
    });

    it('should handle query cache correctly', () => {
      const cache = queryClient.getQueryCache();
      expect(cache).toBeDefined();
      
      // Clear any existing cache
      queryClient.clear();
      
      // Cache should start empty
      expect(cache.getAll()).toHaveLength(0);
      
      // Add some data
      queryClient.setQueryData(['test'], { data: 'test' });
      
      // Cache should now contain the query
      expect(cache.getAll()).toHaveLength(1);
    });
  });
});