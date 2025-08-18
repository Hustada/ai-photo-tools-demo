#!/usr/bin/env tsx

import 'dotenv/config';

// Manually publish the Scout AI Context-Aware Assistant blog post
const blogPost = {
  metadata: {
    id: 'scout-ai-context-aware-assistant',
    title: 'Building a Self-Improving AI Assistant: Scout AI Implementation',
    author: 'hustada',
    date: new Date().toISOString(),
    description: 'A comprehensive implementation of Scout AI - a context-aware, self-improving AI assistant that learns from user feedback and evolves its responses over time.',
    filename: 'scout-ai-context-aware-assistant.md',
    readingTime: 8,
    tags: ['AI', 'Machine Learning', 'React', 'TypeScript', 'API Development', 'Self-Improving Systems'],
  },
  content: `# Building a Self-Improving AI Assistant: Scout AI Implementation

## Overview

In this feature implementation, we built Scout AI - an intelligent, context-aware assistant that not only adapts to different user types but also learns and improves from every interaction. This represents a significant advancement in creating AI systems that evolve based on real user feedback.

## Key Features Implemented

### 1. Context-Aware AI Detection

Scout AI automatically detects whether the user is a developer or a contractor/construction professional and adapts its responses accordingly:

\`\`\`typescript
// Adaptive context detection in ScoutAiContext.tsx
const detectUserType = useCallback(() => {
  const signals = {
    isDevelopment: window.location.hostname === 'localhost',
    hasDevTools: !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__,
    pathIndicators: window.location.pathname.includes('/test') || 
                    window.location.pathname.includes('/dev'),
  };
  
  // Analyze recent queries for context clues
  const devKeywords = ['api', 'endpoint', 'component', 'debug', 'implementation'];
  const contractorKeywords = ['foundation', 'roofing', 'inspection', 'jobsite', 'crew'];
  
  // Calculate confidence and determine user type
  const confidence = calculateConfidence(signals, recentQueries);
  return { userType, confidence };
}, [recentQueries]);
\`\`\`

### 2. Unified Scout AI API Endpoint

We created a single, type-safe API endpoint that handles all Scout AI interactions:

\`\`\`typescript
// /api/scout-ai.ts
interface ScoutAiRequest {
  action: 'chat' | 'analyze' | 'feedback' | 'learn';
  context: ScoutAiContext;
  payload: any;
}

// Type guards for payload validation
function isChatPayload(payload: any): payload is ChatPayload {
  return typeof payload?.query === 'string';
}

// Route to appropriate handler with validation
switch (action) {
  case 'chat':
    if (!isChatPayload(payload)) {
      return res.status(400).json({ error: 'Invalid chat payload' });
    }
    return await processChat(context, payload, res);
  // ... other cases
}
\`\`\`

### 3. Comprehensive Feedback Collection System

We implemented UI components that seamlessly collect user feedback:

\`\`\`typescript
// Feedback collection in PhotoModal when users accept AI suggestions
const handleAddAiTag = async (suggestedTagValue: string) => {
  await onAddAiTag(photo.id, suggestedTagValue, photo);
  
  // Submit positive feedback when user accepts an AI suggested tag
  submitPositiveFeedback(
    \`tag-\${photo.id}-\${suggestedTagValue}\`,
    'tag',
    { photoId: photo.id, tagValue: suggestedTagValue }
  );
};
\`\`\`

### 4. Data Storage Layer with Vercel KV

We designed a robust schema for storing evolving prompts and feedback:

\`\`\`typescript
export interface EvolvingPrompt {
  id: string;                    // Format: prompt:{userType}:{userId?}
  basePrompt: string;            // Original safe prompt (immutable)
  currentPrompt: string;         // Active evolved prompt
  version: number;               // Increments on each evolution
  performance: PromptPerformance;
  evolution: EvolutionMetadata;
  history: PromptHistory[];
}

export interface FeedbackAggregation {
  promptId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startTime: string;
  endTime: string;
  metrics: FeedbackMetrics;
}
\`\`\`

### 5. Intelligent Feedback Aggregation

The system analyzes user edits to identify patterns:

\`\`\`typescript
function analyzeEdit(original: string, edited: string): string[] {
  const patterns: string[] = [];
  
  // Length analysis
  if (edited.length < original.length * 0.7) {
    patterns.push('shortened response');
  }
  
  // Technical jargon detection
  const removedTechnical = technicalTerms.filter(term => 
    originalWords.includes(term) && !editedWords.includes(term)
  );
  if (removedTechnical.length > 0) {
    patterns.push('removed technical jargon');
  }
  
  return patterns;
}
\`\`\`

### 6. Self-Evolution Engine

The crown jewel - an AI system that improves itself:

\`\`\`typescript
export class PromptEvolutionEngine {
  async generateMutation(
    currentPrompt: string,
    performance: PerformanceSummary,
    boundaries: string[]
  ): Promise<string> {
    const metaPrompt = \`You are an expert AI Prompt Engineer...
    
    CURRENT PROMPT: \${currentPrompt}
    
    PERFORMANCE DATA:
    - Success Rate: \${(performance.successRate * 100).toFixed(1)}%
    - Edit Rate: \${(performance.editRate * 100).toFixed(1)}%
    
    TOP USER EDIT PATTERNS:
    \${performance.topPatterns.map(p => \`- "\${p.pattern}"\`).join('\\n')}
    
    Propose a new version that addresses these issues...\`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: metaPrompt }],
    });
    
    return response.choices[0]?.message?.content;
  }
}
\`\`\`

### 7. Automated Cron Jobs

We set up periodic jobs to aggregate feedback and evolve prompts:

\`\`\`json
{
  "crons": [
    {
      "path": "/api/cron/aggregate-feedback",
      "schedule": "0 * * * *"  // Hourly aggregation
    },
    {
      "path": "/api/cron/evolve-prompts",
      "schedule": "0 0 * * 0"  // Weekly evolution
    }
  ]
}
\`\`\`

## Architecture Highlights

### The Learning Loop

\`\`\`
User Interaction → Feedback Collection → Aggregation → Analysis 
       ↑                                                    ↓
       ←── Improved Scout AI ←── Review ←── Evolution ←────
\`\`\`

### Safety Mechanisms

1. **Immutable Boundaries**: Core safety instructions that cannot be removed
2. **Validation Checks**: Every evolved prompt is validated for safety
3. **Human Review**: All prompt changes require manual approval
4. **Rollback Capability**: Can revert to previous versions if needed

## Technical Implementation Details

### Context Detection Signals

- Development environment indicators
- Browser DevTools presence
- URL path patterns
- Query keyword analysis
- User interaction patterns

### Feedback Types Collected

- **Positive**: Thumbs up on responses
- **Negative**: Thumbs down on responses
- **Edit**: User modifications to AI suggestions
- **Implicit**: Tag acceptance, description saves

### Performance Metrics

- **Success Rate**: Positive feedback / Total feedback
- **Edit Rate**: Edits / Total interactions
- **Pattern Frequency**: Common edit patterns identified
- **Response Time**: Average processing time

## Results and Impact

1. **Adaptive Responses**: Scout AI provides technical details to developers and practical guidance to contractors
2. **Continuous Improvement**: Every interaction makes the system smarter
3. **User-Specific Learning**: Personalized improvements based on individual preferences
4. **Scalable Architecture**: Built on Vercel's edge infrastructure

## Code Statistics

- **Files Changed**: 16 (8 new files)
- **Lines Added**: 2,175
- **Components Created**: 5 major components
- **API Endpoints**: 4 new endpoints
- **Type Definitions**: 15+ interfaces

## Next Steps

While the current implementation provides a solid foundation, future enhancements could include:

1. Multi-modal learning (from image interactions)
2. Team-based preference profiles
3. A/B testing for prompt variations
4. Advanced NLP for deeper pattern analysis

## Conclusion

Scout AI represents a significant step forward in creating AI assistants that truly learn and adapt. By combining context awareness, continuous feedback collection, and automated evolution, we've built a system that gets better with every interaction. This implementation demonstrates that AI systems don't have to be static - they can grow and improve alongside their users.`,
  rawContent: '', // Will be same as content
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  gitCommitHash: '8d7803c4',
  branchName: 'feat/chat-over-project',
};

// Set rawContent to match content
blogPost.rawContent = blogPost.content;

async function publishBlog() {
  try {
    console.log('📝 Publishing Scout AI blog post...');
    
    // Try different endpoints based on server setup
    const endpoints = [
      'http://localhost:5173/api/blog-posts',  // Through Vite proxy
      'http://localhost:3000/api/blog-posts',  // Direct to Vercel
      'http://localhost:3001/api/blog-posts',  // Alternative Vercel port
    ];
    
    let success = false;
    let lastError = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blogPost),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Blog post published successfully!');
          console.log(`   Blog ID: ${blogPost.metadata.id}`);
          console.log(`   View at: ${endpoint.replace('/api/blog-posts', '')}/blog/${blogPost.metadata.id}`);
          success = true;
          break;
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (error) {
        lastError = error.message;
        console.log(`   Failed: ${error.message}`);
      }
    }
    
    if (!success) {
      console.error('❌ Failed to publish blog post to any endpoint');
      console.error(`   Last error: ${lastError}`);
      console.log('\n💡 Make sure the Vercel dev server is running:');
      console.log('   npm run vercel:dev');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

publishBlog();