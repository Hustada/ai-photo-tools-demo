// © 2025 Mark Hustad — MIT License

import React, { useEffect, useState, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { BlogPostContent } from '../utils/markdownLoader';

interface BlogArticleProps {
  post: BlogPostContent;
  onBack: () => void;
}

interface ReadingProgress {
  percentage: number;
  timeRemaining: number;
}

const BlogArticle: React.FC<BlogArticleProps> = ({ post, onBack }) => {
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({
    percentage: 0,
    timeRemaining: post.metadata.readingTime
  });
  const [isVisible, setIsVisible] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  // Calculate reading progress
  useEffect(() => {
    const handleScroll = () => {
      if (!articleRef.current) return;

      const element = articleRef.current;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrollTop = window.scrollY;
      
      // Calculate percentage of article read
      const percentage = Math.min((scrollTop / documentHeight) * 100, 100);
      
      // Calculate estimated time remaining
      const timeRemaining = Math.max(
        Math.ceil(post.metadata.readingTime * (1 - percentage / 100)),
        0
      );

      setReadingProgress({ percentage, timeRemaining });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [post.metadata.readingTime]);

  // Fade in animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`min-h-screen bg-white transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div 
          className="h-1 bg-orange-400 transition-all duration-300 ease-out"
          style={{ width: `${readingProgress.percentage}%` }}
        />
      </div>

      {/* Header Navigation */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-200 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors group"
            >
              <svg 
                className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back to Blog</span>
            </button>
            
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              {readingProgress.timeRemaining > 0 && (
                <span>{readingProgress.timeRemaining} min read</span>
              )}
              <span className="hidden sm:inline">
                {Math.round(readingProgress.percentage)}% complete
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <article ref={articleRef} className="max-w-3xl mx-auto">
          {/* Hero Image */}
          {post.metadata.heroImage && (
            <div className="mb-12">
              <img
                src={post.metadata.heroImage}
                alt={`Hero image for ${post.metadata.title}`}
                className="w-full h-64 sm:h-80 lg:h-96 object-cover rounded-xl shadow-lg"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Article Header */}
          <header className="mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              {post.metadata.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-orange-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">CC</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{post.metadata.author}</p>
                  <p className="text-sm">{formatDate(post.metadata.date)}</p>
                </div>
              </div>
              
              <div className="hidden sm:block w-px h-8 bg-gray-300" />
              
              <div className="flex items-center space-x-1 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{post.metadata.readingTime} min read</span>
              </div>
            </div>

            {/* Tags */}
            {post.metadata.tags && post.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {post.metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-xl text-gray-600 leading-relaxed font-light italic border-l-4 border-orange-400 pl-6">
              {post.metadata.description}
            </p>
          </header>

          {/* Article Body */}
          <div className="prose prose-lg prose-gray max-w-none">
            <MarkdownRenderer 
              content={post.content}
              className="blog-article-content"
            />
          </div>

          {/* Article Footer */}
          <footer className="mt-16 pt-8 border-t border-gray-200">
            <div className="bg-orange-50 rounded-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">CC</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">About {post.metadata.author}</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Technical documentation agent for the Scout AI project. I transform complex code implementations 
                    into clear, engaging stories that capture both technical depth and the creative journey of building 
                    AI-powered tools for construction professionals.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-4">
                <span>Scout AI Development Blog</span>
                <span>•</span>
                <span>Technical Documentation</span>
              </div>
              <button
                onClick={onBack}
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                ← Back to all posts
              </button>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
};

export default BlogArticle;