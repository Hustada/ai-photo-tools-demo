// © 2025 Mark Hustad — MIT License
// AI-powered blog post generation with multiple provider support

import 'dotenv/config';
import type { BlogSession } from './blogSession.js';
import type { GitChangeAnalysis } from './gitAnalysis.js';
import { aiProviderFactory, type AIProvider, type AIProviderType } from './ai-providers/index.js';
// Note: BlogPost type will be imported when needed for publishing

export interface BlogGenerationOptions {
  style?: 'technical' | 'tutorial' | 'overview' | 'deep-dive';
  tone?: 'professional' | 'conversational' | 'educational';
  includeCodeExamples?: boolean;
  includeDiagrams?: boolean;
  targetLength?: 'short' | 'medium' | 'long';
}

export interface GeneratedBlog {
  metadata: {
    title: string;
    description: string;
    author: string;
    readingTime: number;
    tags: string[];
  };
  content: string;
  rawContent: string;
  summary: string;
}

// Get AI provider configuration from environment
const getAIProvider = (): AIProvider => {
  const providerType = (process.env.AI_PROVIDER || 'openai') as AIProviderType;
  
  let apiKey: string | undefined;
  let model: string | undefined;
  
  switch (providerType) {
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY;
      model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      if (!apiKey) {
        console.warn('[BlogGenerator] GEMINI_API_KEY not found in environment variables');
      }
      break;
    case 'openai':
    default:
      apiKey = process.env.OPENAI_API_KEY;
      model = process.env.OPENAI_MODEL || 'gpt-4';
      if (!apiKey) {
        console.warn('[BlogGenerator] OPENAI_API_KEY not found in environment variables');
      }
      break;
  }
  
  if (!apiKey) {
    throw new Error(`API key not found for provider: ${providerType}`);
  }
  
  return aiProviderFactory.create(providerType, { apiKey, model });
};

// Initialize AI provider
let aiProvider: AIProvider;
try {
  aiProvider = getAIProvider();
  console.log(`[BlogGenerator] Using AI provider: ${aiProvider.name}`);
} catch (error) {
  console.error('[BlogGenerator] Failed to initialize AI provider:', error);
}

// Main blog generation function
export const generateBlogPost = async (
  session: BlogSession,
  analysis: GitChangeAnalysis,
  options: BlogGenerationOptions = {}
): Promise<GeneratedBlog> => {
  console.log(`[BlogGenerator] Generating blog post for: ${session.featureName}`);
  
  const defaultOptions: Required<BlogGenerationOptions> = {
    style: 'technical',
    tone: 'professional',
    includeCodeExamples: true,
    includeDiagrams: false,
    targetLength: 'medium',
    ...options
  };
  
  try {
    // Generate blog content using AI provider
    const content = await generateBlogContent(session, analysis, defaultOptions);
    
    // Extract metadata from generated content
    const metadata = extractMetadata(content, session, analysis);
    
    // Calculate reading time
    const readingTime = calculateReadingTime(content);
    
    return {
      metadata: {
        ...metadata,
        readingTime
      },
      content,
      rawContent: content,
      summary: generateSummary(session, analysis)
    };
  } catch (error) {
    console.error('[BlogGenerator] Error generating blog post:', error);
    throw new Error(`Failed to generate blog post: ${(error as Error).message}`);
  }
};

// Generate blog content using AI provider
const generateBlogContent = async (
  session: BlogSession,
  analysis: GitChangeAnalysis,
  options: Required<BlogGenerationOptions>
): Promise<string> => {
  const userPrompt = buildPrompt(session, analysis, options);
  const systemPrompt = getSystemPrompt(options);
  
  console.log(`[BlogGenerator] Sending request to ${aiProvider.name} (${userPrompt.length} chars)`);
  
  try {
    const content = await aiProvider.generateContent({
      systemPrompt,
      userPrompt,
      maxTokens: getMaxTokens(options.targetLength),
      temperature: 0.7,
    });
    
    console.log(`[BlogGenerator] ✅ Generated ${content.length} characters of content`);
    return content;
  } catch (error) {
    console.error(`[BlogGenerator] ${aiProvider.name} API error:`, error);
    throw error;
  }
};

