// © 2025 Mark Hustad — MIT License
import { useState, useCallback } from 'react';
import type { Photo } from '../types';

export interface ChatSearchResult {
  photos: Photo[];
  searchCriteria: {
    keywords?: string[];
    dateRange?: { start: string; end: string };
    tags?: string[];
    creatorNames?: string[];
    projectNames?: string[];
  };
  summary: string;
}

export interface ChatStreamEvent {
  conversationId: string;
  type: 'thinking' | 'extracting' | 'searching' | 'photos' | 'summary' | 'error';
  content: string | Photo[] | any;
  metadata?: {
    totalFound?: number;
    searchCriteria?: any;
    processingTime?: number;
  };
}

export function usePhotoChat() {
  const [conversationId, setConversationId] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPhotos = useCallback(async (
    query: string,
    options?: {
      projectId?: string;
      limit?: number;
      onProgress?: (event: ChatStreamEvent) => void;
    }
  ): Promise<ChatSearchResult> => {
    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          conversationId,
          projectId: options?.projectId,
          limit: options?.limit || 20,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let photos: Photo[] = [];
      let searchCriteria = {};
      let summary = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ChatStreamEvent = JSON.parse(line.slice(6));
              
              // Update conversation ID
              if (data.conversationId) {
                setConversationId(data.conversationId);
              }

              // Call progress callback if provided
              if (options?.onProgress) {
                options.onProgress(data);
              }

              // Handle different event types
              switch (data.type) {
                case 'photos':
                  photos = data.content as Photo[];
                  if (data.metadata?.searchCriteria) {
                    searchCriteria = data.metadata.searchCriteria;
                  }
                  break;
                
                case 'summary':
                  summary = data.content as string;
                  break;
                
                case 'error':
                  throw new Error(data.content as string);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
              if (e instanceof Error && e.message.includes('error')) {
                throw e;
              }
            }
          }
        }
      }

      return {
        photos,
        searchCriteria,
        summary,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search photos';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [conversationId]);

  const resetConversation = useCallback(() => {
    setConversationId(undefined);
    setError(null);
  }, []);

  return {
    searchPhotos,
    isSearching,
    error,
    conversationId,
    resetConversation,
  };
}