// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadBlogPost, getAllBlogPosts, BlogPostContent, BlogPostMetadata } from '../utils/markdownLoader';
import { generateBlogHeroImage } from '../utils/imageGeneration';
import BlogArticle from '../components/BlogArticle';

// Helper function to format dates for display
const formatDisplayDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    // Check if it's a valid date
    if (isNaN(date.getTime())) {
      // If not a valid date, return as-is (might already be formatted)
      return dateString;
    }
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPostMetadata[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPostContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBlogPosts = async () => {
      try {
        console.log('[BlogPage] Loading blog posts...');
        
        // Try to load from API first (new system)
        let blogPosts: BlogPostMetadata[] = [];
        try {
          const response = await fetch('/api/blog-posts');
          if (response.ok) {
            const apiResponse = await response.json();
            if (apiResponse.success && apiResponse.posts) {
              console.log('[BlogPage] Loaded posts from API:', apiResponse.posts.length);
              
              // Convert API posts to BlogPostMetadata format
              blogPosts = apiResponse.posts.map((post: any) => ({
                id: post.metadata.id,
                title: post.metadata.title,
                author: post.metadata.author,
                date: post.metadata.date,
                description: post.metadata.excerpt || post.metadata.description || 'Technical development insights',
                filename: post.metadata.slug || post.metadata.id,
                readingTime: post.metadata.readingTime,
                tags: post.metadata.tags || [],
                heroImage: `/blog-images/${post.metadata.id}-hero.jpg`
              }));
              
              // API already sorts by date (newest first), so no need to sort again
            }
          }
        } catch (apiError) {
          console.warn('[BlogPage] API not available, falling back to markdown:', apiError);
        }
        
        // Fallback to markdown system if API fails or no posts found
        if (blogPosts.length === 0) {
          blogPosts = await getAllBlogPosts();
        }
        
        setPosts(blogPosts);
        
        // Generate hero images for all posts in the background
        setGeneratingImages(true);
        await generateHeroImages(blogPosts);
        setGeneratingImages(false);
        
      } catch (error) {
        console.error('[BlogPage] Error loading blog posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBlogPosts();
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateHeroImages = async (blogPosts: BlogPostMetadata[]) => {
    // Generate images in the background - the API will handle caching automatically
    // This ensures images are available but doesn't block the UI
    console.log(`[BlogPage] Ensuring hero images are available for ${blogPosts.length} posts`);
    
    const imagePromises = blogPosts.map(async (post) => {
      try {
        const result = await generateBlogHeroImage(
          post.id,
          post.title,
          post.description,
          { style: 'technical' }
        );
        
        if (result.cached) {
          console.log(`[BlogPage] Using cached image for: ${post.id}`);
        } else {
          console.log(`[BlogPage] Generated new image for: ${post.id}`);
        }
      } catch (error) {
        console.warn(`[BlogPage] Failed to ensure image for ${post.id}:`, error);
      }
    });

    // Don't wait for all images to complete - let them load in background
    Promise.allSettled(imagePromises);
  };

  const loadPostContent = async (post: BlogPostMetadata) => {
    try {
      setLoadingPost(true);
      console.log(`[BlogPage] Loading post content: ${post.id}`);
      
      // Try to load from API first
      let postContent: BlogPostContent | null = null;
      
      try {
        const response = await fetch(`/api/blog-posts?id=${post.id}`);
        if (response.ok) {
          const apiResponse = await response.json();
          if (apiResponse.success && apiResponse.post) {
            console.log(`[BlogPage] Loaded from API: ${apiResponse.post.metadata.title}`);
            
            postContent = {
              metadata: {
                ...post,
                heroImage: `/blog-images/${post.id}-hero.jpg`
              },
              content: apiResponse.post.content,
              rawContent: apiResponse.post.rawContent
            };
          }
        }
      } catch (apiError) {
        console.warn(`[BlogPage] API failed for ${post.id}, falling back to markdown:`, apiError);
      }
      
      // Fallback to markdown system
      if (!postContent) {
        postContent = await loadBlogPost(post.filename);
      }
      
      if (postContent) {
        setSelectedPost(postContent);
        console.log(`[BlogPage] Successfully loaded: ${postContent.metadata.title}`);
      } else {
        console.error(`[BlogPage] Failed to load post: ${post.id}`);
      }
    } catch (error) {
      console.error('[BlogPage] Error loading post content:', error);
    } finally {
      setLoadingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/blog-posts?id=${postId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove from posts list
        setPosts(prev => prev.filter(post => post.id !== postId));
        setShowDeleteModal(null);
        console.log('Blog post deleted successfully');
      } else {
        console.error('Failed to delete blog post:', result.error);
        alert('Failed to delete blog post: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting blog post:', error);
      alert('Error deleting blog post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRegeneratePost = async (postId: string) => {
    setIsRegenerating(true);
    try {
      const response = await fetch('/api/blog-regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogId: postId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update the post in the list
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? {
                ...post,
                title: result.post.metadata.title,
                description: result.post.metadata.description,
                readingTime: result.post.metadata.readingTime,
                tags: result.post.metadata.tags
              }
            : post
        ));
        setShowRegenerateModal(null);
        console.log('Blog post regenerated successfully');
      } else {
        console.error('Failed to regenerate blog post:', result.error);
        alert('Failed to regenerate blog post: ' + result.error);
      }
    } catch (error) {
      console.error('Error regenerating blog post:', error);
      alert('Error regenerating blog post. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-gray-700">Loading blog posts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-gray">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-orange-400 hover:text-orange-300 transition-colors"
              title="Back to Scout AI"
            >
              ← Scout AI
            </button>
            <h1 className="text-2xl font-bold text-orange-400">CodeCraft Blog</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/docs')}
              className="text-sm text-gray-300 hover:text-orange-400 transition-colors px-3 py-1 rounded-md hover:bg-gray-800 flex items-center space-x-1"
              title="Getting Started Guide"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Getting Started</span>
            </button>
            <div className="text-sm text-gray-300">
              Technical Documentation & Development Insights
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {loadingPost ? (
          /* Loading Post Content */
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mb-4"></div>
              <p className="text-gray-600">Loading blog post...</p>
            </div>
          </div>
        ) : !selectedPost ? (
          /* Blog Post List */
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Scout AI Development Blog
              </h2>
              <p className="text-gray-600 text-lg mb-4">
                Follow our journey building AI-powered photo management tools with comprehensive technical documentation.
              </p>
              {generatingImages && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-orange-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
                    <span className="text-sm">Generating hero images with AI...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group relative"
                >
                  {/* Hero Image Preview */}
                  {post.heroImage && (
                    <div className="h-48 bg-gray-100 relative overflow-hidden">
                      <img
                        src={post.heroImage}
                        alt={`Hero image for ${post.title}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => loadPostContent(post)}
                      >
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                          {post.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                          <span>By {post.author}</span>
                          <span>•</span>
                          <span>{formatDisplayDate(post.date)}</span>
                          <span>•</span>
                          <span>{post.readingTime} min read</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">
                          {post.description}
                        </p>
                      </div>
                      
                      {/* Action Menu */}
                      <div className="ml-4 flex items-center space-x-2">
                        <div 
                          className="text-orange-400 group-hover:text-orange-600 transition-colors cursor-pointer"
                          onClick={() => loadPostContent(post)}
                        >
                          →
                        </div>
                        <div className="relative" ref={openActionMenu === post.id ? actionMenuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenu(openActionMenu === post.id ? null : post.id);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                            title="More actions"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {openActionMenu === post.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu(null);
                                  setShowRegenerateModal(post.id);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Regenerate Article</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu(null);
                                  setShowDeleteModal(post.id);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete Article</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Selected Post View with BlogArticle Component */
          <BlogArticle 
            post={selectedPost} 
            onBack={() => setSelectedPost(null)} 
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Blog Post</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this blog post? This action cannot be undone.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => showDeleteModal && handleDeletePost(showDeleteModal)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regenerate Blog Post</h3>
            <p className="text-gray-600 mb-6">
              This will regenerate the blog post using the original git data and replace the current content. 
              The title, description, and content may change.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowRegenerateModal(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isRegenerating}
              >
                Cancel
              </button>
              <button
                onClick={() => showRegenerateModal && handleRegeneratePost(showRegenerateModal)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors disabled:opacity-50"
                disabled={isRegenerating}
              >
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPage;