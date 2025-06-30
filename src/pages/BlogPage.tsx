// © 2025 Mark Hustad — MIT License

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface BlogPost {
  id: string;
  title: string;
  filename: string;
  date: string;
  content?: string;
}

const BlogPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock blog posts data - in a real app this would come from an API
  const blogPosts: BlogPost[] = [
    {
      id: '001',
      title: 'Introducing CodeCraft: Your Technical Documentation Agent',
      filename: '001-introducing-codecraft.md',
      date: 'December 30, 2024'
    },
    {
      id: '002', 
      title: 'Building High-Performance Image Loading with Test-Driven Development',
      filename: '002-image-loading-optimization.md',
      date: 'December 30, 2024'
    }
  ];

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setPosts(blogPosts);
      setLoading(false);
    }, 500);
  }, []);

  const loadPostContent = async (post: BlogPost) => {
    try {
      // In a real app, you'd fetch from an API or import dynamically
      // For now, we'll show a placeholder since we can't directly import markdown
      const placeholderContent = `
# ${post.title}

*Published: ${post.date} by CodeCraft*

This blog post contains detailed technical documentation about Scout AI development.

**Note:** This is a preview. The full blog post is available in the \`docs/code-blog/${post.filename}\` file.

## Quick Access

To read the full blog post with proper formatting:

1. Navigate to \`docs/code-blog/${post.filename}\` in your file system
2. Open the file in a markdown viewer or your preferred editor
3. The post includes code examples, technical details, and implementation insights

## Blog Features

- **Technical Depth**: Real code examples from our implementation
- **TDD Methodology**: Test-driven development approach
- **Performance Analysis**: Detailed metrics and improvements
- **Lessons Learned**: Practical insights from development

The blog posts follow our established template and provide comprehensive documentation of Scout AI's development journey.
      `;

      setSelectedPost({
        ...post,
        content: placeholderContent
      });
    } catch (error) {
      console.error('Error loading post:', error);
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
        {!selectedPost ? (
          /* Blog Post List */
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Scout AI Development Blog
              </h2>
              <p className="text-gray-600 text-lg">
                Follow our journey building AI-powered photo management tools with comprehensive technical documentation.
              </p>
            </div>

            <div className="space-y-6">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => loadPostContent(post)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-orange-600 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-3">
                        Published on {post.date} by CodeCraft
                      </p>
                      <p className="text-gray-700">
                        {post.id === '001' 
                          ? 'Introduction to our technical documentation system and the CodeCraft agent responsible for creating comprehensive development blogs.'
                          : 'Deep dive into implementing lazy image loading with Test-Driven Development, featuring performance optimizations and visual loading states.'
                        }
                      </p>
                    </div>
                    <div className="ml-4 text-orange-400">
                      →
                    </div>
                  </div>
                  <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
                    <span>📄 {post.filename}</span>
                    <span>🏷️ Technical Documentation</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Selected Post View */
          <div>
            <button
              onClick={() => setSelectedPost(null)}
              className="mb-6 text-orange-600 hover:text-orange-700 transition-colors flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back to blog posts</span>
            </button>

            <article className="bg-white rounded-lg shadow-md border border-gray-200 p-8">
              <div className="prose prose-lg max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                  {selectedPost.content}
                </pre>
              </div>
            </article>

            <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-800 mb-3">
                💡 Want to read the full formatted version?
              </h3>
              <p className="text-orange-700 mb-4">
                For the complete blog post with proper markdown formatting, syntax highlighting, and enhanced readability:
              </p>
              <div className="bg-white rounded border border-orange-200 p-4 font-mono text-sm text-gray-700">
                docs/code-blog/{selectedPost.filename}
              </div>
              <p className="text-orange-600 text-sm mt-3">
                Open this file in your preferred markdown viewer or code editor for the best reading experience.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;