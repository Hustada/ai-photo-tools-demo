// © 2025 Mark Hustad — MIT License
// Feedback collection UI components for Scout AI

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Edit3, Check, X } from 'lucide-react';
import { useScoutAiFeedback, ItemType } from '../hooks/useScoutAiFeedback';

interface FeedbackButtonsProps {
  itemId: string;
  itemType: ItemType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showEdit?: boolean;
  editableContent?: string;
  metadata?: Record<string, any>;
  onFeedbackSubmitted?: (feedback: 'positive' | 'negative' | 'edit') => void;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  itemId,
  itemType,
  className = '',
  size = 'sm',
  showEdit = false,
  editableContent,
  metadata,
  onFeedbackSubmitted,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(editableContent || '');
  
  const {
    submitPositiveFeedback,
    submitNegativeFeedback,
    submitEditFeedback,
    isSubmitting,
  } = useScoutAiFeedback();

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSize = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const handlePositiveFeedback = async () => {
    await submitPositiveFeedback(itemId, itemType, metadata, {
      onSuccess: () => {
        setFeedbackGiven('positive');
        onFeedbackSubmitted?.('positive');
      },
    });
  };

  const handleNegativeFeedback = async () => {
    await submitNegativeFeedback(itemId, itemType, metadata, {
      onSuccess: () => {
        setFeedbackGiven('negative');
        onFeedbackSubmitted?.('negative');
      },
    });
  };

  const handleEditSubmit = async () => {
    if (editValue.trim() && editValue !== editableContent) {
      await submitEditFeedback(itemId, itemType, editValue, metadata, {
        onSuccess: () => {
          setIsEditing(false);
          onFeedbackSubmitted?.('edit');
        },
      });
    }
  };

  if (isEditing && showEdit) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="flex-1 px-2 py-1 text-sm border rounded"
          autoFocus
          disabled={isSubmitting}
        />
        <button
          onClick={handleEditSubmit}
          disabled={isSubmitting || !editValue.trim() || editValue === editableContent}
          className={`p-1 rounded hover:bg-green-100 disabled:opacity-50 ${sizeClasses[size]}`}
          title="Save edit"
        >
          <Check size={iconSize[size]} className="text-green-600" />
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setEditValue(editableContent || '');
          }}
          disabled={isSubmitting}
          className={`p-1 rounded hover:bg-red-100 ${sizeClasses[size]}`}
          title="Cancel edit"
        >
          <X size={iconSize[size]} className="text-red-600" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={handlePositiveFeedback}
        disabled={isSubmitting || feedbackGiven !== null}
        className={`p-1 rounded transition-all ${sizeClasses[size]} ${
          feedbackGiven === 'positive'
            ? 'bg-green-100 text-green-600'
            : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
        } disabled:opacity-50`}
        title="Helpful"
      >
        <ThumbsUp size={iconSize[size]} fill={feedbackGiven === 'positive' ? 'currentColor' : 'none'} />
      </button>
      
      <button
        onClick={handleNegativeFeedback}
        disabled={isSubmitting || feedbackGiven !== null}
        className={`p-1 rounded transition-all ${sizeClasses[size]} ${
          feedbackGiven === 'negative'
            ? 'bg-red-100 text-red-600'
            : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
        } disabled:opacity-50`}
        title="Not helpful"
      >
        <ThumbsDown size={iconSize[size]} fill={feedbackGiven === 'negative' ? 'currentColor' : 'none'} />
      </button>
      
      {showEdit && editableContent && (
        <button
          onClick={() => setIsEditing(true)}
          disabled={isSubmitting || feedbackGiven !== null}
          className={`p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 ${sizeClasses[size]}`}
          title="Edit"
        >
          <Edit3 size={iconSize[size]} />
        </button>
      )}
    </div>
  );
};

// Inline feedback component for chat messages
interface InlineFeedbackProps {
  messageId: string;
  className?: string;
}

export const InlineFeedback: React.FC<InlineFeedbackProps> = ({
  messageId,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
      <span>Was this helpful?</span>
      <FeedbackButtons
        itemId={messageId}
        itemType="chat_response"
        size="sm"
      />
    </div>
  );
};