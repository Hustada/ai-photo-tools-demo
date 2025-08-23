"use strict";
// © 2025 Mark Hustad — MIT License
// AI-powered blog post generation with multiple provider support
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBlogPost = void 0;
require("dotenv/config");
const index_js_1 = require("./ai-providers/index.js");
// Get AI provider configuration from environment
const getAIProvider = () => {
    const providerType = (process.env.AI_PROVIDER || 'openai');
    let apiKey;
    let model;
    switch (providerType) {
        case 'gemini':
            apiKey = process.env.GEMINI_API_KEY;
            model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            console.log('[BlogGenerator] GEMINI_API_KEY from env:', apiKey?.substring(0, 20) + '...');
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
    return index_js_1.aiProviderFactory.create(providerType, { apiKey, model });
};
// Initialize AI provider
let aiProvider;
try {
    aiProvider = getAIProvider();
    console.log(`[BlogGenerator] Using AI provider: ${aiProvider.name}`);
}
catch (error) {
    console.error('[BlogGenerator] Failed to initialize AI provider:', error);
}
// Main blog generation function
const generateBlogPost = async (session, analysis, options = {}) => {
    console.log(`[BlogGenerator] Generating blog post for: ${session.featureName}`);
    const defaultOptions = {
        // Team documentation defaults
        documentType: 'feature-doc',
        audience: 'team-internal',
        technicalDepth: 'detailed',
        // Traditional options (for backward compatibility)
        style: 'technical',
        tone: 'professional',
        // Content inclusions
        includeCodeExamples: true,
        includeDiagrams: false,
        includeTestingDetails: true,
        includePerformanceMetrics: false,
        // Length and depth
        targetLength: 'medium',
        // Apply user overrides
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
    }
    catch (error) {
        console.error('[BlogGenerator] Error generating blog post:', error);
        throw new Error(`Failed to generate blog post: ${error.message}`);
    }
};
exports.generateBlogPost = generateBlogPost;
// Generate blog content using AI provider
const generateBlogContent = async (session, analysis, options) => {
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
    }
    catch (error) {
        console.error(`[BlogGenerator] ${aiProvider.name} API error:`, error);
        throw error;
    }
};
// Build the prompt for OpenAI
const buildPrompt = (session, analysis, options) => {
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
const getSystemPrompt = (options) => {
    let basePrompt = `You are a senior software engineer creating professional technical documentation for your development team. This documentation will be used for knowledge sharing, onboarding new team members, and maintaining institutional knowledge about the codebase.

DOCUMENTATION PURPOSE:
- Provide clear, structured information about implementation decisions
- Enable knowledge transfer between team members
- Document technical rationale for future reference
- Create consistent, professional documentation across the team
- Support onboarding and cross-team collaboration

Based on the git analysis and code changes provided, document what the team implemented. Study the commits, code changes, and technical details to understand:
- What problems were solved and why they needed solving
- What technologies and architectural patterns were used
- What design decisions were made and the reasoning behind them
- What trade-offs were considered and why specific approaches were chosen

Write from a team perspective with the authority of:
- Deep understanding of the technical requirements and constraints
- Knowledge of the codebase architecture and patterns
- Awareness of team coding standards and best practices
- Understanding of the product and business context

CRITICAL REQUIREMENTS:
- Use clear, professional language suitable for technical teams
- Focus on technical decisions and their rationale
- Use the EXACT code snippets provided - these are actual implementations
- Explain the WHY behind technical decisions with concrete reasoning
- Document the process: what approaches were considered and why the final solution was chosen
- Include actionable insights that help future development

DOCUMENTATION STYLE:
- Professional, clear, and well-structured
- Team-oriented language ("we implemented", "the team decided")
- Technical depth with accessible explanations
- Objective reporting of implementation details
- Focus on knowledge transfer and decision documentation
- Scannable format with clear sections and bullet points

STANDARD STRUCTURE:
1. Problem Statement - What needed to be solved and why
2. Technical Approach - High-level solution overview
3. Implementation Details - Key code changes and architecture
4. Design Decisions - Why specific approaches were chosen
5. Trade-offs and Alternatives - What else was considered
6. Testing and Validation - How the solution was verified
7. Lessons Learned - Key insights for future development
8. Next Steps - Follow-up work or improvements needed

DERIVE CONTENT FROM THE DATA:
- Use commit messages to understand the development process
- Extract design decisions from code changes and file structures
- Identify architectural patterns from the implementation
- Document the technical rationale based on the actual changes made

Write in a clear, professional tone that serves as authoritative team documentation. Focus on technical substance and decision-making rather than personal experience.

DO NOT include any structural markers like "Title:", "Byline:", or numbered sections. Write the documentation content directly.`;
    // Customize based on options
    if (options.tone === 'conversational') {
        basePrompt += `\n\n**Tone Adjustment**: Use a more conversational, friendly tone while maintaining technical accuracy.`;
    }
    else if (options.tone === 'educational') {
        basePrompt += `\n\n**Tone Adjustment**: Focus on teaching concepts and providing learning opportunities.`;
    }
    if (options.style === 'tutorial') {
        basePrompt += `\n\n**Style Adjustment**: Structure as a step-by-step tutorial with actionable instructions.`;
    }
    else if (options.style === 'deep-dive') {
        basePrompt += `\n\n**Style Adjustment**: Provide extensive technical depth and comprehensive analysis.`;
    }
    // Document type customizations
    if (options.documentType === 'architecture-doc') {
        basePrompt += `\n\n**Document Type**: Focus on architectural decisions, system design patterns, and high-level component interactions. Include diagrams and design rationale.`;
    }
    else if (options.documentType === 'process-doc') {
        basePrompt += `\n\n**Document Type**: Document team processes, workflows, and procedures. Focus on step-by-step processes and team collaboration patterns.`;
    }
    else if (options.documentType === 'technical-spec') {
        basePrompt += `\n\n**Document Type**: Create detailed technical specifications with precise requirements, API contracts, and implementation guidelines.`;
    }
    else if (options.documentType === 'implementation-guide') {
        basePrompt += `\n\n**Document Type**: Provide step-by-step implementation guidance with code examples, setup instructions, and troubleshooting tips.`;
    }
    // Audience customizations
    if (options.audience === 'cross-team') {
        basePrompt += `\n\n**Audience**: Write for developers from other teams. Provide more context about domain-specific concepts and avoid team-internal jargon.`;
    }
    else if (options.audience === 'stakeholders') {
        basePrompt += `\n\n**Audience**: Include business context and impact. Balance technical detail with higher-level explanations suitable for non-technical stakeholders.`;
    }
    else if (options.audience === 'new-hires') {
        basePrompt += `\n\n**Audience**: Provide extra context about codebase patterns, team conventions, and foundational concepts. Include links to related documentation.`;
    }
    // Technical depth customizations
    if (options.technicalDepth === 'high-level') {
        basePrompt += `\n\n**Technical Depth**: Focus on concepts and decisions rather than detailed implementation. Suitable for overview and planning purposes.`;
    }
    else if (options.technicalDepth === 'comprehensive') {
        basePrompt += `\n\n**Technical Depth**: Include exhaustive technical detail, edge cases, performance considerations, and complete implementation context.`;
    }
    return basePrompt;
};
// Get max tokens based on target length and provider
const getMaxTokens = (targetLength) => {
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
const extractMetadata = (content, session, analysis) => {
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
const generateTags = (session, analysis) => {
    const tags = new Set();
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
        if (lang === 'typescript')
            tags.add('TypeScript');
        if (lang === 'javascript')
            tags.add('JavaScript');
        if (lang === 'css')
            tags.add('CSS');
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
const calculateReadingTime = (content) => {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
};
// Generate summary for the blog post
const generateSummary = (session, analysis) => {
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
