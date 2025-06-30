// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadBlogPost, getAllBlogPosts, BlogPostContent, BlogPostMetadata } from '../utils/markdownLoader';
import { generateBlogHeroImage } from '../utils/imageGeneration';
import BlogArticle from '../components/BlogArticle';

const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPostMetadata[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPostContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);

  useEffect(() => {
    const loadBlogPosts = async () => {
      try {
        console.log('[BlogPage] Loading blog posts...');
        const blogPosts = await getAllBlogPosts();
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
      console.log(`[BlogPage] Loading post content: ${post.filename}`);
      
      const postContent = await loadBlogPost(post.filename);
      if (postContent) {
        setSelectedPost(postContent);
        console.log(`[BlogPage] Successfully loaded: ${postContent.metadata.title}`);
      } else {
        console.error(`[BlogPage] Failed to load post: ${post.filename}`);
      }
    } catch (error) {
      console.error('[BlogPage] Error loading post content:', error);
    } finally {
      setLoadingPost(false);
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
          <div className="text-sm text-gray-300">
            Technical Documentation & Development Insights
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
                  className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => loadPostContent(post)}
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
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                          {post.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                          <span>By {post.author}</span>
                          <span>•</span>
                          <span>{post.date}</span>
                          <span>•</span>
                          <span>{post.readingTime} min read</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">
                          {post.description}
                        </p>
                      </div>
                      <div className="ml-4 text-orange-400 group-hover:text-orange-600 transition-colors">
                        →
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
    </div>
  );
};

export default BlogPage;