// Build the prompt for OpenAI
const buildPrompt = (
  session: BlogSession,
  analysis: GitChangeAnalysis,
  options: Required<BlogGenerationOptions>
): string => {
  const { featureName, description, tags } = session;
  const { summary, commits, codeSnippets } = analysis;
  
  let prompt = `# Blog Post Generation Request

## Feature Information
- **Feature Name**: ${featureName}
- **Description**: ${description || 'No description provided'}
- **Branch**: ${session.startBranch}
- **Tags**: ${tags?.join(', ') || 'General Development'}

## Change Analysis Summary
- **Commits**: ${analysis.commitCount}
- **Files Changed**: ${summary.totalFiles} (${summary.newFiles} new, ${summary.modifiedFiles} modified)
- **Lines of Code**: +${summary.totalInsertions}/-${summary.totalDeletions}
- **Primary Languages**: ${summary.primaryLanguages.join(', ')}
- **Categories**: ${summary.categories.join(', ')}
- **Test Files**: ${summary.testFiles}`;

  if (summary.architecturalChanges.length > 0) {
    prompt += `\n- **Architectural Changes**: ${summary.architecturalChanges.join(', ')}`;
  }

  // Add commit history
  if (commits.length > 0) {
    prompt += `\n\n## Commit History\n`;
    commits.forEach(commit => {
      prompt += `- **${commit.shortHash}**: ${commit.message} (+${commit.insertions}/-${commit.deletions})\n`;
    });
  }

  // Add code snippets if requested
  if (options.includeCodeExamples && codeSnippets.length > 0) {
    prompt += `\n\n## Key Code Changes (USE THESE EXACT SNIPPETS IN YOUR ARTICLE)\n`;
    prompt += `IMPORTANT: These are the actual code changes from the implementation. You MUST use these exact code snippets when showing code examples in your article. Do not create placeholder code or generic examples.\n\n`;
    codeSnippets.forEach((snippet, i) => {
      prompt += `\n### Code Snippet ${i + 1}: ${snippet.description}\n`;
      prompt += `**File**: ${snippet.file}\n`;
      prompt += `**Language**: ${snippet.language}\n`;
      if (snippet.before) {
        prompt += `**Before (original code)**:\n`;
        prompt += `\`\`\`${snippet.language}\n${snippet.before}\n\`\`\`\n`;
        prompt += `**After (your implementation)**:\n`;
      }
      prompt += `\`\`\`${snippet.language}\n${snippet.after}\n\`\`\`\n`;
      prompt += `Use this code when explaining the ${snippet.description.toLowerCase()}.\n`;
    });
  }

  // Add specific instructions based on analysis
  prompt += `\n\n## Additional Context\n`;
  
  if (summary.hasNewComponents) {
    prompt += `- This feature introduces new React components\n`;
  }
  
  if (summary.hasNewTests) {
    prompt += `- Test-driven development approach with new test coverage\n`;
  }
  
  if (summary.hasAPIChanges) {
    prompt += `- Includes API endpoint changes or additions\n`;
  }
  
  if (summary.hasUIChanges) {
    prompt += `- User interface and styling updates\n`;
  }

  prompt += `\n\nGenerate a comprehensive technical blog post that tells the complete story of this implementation.

FINAL REMINDERS:
- Use the EXACT code snippets provided above - do not create generic examples
- Write as the expert who built this feature
- Focus on the real implementation details and challenges
- Explain the reasoning behind every technical decision
- Make it engaging and educational for fellow developers`;
  
  return prompt;
};

// Get system prompt based on options
const getSystemPrompt = (options: Required<BlogGenerationOptions>): string => {
  const basePrompt = `You are an expert software engineer writing an engaging, narrative-driven technical article for a professional coding blog (like Medium, Dev.to, or Hashnode). You have deep expertise in the technologies used and a talent for storytelling.

NARRATIVE APPROACH:
- Start with a compelling, personal anecdote that illustrates the problem
- Use specific details (day of week, time, sensory details) to make it relatable
- Build tension and urgency around the technical challenge
- Show the emotional journey alongside the technical solution
- Include moments of frustration, breakthrough, and satisfaction

Based on the git analysis and code changes provided, you are THE expert who implemented this feature. Study the commits, code changes, and technical details to understand:
- What technologies were used
- What problems were solved
- What architectural patterns were employed
- What performance considerations were addressed

Write with the authority of someone who:
- Has personally debugged these exact issues at 2 AM
- Knows the frustration of silent failures and elusive bugs
- Has celebrated the victories when the solution finally works
- Can explain complex concepts through relatable metaphors
- Has battle-tested these solutions in production

CRITICAL INSTRUCTIONS:
- Open with a vivid scene that sets up the technical problem
- Use metaphors and analogies to explain complex concepts
- Include personal insights and "aha!" moments
- Write as if YOU personally implemented every line of code
- Use the EXACT code snippets provided - these are YOUR implementations
- Explain the WHY behind every technical decision through story
- Show the iterative process - what didn't work and why
- Share insights that only come from hands-on experience

ARTICLE STYLE:
- Narrative-driven with technical depth
- Personal and relatable while maintaining expertise
- Use phrases like "It was a Tuesday afternoon when..." or "After hours of debugging..."
- Include emotional context: frustration, curiosity, satisfaction
- Code examples are framed as discoveries in your journey
- Technical explanations flow naturally from the narrative
- Build to a satisfying resolution with clear takeaways

STRUCTURE FLOW:
1. Hook with a relatable problem scenario
2. Build tension around the technical challenge
3. Walk through discovery and failed attempts
4. Present the solution as a breakthrough moment
5. Demonstrate implementation with real code
6. Reflect on lessons learned with wisdom gained

DERIVE YOUR NARRATIVE FROM THE DATA:
- Use commit timestamps to create a timeline
- Transform error messages into debugging war stories
- Convert architectural decisions into thoughtful deliberations
- Turn test results into validation moments

Write naturally and conversationally, as if telling a colleague about your experience over coffee. Let the code and commits inspire your story.

DO NOT include any structural markers like "Title:", "Byline:", or numbered sections. Write pure article content that flows naturally.`;

  // Customize based on options
  if (options.tone === 'conversational') {
    basePrompt += `\n\n**Tone Adjustment**: Use a more conversational, friendly tone while maintaining technical accuracy.`;
  } else if (options.tone === 'educational') {
    basePrompt += `\n\n**Tone Adjustment**: Focus on teaching concepts and providing learning opportunities.`;
  }

  if (options.style === 'tutorial') {
    basePrompt += `\n\n**Style Adjustment**: Structure as a step-by-step tutorial with actionable instructions.`;
  } else if (options.style === 'deep-dive') {
    basePrompt += `\n\n**Style Adjustment**: Provide extensive technical depth and comprehensive analysis.`;
  }

  return basePrompt;
};

