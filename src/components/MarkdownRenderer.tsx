// © 2025 Mark Hustad — MIT License

import React, { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Highlight, themes } from 'prism-react-renderer';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [children]);

  if (inline) {
    return (
      <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';

  return (
    <div className="relative group my-6">
      <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 text-sm rounded-t-lg border border-gray-700 border-b-0">
        <span className="font-medium">{language}</span>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors text-xs px-2 py-1 rounded hover:bg-gray-700 w-[70px] h-[24px] flex items-center justify-center gap-1"
          title="Copy code"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {copied ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
          <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <Highlight
        theme={themes.oneDark}
        code={children}
        language={language as any}
      >
        {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre 
            className={`${highlightClassName} p-4 text-sm overflow-x-auto !mt-0 rounded-b-lg border border-gray-700 border-t-0`}
            style={{ ...style, margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  return (
    <div className={`markdown-content ${className}`}>
      <style>{`
        .markdown-content .anchor-link {
          margin-left: 0.5rem;
          text-decoration: none;
          color: #d1d5db;
          opacity: 0;
          transition: opacity 0.2s ease, color 0.2s ease;
          font-weight: normal;
          font-size: 0.9em;
          position: relative;
        }
        
        .markdown-content .anchor-link-symbol {
          display: inline-block;
          padding: 0 0.25rem;
        }
        
        .markdown-content h1:hover .anchor-link,
        .markdown-content h2:hover .anchor-link,
        .markdown-content h3:hover .anchor-link,
        .markdown-content h4:hover .anchor-link,
        .markdown-content h5:hover .anchor-link,
        .markdown-content h6:hover .anchor-link {
          opacity: 1;
        }
        
        .markdown-content .anchor-link:hover {
          color: #f97316;
          text-decoration: none;
        }
        
        .markdown-content .anchor-link:focus {
          opacity: 1;
          outline: 2px solid #f97316;
          outline-offset: 2px;
        }
        
        /* Ensure headings themselves don't appear as links */
        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4,
        .markdown-content h5,
        .markdown-content h6 {
          color: inherit;
          text-decoration: none !important;
          cursor: text;
          position: relative;
        }
        
        .markdown-content h1:hover,
        .markdown-content h2:hover,
        .markdown-content h3:hover,
        .markdown-content h4:hover,
        .markdown-content h5:hover,
        .markdown-content h6:hover {
          color: inherit;
          text-decoration: none !important;
        }
        
        /* If headings are wrapped in anchors, style those too */
        .markdown-content h1 a:not(.anchor-link),
        .markdown-content h2 a:not(.anchor-link),
        .markdown-content h3 a:not(.anchor-link),
        .markdown-content h4 a:not(.anchor-link),
        .markdown-content h5 a:not(.anchor-link),
        .markdown-content h6 a:not(.anchor-link) {
          color: inherit !important;
          text-decoration: none !important;
          font-weight: inherit;
        }
        
        .markdown-content h1 a:not(.anchor-link):hover,
        .markdown-content h2 a:not(.anchor-link):hover,
        .markdown-content h3 a:not(.anchor-link):hover,
        .markdown-content h4 a:not(.anchor-link):hover,
        .markdown-content h5 a:not(.anchor-link):hover,
        .markdown-content h6 a:not(.anchor-link):hover {
          color: inherit !important;
          text-decoration: none !important;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[
          rehypeSlug
        ]}
        components={{
          // Custom heading components with better styling and IDs for navigation
          h1: ({ children, ...props }) => {
            // Extract text content for ID generation
            const id = props.id || '';
            return (
              <h1 id={id} className="text-4xl font-bold text-gray-900 mb-6 mt-8 leading-tight">
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const id = props.id || '';
            return (
              <h2 id={id} className="text-3xl font-semibold text-gray-900 mb-4 mt-8 leading-tight border-b border-gray-200 pb-2">
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = props.id || '';
            return (
              <h3 id={id} className="text-2xl font-semibold text-gray-900 mb-3 mt-6 leading-tight">
                {children}
              </h3>
            );
          },
          h4: ({ children, ...props }) => {
            const id = props.id || '';
            return (
              <h4 id={id} className="text-xl font-semibold text-gray-900 mb-3 mt-6 leading-tight">
                {children}
              </h4>
            );
          },
          h5: ({ children, ...props }) => {
            const id = props.id || '';
            return (
              <h5 id={id} className="text-lg font-semibold text-gray-900 mb-2 mt-4 leading-tight">
                {children}
              </h5>
            );
          },
          h6: ({ children, ...props }) => {
            const id = props.id || '';
            return (
              <h6 id={id} className="text-base font-semibold text-gray-900 mb-2 mt-4 leading-tight">
                {children}
              </h6>
            );
          },
          
          // Paragraph styling
          p: ({ children }) => (
            <p className="text-lg leading-relaxed text-gray-700 mb-4">
              {children}
            </p>
          ),
          
          // List styling
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-2 mb-4 text-lg text-gray-700 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 text-lg text-gray-700 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-orange-600 hover:text-orange-700 underline transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          
          // Code blocks and inline code
          code: ({ children, className, inline }) => (
            <CodeBlock 
              className={className} 
              inline={inline}
            >
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          ),
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-orange-400 bg-orange-50 pl-6 pr-4 py-4 my-6 italic text-gray-700">
              {children}
            </blockquote>
          ),
          
          // Horizontal rules
          hr: () => (
            <hr className="border-0 border-t border-gray-300 my-8" />
          ),
          
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full border-collapse border border-gray-300">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-gray-200">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-4 py-2 text-gray-700">
              {children}
            </td>
          ),
          
          // Images
          img: ({ src, alt }) => (
            <div className="my-8">
              <img
                src={src}
                alt={alt}
                className="w-full h-auto rounded-lg shadow-lg"
                loading="lazy"
              />
              {alt && (
                <p className="text-center text-sm text-gray-500 mt-2 italic">
                  {alt}
                </p>
              )}
            </div>
          ),
          
          // Strong/Bold text
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),
          
          // Emphasis/Italic text
          em: ({ children }) => (
            <em className="italic text-gray-800">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;