// © 2025 Mark Hustad — MIT License

import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/MarkdownRenderer';

const GettingStartedPage: React.FC = () => {
  const navigate = useNavigate();

  const gettingStartedContent = `# Getting Started with Automated Documentation 🚀

*Your guide to using Scout AI's intelligent documentation system*

---

## Welcome, Developer! 👋

You're about to use a powerful system that **automatically creates technical blog posts** from your code changes. Instead of manually writing documentation, this system watches your development work and uses AI to generate comprehensive blog posts about what you built.

Think of it as having a technical writer that documents everything you do!

---

## What This System Does

The automated documentation system:
1. **Tracks your development work** from start to finish
2. **Analyzes your actual git commits** and code changes
3. **Uses AI to write comprehensive blog posts** about what you built
4. **Publishes them automatically** to the Scout AI blog

### Key Benefits
- ✨ **No manual blog writing** - AI does the heavy lifting
- 🧠 **Analyzes real code changes** - not just commit messages
- 📝 **Maintains consistent style** across all documentation
- 🎯 **Focuses on technical depth** and architectural decisions
- ⚡ **Saves hours** of documentation time

---

## Step-by-Step Walkthrough

### Step 1: Start a Documentation Session

When you're about to work on a new feature, tell the system to start watching:

\`\`\`bash
npm run docs:start "Mobile Navigation Improvements"
\`\`\`

**What happens:**
- The system records your current git branch and commit
- It starts a "documentation session" to track your work
- You'll see output like this:

\`\`\`
🚀 Starting blog documentation session...
✅ Started documentation session: "Mobile Navigation Improvements"
📝 Session Details:
  Feature: Mobile Navigation Improvements
  Branch: feat/mobile-nav
  Start Commit: abc123de
\`\`\`

**Pro tip:** Add description and tags for better AI output:

\`\`\`bash
npm run docs:start "Mobile Navigation" --description "Responsive nav improvements" --tags "UI,Mobile,React"
\`\`\`

### Step 2: Work Normally

Now just code like you always do! The system only looks at your git commits.

\`\`\`bash
# Make your changes
git add .
git commit -m "feat: add responsive mobile menu"

# Keep working
git add .
git commit -m "test: add navigation component tests"

# More changes
git add .
git commit -m "style: improve mobile menu animations"
\`\`\`

The system isn't watching your keystrokes - it analyzes your git history when you complete the session.

### Step 3: Check Your Progress (Optional)

Want to see what the system has tracked so far?

\`\`\`bash
npm run docs:status
\`\`\`

**You'll see:**
\`\`\`
✅ Active Session Found
📝 Session Details:
  Feature: Mobile Navigation Improvements
  Started: 10 minutes ago
  Current Commit: xyz789ab (different from start = you made changes!)
✨ Ready to generate blog post when you complete the session
\`\`\`

### Step 4: Preview Your Blog

First, generate a preview to review the content:

\`\`\`bash
npm run docs:preview
\`\`\`

**What happens behind the scenes:**

#### 🔍 Git Analysis
The system analyzes ALL your commits:
- Which files you changed (components, tests, utilities)
- How many lines you added/removed
- Code snippets from your changes
- Architectural patterns and decisions

#### 🤖 AI Blog Generation
It sends this analysis to OpenAI GPT-4 with prompts like:
> "Write a comprehensive technical blog post about this Mobile Navigation feature. Here are the actual code changes, commit history, and file modifications..."

#### 📝 Draft Creation
The AI creates a draft with:
- Technical overview and motivation
- Code examples from your actual changes
- Architecture decisions and trade-offs
- Performance considerations
- Lessons learned and best practices

### Step 5: Edit (Optional)

Review and edit your draft:

\`\`\`bash
# Edit the generated markdown
code .blog-drafts/[session-id].md
\`\`\`

You can refine:
- Title and excerpt
- Technical explanations
- Code examples
- Tags and metadata

### Step 6: Publish

When satisfied, publish the final post:

\`\`\`bash
npm run docs:publish
\`\`\`

This completes the session and publishes to your blog!

---

## CLI Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| \`npm run docs:start\` | Start documentation session | \`npm run docs:start "Feature Name"\` |
| \`npm run docs:preview\` | Generate draft for review | \`npm run docs:preview\` |
| \`npm run docs:publish\` | Publish reviewed blog post | \`npm run docs:publish\` |
| \`npm run docs:status\` | Check current session status | \`npm run docs:status\` |
| \`npm run docs:cancel\` | Cancel active session | \`npm run docs:cancel\` |
| \`npm run docs:cleanup\` | Clean up stale sessions | \`npm run docs:cleanup\` |

### Advanced Usage

\`\`\`bash
# Start with description and tags
npm run docs:start "Feature Name" --description "What this does" --tags "React,Testing,API"

# Check what changes will be analyzed
npm run docs:status

# Generate the blog post
npm run docs:complete
\`\`\`

---

## What Makes This Smart

### 🧠 Intelligent Analysis

The system understands your code:
- **React Components**: Detects new components vs modifications
- **Test Coverage**: Recognizes TDD patterns and test additions  
- **API Changes**: Identifies backend vs frontend changes
- **File Categories**: Distinguishes utils, components, tests, configs
- **Code Snippets**: Extracts meaningful examples (not random lines)

### 📖 Quality Writing

The AI generates professional content:
- **Consistent Voice**: Follows "CodeCraft" technical writing style
- **Technical Depth**: Explains both the "what" and "why" 
- **Real Examples**: Uses actual code from your commits
- **Smart Tags**: Generates relevant tags automatically
- **Reading Time**: Calculates accurate reading estimates

### 🎯 Context Aware

The system knows your project:
- **Scout AI Context**: Understands this is construction photo management
- **Existing Patterns**: Recognizes codebase conventions
- **Voice Consistency**: Maintains style across all blog posts
- **Technical Focus**: Emphasizes architecture and performance

---

## When to Use It

### ✅ Perfect For:
- New features or components
- Significant refactoring work
- Performance improvements
- Architecture changes
- Complex bug fixes with multiple commits
- Test-driven development implementations

### ❌ Skip For:
- Single-line typo fixes
- Dependency updates only
- Minor styling tweaks
- Simple configuration changes

---

## Pro Tips & Best Practices

### 🎯 Writing Good Commits
The AI uses commit messages for context:
\`\`\`bash
# Good - descriptive and specific
git commit -m "feat: implement responsive mobile navigation with hamburger menu"

# Better - includes the why
git commit -m "feat: add mobile nav component to improve UX on small screens"
\`\`\`

### 📦 Making Logical Commits
Each commit should be a meaningful unit:
\`\`\`bash
# Separate concerns
git commit -m "feat: add mobile navigation component"
git commit -m "test: add comprehensive nav component tests"  
git commit -m "style: implement responsive breakpoints for mobile nav"
\`\`\`

### 🏷️ Using Tags and Descriptions
Help the AI understand your work:
\`\`\`bash
# Include relevant technologies and concepts
npm run docs:start "Image Optimization" --tags "Performance,React,WebP,Lazy Loading"
\`\`\`

### ⏰ Session Management
- **Start sessions** only for features worth documenting
- **Check status** periodically to see progress
- **Complete sessions** when feature is fully done
- **Cancel sessions** if you decide not to document

---

## Troubleshooting

### "No active documentation session found"
**Problem**: Trying to complete or check status without starting a session.
**Solution**: Run \`npm run docs:start "Feature Name"\` first.

### "Active session already exists"
**Problem**: Trying to start a new session when one is already active.
**Solution**: Complete the current session with \`npm run docs:complete\` or cancel it with \`npm run docs:cancel\`.

### "No commits found since session start"
**Problem**: No git commits made since starting the session.
**Solution**: Make some commits, then try \`npm run docs:complete\` again.

### AI Generation Fails
**Problem**: Blog generation encounters an error.
**Solution**: 
1. Check that \`OPENAI_API_KEY\` environment variable is set
2. Verify you have made meaningful code changes
3. Try again - temporary API issues sometimes occur

---

## Examples in Action

### Real Session Output

\`\`\`
🏁 Completing blog documentation session...

🔄 Analyzing git changes...
📊 Change Analysis Summary:
  Commits: 3
  Files Changed: 8
  New Files: 2
  Lines Added: 245
  Lines Removed: 12
  Primary Languages: typescript, css
  Categories: component, test, style

📝 Code Snippets Extracted: 3
  1. New MobileNav component implementation
  2. Navigation component tests  
  3. Mobile-responsive CSS utilities

🤖 Generating blog post with AI...
✨ Blog Post Generated Successfully!
  Title: "Building Responsive Mobile Navigation with React and CSS Grid"
  Author: Your Name
  Reading Time: 6 min
  Tags: React, Mobile, CSS, Navigation, Responsive Design
\`\`\`

---

## Next Steps

Ready to start documenting your development work automatically? 

1. **[View the Blog →](/blog)** - See examples of generated posts
2. **Start Your First Session** - Try \`npm run docs:start "My Feature"\`
3. **Need Help?** - Check this guide or ask the team

Happy coding and documenting! 🎉

---

*Built with ❤️ by the Scout AI team | Making documentation effortless*`;

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
            <h1 className="text-2xl font-bold text-orange-400">Getting Started</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/blog')}
              className="text-sm text-gray-300 hover:text-orange-400 transition-colors px-3 py-1 rounded-md hover:bg-gray-800 flex items-center space-x-1"
              title="View blog posts"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <span>View Blog</span>
            </button>
            <div className="text-sm text-gray-300">
              Automated Documentation Guide
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Table of Contents */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📚 Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <a href="#welcome-developer" className="text-orange-600 hover:text-orange-800 transition-colors">👋 Welcome, Developer!</a>
              <a href="#what-this-system-does" className="text-orange-600 hover:text-orange-800 transition-colors">🔧 What This System Does</a>
              <a href="#step-by-step-walkthrough" className="text-orange-600 hover:text-orange-800 transition-colors">📋 Step-by-Step Walkthrough</a>
              <a href="#cli-commands-reference" className="text-orange-600 hover:text-orange-800 transition-colors">⌨️ CLI Commands Reference</a>
              <a href="#what-makes-this-smart" className="text-orange-600 hover:text-orange-800 transition-colors">🧠 What Makes This Smart</a>
              <a href="#when-to-use-it" className="text-orange-600 hover:text-orange-800 transition-colors">🎯 When to Use It</a>
              <a href="#pro-tips--best-practices" className="text-orange-600 hover:text-orange-800 transition-colors">💡 Pro Tips & Best Practices</a>
              <a href="#troubleshooting" className="text-orange-600 hover:text-orange-800 transition-colors">🔧 Troubleshooting</a>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6">
            <MarkdownRenderer content={gettingStartedContent} />
          </div>
        </div>

        {/* Quick Action Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <span className="text-orange-500 mr-2">🚀</span>
              Quick Start
            </h3>
            <p className="text-gray-600 mb-4">Ready to document your first feature?</p>
            <div className="bg-gray-50 rounded-md p-3 font-mono text-sm">
              npm run docs:start "My Feature"
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <span className="text-blue-500 mr-2">📖</span>
              View Examples
            </h3>
            <p className="text-gray-600 mb-4">See what generated blog posts look like.</p>
            <button
              onClick={() => navigate('/blog')}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium"
            >
              Browse Blog Posts →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GettingStartedPage;