// Get max tokens based on target length and provider
const getMaxTokens = (targetLength: 'short' | 'medium' | 'long'): number => {
  // Gemini supports much larger outputs than GPT-4
  const isGemini = aiProvider?.name === 'gemini';
  
  switch (targetLength) {
    case 'short': 
      return isGemini ? 2000 : 1500;
    case 'long': 
      return isGemini ? 8192 : 4000;
    case 'medium':
    default: 
      return isGemini ? 4096 : 2500;
  }
};

// Extract metadata from generated content
const extractMetadata = (content: string, session: BlogSession, analysis: GitChangeAnalysis) => {
  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : session.featureName;
  
  // Extract description (first paragraph after title)
  const lines = content.split('\n');
  let description = '';
  let foundTitle = false;
  
  for (const line of lines) {
    if (line.startsWith('# ') && !foundTitle) {
      foundTitle = true;
      continue;
    }
    
    if (foundTitle && line.trim() && !line.startsWith('*') && !line.startsWith('#')) {
      description = line.trim();
      break;
    }
  }
  
  // Fallback description
  if (!description) {
    description = `Technical implementation of ${session.featureName} with comprehensive analysis and insights.`;
  }
  
  // Limit description length
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }
  
  // Determine author based on git commits
  const authors = [...new Set(analysis.commits.map(c => c.author))];
  const author = authors.length === 1 ? authors[0] : 'CodeCraft';
  
  // Generate tags from analysis and session
  const generatedTags = generateTags(session, analysis);
  
  return {
    title,
    description,
    author,
    tags: generatedTags
  };
};

// Generate relevant tags from analysis
const generateTags = (session: BlogSession, analysis: GitChangeAnalysis): string[] => {
  const tags = new Set<string>();
  
  // Add session tags if available
  if (session.tags) {
    session.tags.forEach(tag => tags.add(tag));
  }
  
  // Add tags based on analysis
  if (analysis.summary.hasNewComponents) {
    tags.add('React Components');
  }
  
  if (analysis.summary.hasNewTests) {
    tags.add('Testing');
  }
  
  if (analysis.summary.hasAPIChanges) {
    tags.add('API Development');
  }
  
  if (analysis.summary.hasUIChanges) {
    tags.add('UI/UX');
  }
  
  // Add language tags
  analysis.summary.primaryLanguages.forEach(lang => {
    if (lang === 'typescript') tags.add('TypeScript');
    if (lang === 'javascript') tags.add('JavaScript');
    if (lang === 'css') tags.add('CSS');
  });
  
  // Add category-based tags
  if (analysis.summary.categories.includes('util')) {
    tags.add('Utilities');
  }
  
  if (analysis.summary.architecturalChanges.includes('Performance optimization')) {
    tags.add('Performance');
  }
  
  if (analysis.summary.architecturalChanges.includes('Test-driven development')) {
    tags.add('TDD');
  }
  
  // Default tags
  tags.add('Development');
  tags.add('Technical Documentation');
  
  return Array.from(tags).slice(0, 6); // Limit to 6 tags
};

// Calculate reading time (average 200 words per minute)
const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};

// Generate summary for the blog post
const generateSummary = (session: BlogSession, analysis: GitChangeAnalysis): string => {
  const { featureName } = session;
  const { summary } = analysis;
  
  let summaryText = `Implementation of ${featureName} featuring `;
  
  const features = [];
  
  if (summary.hasNewComponents) {
    features.push('new React components');
  }
  
  if (summary.hasAPIChanges) {
    features.push('API enhancements');
  }
  
  if (summary.hasNewTests) {
    features.push('comprehensive testing');
  }
  
  if (summary.totalInsertions > 500) {
    features.push('extensive code additions');
  }
  
  if (summary.architecturalChanges.length > 0) {
    features.push(summary.architecturalChanges[0].toLowerCase());
  }
  
  summaryText += features.slice(0, 3).join(', ');
  
  if (features.length > 3) {
    summaryText += `, and ${features.length - 3} other improvements`;
  }
  
  summaryText += `. Includes ${summary.totalInsertions} lines of new code across ${summary.totalFiles} files.`;
  
  return summaryText;
};