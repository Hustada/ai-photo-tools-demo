# Repomix Usage Guide for Scout AI

## Overview

Repomix is installed and configured for Scout AI to package the entire codebase into a single AI-friendly file. This enables comprehensive code analysis, documentation generation, and architectural reviews with AI tools.

## Installation

Repomix has been installed globally:
```bash
npm install -g repomix
```

## Configuration

The project includes a `repomix.config.json` file that:
- Outputs to `scout-ai-codebase.xml` (or `.md` by changing style)
- Includes only relevant source files (TypeScript, configs, documentation)
- Excludes build artifacts, coverage files, node_modules, and other non-essential files
- Enables security checks to prevent exposing sensitive data

## Usage

### Generate AI-Ready Codebase File
```bash
# In the project root
repomix
```

This creates `scout-ai-codebase.xml` containing:
- 133 source files
- ~310K tokens (optimized for AI context windows)
- 1.3MB total size

### Alternative Output Formats
```bash
# Generate markdown format
repomix --style markdown -o scout-ai-codebase.md

# Output to clipboard
repomix --copy

# Output to console
repomix --stdout
```

## Use Cases for Scout AI

### 1. Architecture Review
Share the codebase file with Claude or ChatGPT to:
- Review the full-width layout implementation
- Analyze component structure and dependencies
- Identify optimization opportunities

### 2. Documentation Generation
Use AI to generate:
- Comprehensive API documentation
- Component usage guides
- Architecture decision records (ADRs)

### 3. Code Quality Analysis
Get insights on:
- Code patterns and anti-patterns
- Performance bottlenecks
- Security considerations

### 4. Test Generation
Generate comprehensive tests for:
- Photo analysis features
- Scout AI context management
- Duplicate detection algorithms

### 5. Refactoring Assistance
Plan large-scale refactors with full context:
- Component extraction
- State management improvements
- Type safety enhancements

## Best Practices

1. **Update Before Major Changes**: Run Repomix before starting major features to capture the current state

2. **Security First**: Always review the output for sensitive data before sharing

3. **Token Optimization**: The current config is optimized to ~310K tokens, well within Claude's context window

4. **Version Control**: Add `scout-ai-codebase.xml` and `.md` to `.gitignore` to avoid committing large files

## Configuration Details

Current configuration (`repomix.config.json`):
- **Included**: All TypeScript files, configs, and documentation
- **Excluded**: Coverage files, build artifacts, images, environment files
- **Security**: Enabled via Secretlint integration

## Quick Commands

```bash
# Standard generation
repomix

# Copy to clipboard for immediate AI usage
repomix --copy

# Generate compressed version (fewer tokens)
repomix --compress

# Check what files will be included
repomix --dry-run
```

## Integration with AI Tools

1. **Claude**: Upload the XML file directly or paste from clipboard
2. **ChatGPT**: Use the markdown format for better readability
3. **GitHub Copilot Chat**: Reference the file for context-aware suggestions

## Maintenance

- Review and update `repomix.config.json` as the project structure evolves
- Periodically check the token count to ensure it remains within AI limits
- Update exclusion patterns when adding new file types or directories