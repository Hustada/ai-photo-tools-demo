import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { BlogPost } from '../../api/blog-posts';

interface DraftReviewProps {
  draftId: string;
  onPublish?: (draft: BlogPost) => void;
  onCancel?: () => void;
}

export const DraftReview: React.FC<DraftReviewProps> = ({ 
  draftId, 
  onPublish, 
  onCancel 
}) => {
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const [editableTitle, setEditableTitle] = useState('');
  const [editableExcerpt, setEditableExcerpt] = useState('');
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDraft();
  }, [draftId]);

  const loadDraft = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would load from the drafts directory
      // For now, this is a placeholder for the UI structure
      setError('Draft loading not implemented yet - use CLI commands');
    } catch (err) {
      setError('Failed to load draft');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (draft) {
      setEditableTitle(draft.metadata.title);
      setEditableExcerpt(draft.metadata.excerpt);
      setEditableContent(draft.rawContent);
      setEditableTags([...draft.metadata.tags]);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (draft) {
      const updatedDraft: BlogPost = {
        ...draft,
        metadata: {
          ...draft.metadata,
          title: editableTitle,
          excerpt: editableExcerpt,
          tags: editableTags,
        },
        rawContent: editableContent,
        content: editableContent, // In a real app, this would be processed
        updatedAt: new Date().toISOString(),
      };
      setDraft(updatedDraft);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handlePublish = () => {
    if (draft && onPublish) {
      onPublish(draft);
    }
  };

  const addTag = (tag: string) => {
    if (tag && !editableTags.includes(tag)) {
      setEditableTags([...editableTags, tag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditableTags(editableTags.filter(tag => tag !== tagToRemove));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Draft</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="text-sm text-gray-600">
          <p>Use the CLI commands to work with drafts:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><code className="bg-gray-100 px-2 py-1 rounded">npm run docs:preview</code> - Generate draft</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">npm run docs:publish</code> - Publish draft</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No draft found with ID: {draftId}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Draft Review</h1>
        <div className="flex space-x-3">
          {!isEditing ? (
            <>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Publish
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editing Mode */}
      {isEditing ? (
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={editableTitle}
              onChange={(e) => setEditableTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt
            </label>
            <textarea
              value={editableExcerpt}
              onChange={(e) => setEditableExcerpt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {editableTags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-orange-600 hover:text-orange-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content (Markdown)
            </label>
            <textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
            />
          </div>
        </div>
      ) : (
        /* Preview Mode */
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">{draft.metadata.title}</h2>
            <p className="text-gray-600 mb-3">{draft.metadata.excerpt}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {draft.metadata.tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              Reading time: {draft.metadata.readingTime} min
            </div>
          </div>

          {/* Content Preview */}
          <div className="border rounded-lg p-6">
            <MarkdownRenderer content={draft.rawContent} />
          </div>
        </div>
      )}
    </div>
  );
};