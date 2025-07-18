// © 2025 Mark Hustad — MIT License
// Feedback collection hook for Scout AI interactions

import { useState, useCallback } from 'react';
import { useScoutAi } from '../contexts/ScoutAiContext';

export type FeedbackType = 'positive' | 'negative' | 'edit';
export type ItemType = 'suggestion' | 'tag' | 'description' | 'chat_response';

interface FeedbackOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useScoutAiFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scoutAi = useScoutAi();

  const submitFeedback = useCallback(async (
    itemId: string,
    itemType: ItemType,
    feedback: FeedbackType,
    editedContent?: string,
    metadata?: Record<string, any>,
    options?: FeedbackOptions
  ) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/scout-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          context: {
            userType: scoutAi.userType,
            confidence: scoutAi.contextConfidence,
            sessionId: sessionStorage.getItem('scout-session-id') || undefined,
            userId: localStorage.getItem('user-id') || undefined,
          },
          payload: {
            itemId,
            itemType,
            feedback,
            editedContent,
            metadata: {
              ...metadata,
              timestamp: new Date().toISOString(),
              pageUrl: window.location.href,
              userAgent: navigator.userAgent,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      const result = await response.json();
      console.log('[Scout AI Feedback] Submitted:', result);

      // Call success callback if provided
      options?.onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(errorMessage);
      console.error('[Scout AI Feedback] Error:', err);
      
      // Call error callback if provided
      options?.onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  }, [scoutAi.userType, scoutAi.contextConfidence]);

  // Helper for quick positive feedback
  const submitPositiveFeedback = useCallback((
    itemId: string,
    itemType: ItemType,
    metadata?: Record<string, any>,
    options?: FeedbackOptions
  ) => {
    return submitFeedback(itemId, itemType, 'positive', undefined, metadata, options);
  }, [submitFeedback]);

  // Helper for quick negative feedback
  const submitNegativeFeedback = useCallback((
    itemId: string,
    itemType: ItemType,
    metadata?: Record<string, any>,
    options?: FeedbackOptions
  ) => {
    return submitFeedback(itemId, itemType, 'negative', undefined, metadata, options);
  }, [submitFeedback]);

  // Helper for edit feedback
  const submitEditFeedback = useCallback((
    itemId: string,
    itemType: ItemType,
    editedContent: string,
    metadata?: Record<string, any>,
    options?: FeedbackOptions
  ) => {
    return submitFeedback(itemId, itemType, 'edit', editedContent, metadata, options);
  }, [submitFeedback]);

  return {
    submitFeedback,
    submitPositiveFeedback,
    submitNegativeFeedback,
    submitEditFeedback,
    isSubmitting,
    error,
  };
}