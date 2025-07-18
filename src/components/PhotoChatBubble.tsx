// © 2025 Mark Hustad — MIT License
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader, Search, Camera } from 'lucide-react';
import type { Photo } from '../types';
import { InlineFeedback } from './ScoutAiFeedback';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  photos?: Photo[];
  timestamp: Date;
}

interface ChatBubbleProps {
  onPhotosFound?: (photos: Photo[]) => void;
  projectId?: string;
}

export const PhotoChatBubble: React.FC<ChatBubbleProps> = ({ onPhotosFound, projectId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I can help you find photos. Try asking things like "show cracked foundation shots from March" or "find roofing photos from last week".',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: inputValue,
          conversationId,
          projectId,
          limit: 20,
        }),
      });

      if (!response.ok) throw new Error('Failed to search');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let foundPhotos: Photo[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Update conversation ID
              if (data.conversationId) {
                setConversationId(data.conversationId);
              }

              // Handle different response types
              switch (data.type) {
                case 'thinking':
                case 'extracting':
                case 'searching':
                  // Show status updates
                  setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage && lastMessage.type === 'system') {
                      return [...prev.slice(0, -1), {
                        ...lastMessage,
                        content: data.content,
                      }];
                    }
                    return [...prev, {
                      id: Date.now().toString(),
                      type: 'system',
                      content: data.content,
                      timestamp: new Date(),
                    }];
                  });
                  break;

                case 'photos':
                  foundPhotos = data.content;
                  if (onPhotosFound) {
                    onPhotosFound(foundPhotos);
                  }
                  break;

                case 'summary':
                  // Replace system message with final summary
                  setMessages(prev => {
                    const filtered = prev.filter(m => m.type !== 'system');
                    return [...filtered, {
                      id: Date.now().toString(),
                      type: 'assistant',
                      content: data.content,
                      photos: foundPhotos,
                      timestamp: new Date(),
                    }];
                  });
                  break;

                case 'error':
                  setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'assistant',
                    content: `Sorry, I encountered an error: ${data.content}`,
                    timestamp: new Date(),
                  }]);
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while searching. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Bubble */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          isOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
        }`}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200"
          aria-label="Open photo search chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{
          width: '380px',
          height: '600px',
          maxHeight: 'calc(100vh - 100px)',
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5" />
            <div>
              <h3 className="font-semibold">Photo Search Assistant</h3>
              <p className="text-xs opacity-90">Ask me to find photos</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-white/20 rounded-lg p-1 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 140px)' }}>
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-orange-500 text-white'
                    : message.type === 'system'
                    ? 'bg-gray-100 text-gray-600 italic'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                
                {/* Show photo count if photos were found */}
                {message.photos && message.photos.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-xs opacity-80">
                      Found {message.photos.length} photo{message.photos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
                
                {/* Add feedback for assistant messages */}
                {message.type === 'assistant' && message.id !== '1' && (
                  <InlineFeedback 
                    messageId={message.id}
                    className="mt-2 pt-2 border-t border-gray-200"
                  />
                )}
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 rounded-2xl px-4 py-3">
                <Loader className="w-4 h-4 animate-spin text-gray-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about photos..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-orange-500 text-white rounded-full p-2 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};