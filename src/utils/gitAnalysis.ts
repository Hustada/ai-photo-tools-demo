// © 2025 Mark Hustad — MIT License
// Git change analysis for blog generation

import { execSync } from 'child_process';

export interface GitChangeAnalysis {
  commitCount: number;
  commits: GitCommit[];
  fileChanges: FileChange[];
  summary: ChangeSummary;
  codeSnippets: CodeSnippet[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;
  deletions: number;
  isNew: boolean;
  extension: string;
  category: FileCategory;
}

export interface CodeSnippet {
  file: string;
  language: string;
  before?: string;
  after: string;
  description: string;
  lineStart: number;
  lineEnd: number;
}

export interface ChangeSummary {
  totalFiles: number;
  newFiles: number;
  modifiedFiles: number;
  deletedFiles: number;
  totalInsertions: number;
  totalDeletions: number;
  primaryLanguages: string[];
  categories: FileCategory[];
  architecturalChanges: string[];
  testFiles: number;
  hasNewComponents: boolean;
  hasNewTests: boolean;
  hasAPIChanges: boolean;
  hasUIChanges: boolean;
}

export type FileCategory = 
  | 'component' 
  | 'util' 
  | 'api' 
  | 'test' 
  | 'config' 
  | 'style' 
  | 'documentation' 
  | 'script'
  | 'asset'
  | 'other';

// Main analysis function
export const analyzeGitChanges = (startCommit: string, endCommit: string = 'HEAD'): GitChangeAnalysis => {
  console.log(`[GitAnalysis] Analyzing changes from ${startCommit.substring(0, 8)} to ${endCommit.substring(0, 8)}`);
  
  try {
    const commits = getCommitHistory(startCommit, endCommit);
    const fileChanges = getFileChanges(startCommit, endCommit);
    const codeSnippets = extractCodeSnippets(fileChanges, startCommit, endCommit);
    const summary = generateChangeSummary(commits, fileChanges);
    
    return {
      commitCount: commits.length,
      commits,
      fileChanges,
      summary,
      codeSnippets
    };
  } catch (error) {
    console.error('[GitAnalysis] Error analyzing git changes:', error);
    throw new Error(`Failed to analyze git changes: ${(error as Error).message}`);
  }
};

// Get commit history between two commits
const getCommitHistory = (startCommit: string, endCommit: string): GitCommit[] => {
  try {
    // Get commit info with format: hash|author|date|message
    const commitFormat = '%H|%an|%ai|%s';
    const commitOutput = execSync(
      `git log --pretty=format:"${commitFormat}" ${startCommit}..${endCommit}`,
      { encoding: 'utf8' }
    );
    
    if (!commitOutput.trim()) {
      return [];
    }
    
    const commits: GitCommit[] = [];
    const commitLines = commitOutput.trim().split('\n');
    
    for (const line of commitLines) {
      const [hash, author, date, message] = line.split('|');
      
      // Get stats for this specific commit
      const stats = getCommitStats(hash);
      
      commits.push({
        hash,
        shortHash: hash.substring(0, 8),
        author,
        date,
        message,
        filesChanged: stats.filesChanged,
        insertions: stats.insertions,
        deletions: stats.deletions
      });
    }
    
    return commits;
  } catch (error) {
    console.warn('[GitAnalysis] Error getting commit history:', error);
    return [];
  }
};

// Get stats for a specific commit
const getCommitStats = (commitHash: string): { filesChanged: number; insertions: number; deletions: number } => {
  try {
    const statsOutput = execSync(
      `git show --stat --format="" ${commitHash}`,
      { encoding: 'utf8' }
    );
    
    // Parse the summary line like: "5 files changed, 123 insertions(+), 45 deletions(-)"
    const summaryMatch = statsOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    return {
      filesChanged: summaryMatch ? parseInt(summaryMatch[1]) : 0,
      insertions: summaryMatch && summaryMatch[2] ? parseInt(summaryMatch[2]) : 0,
      deletions: summaryMatch && summaryMatch[3] ? parseInt(summaryMatch[3]) : 0
    };
  } catch (error) {
    return { filesChanged: 0, insertions: 0, deletions: 0 };
  }
};

// Get file changes between commits
const getFileChanges = (startCommit: string, endCommit: string): FileChange[] => {
  try {
    // Get detailed file stats
    const diffOutput = execSync(
      `git diff --name-status --numstat ${startCommit}..${endCommit}`,
      { encoding: 'utf8' }
    );
    
    if (!diffOutput.trim()) {
      return [];
    }
    
    const changes: FileChange[] = [];
    const lines = diffOutput.trim().split('\n');
    
    // Parse numstat output (insertions, deletions, filename)
    const numstatOutput = execSync(
      `git diff --numstat ${startCommit}..${endCommit}`,
      { encoding: 'utf8' }
    );
    
    const numstatLines = numstatOutput.trim().split('\n');
    const statsMap = new Map<string, { insertions: number; deletions: number }>();
    
    for (const line of numstatLines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const insertions = parts[0] === '-' ? 0 : parseInt(parts[0]);
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1]);
        const filename = parts[2];
        statsMap.set(filename, { insertions, deletions });
      }
    }
    
    // Parse name-status output
    const statusOutput = execSync(
      `git diff --name-status ${startCommit}..${endCommit}`,
      { encoding: 'utf8' }
    );
    
    const statusLines = statusOutput.trim().split('\n');
    
    for (const line of statusLines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const status = parts[0];
        const filename = parts[1];
        const stats = statsMap.get(filename) || { insertions: 0, deletions: 0 };
        
        // Check if file existed before
        const isNew = checkIfFileIsNew(filename, startCommit);
        
        changes.push({
          path: filename,
          status: mapGitStatus(status),
          insertions: stats.insertions,
          deletions: stats.deletions,
          isNew,
          extension: getFileExtension(filename),
          category: categorizeFile(filename)
        });
      }
    }
    
    return changes;
  } catch (error) {
    console.warn('[GitAnalysis] Error getting file changes:', error);
    return [];
  }
};

// Check if a file is new (didn't exist at start commit)
const checkIfFileIsNew = (filename: string, startCommit: string): boolean => {
  try {
    execSync(`git show ${startCommit}:${filename}`, { stdio: 'ignore' });
    return false; // File existed
  } catch {
    return true; // File didn't exist
  }
};

// Map git status codes to our enum
const mapGitStatus = (status: string): FileChange['status'] => {
  switch (status[0]) {
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'M': 
    default: return 'modified';
  }
};

// Get file extension
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

// Categorize files based on path and extension
const categorizeFile = (filename: string): FileCategory => {
  const path = filename.toLowerCase();
  const ext = getFileExtension(filename);
  
  // Test files
  if (path.includes('test') || path.includes('spec') || ext === 'test.ts' || ext === 'test.tsx') {
    return 'test';
  }
  
  // Components
  if (path.includes('component') || (ext === 'tsx' && !path.includes('page'))) {
    return 'component';
  }
  
  // API files
  if (path.includes('api/') || path.includes('/api') || path.includes('endpoint')) {
    return 'api';
  }
  
  // Utilities
  if (path.includes('util') || path.includes('helper') || path.includes('lib/')) {
    return 'util';
  }
  
  // Styles
  if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) {
    return 'style';
  }
  
  // Scripts
  if (path.includes('script') || ['sh', 'bash', 'zsh'].includes(ext)) {
    return 'script';
  }
  
  // Documentation
  if (['md', 'txt', 'rst', 'doc'].includes(ext) || path.includes('readme')) {
    return 'documentation';
  }
  
  // Config files
  if (['json', 'yml', 'yaml', 'toml', 'ini', 'env'].includes(ext) || 
      path.includes('config') || filename.startsWith('.')) {
    return 'config';
  }
  
  // Assets
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext)) {
    return 'asset';
  }
  
  return 'other';
};

// Extract meaningful code snippets from changes
const extractCodeSnippets = (fileChanges: FileChange[], startCommit: string, endCommit: string): CodeSnippet[] => {
  const snippets: CodeSnippet[] = [];
  
  // Focus on key files for snippets
  const importantFiles = fileChanges.filter(change => 
    ['component', 'util', 'api'].includes(change.category) &&
    change.status !== 'deleted' &&
    ['ts', 'tsx', 'js', 'jsx'].includes(change.extension) &&
    change.insertions > 5 // Significant changes
  ).slice(0, 5); // Limit to top 5 files
  
  for (const file of importantFiles) {
    try {
      const diff = execSync(
        `git diff ${startCommit}..${endCommit} -- "${file.path}"`,
        { encoding: 'utf8' }
      );
      
      const snippet = parseDiffForSnippet(diff, file);
      if (snippet) {
        snippets.push(snippet);
      }
    } catch (error) {
      console.warn(`[GitAnalysis] Could not extract snippet from ${file.path}:`, error);
    }
  }
  
  return snippets;
};

// Parse git diff to extract meaningful code snippet
const parseDiffForSnippet = (diff: string, file: FileChange): CodeSnippet | null => {
  const lines = diff.split('\n');
  let addedLines: string[] = [];
  let currentLineNum = 0;
  let snippetStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentLineNum = parseInt(match[1]);
        snippetStart = currentLineNum;
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.substring(1));
    } else if (line.startsWith(' ')) {
      addedLines.push(line.substring(1));
    }
  }
  
  if (addedLines.length === 0) {
    return null;
  }
  
  // Get a meaningful snippet (first 10-20 lines of additions)
  const snippet = addedLines.slice(0, 20).join('\n');
  
  return {
    file: file.path,
    language: getLanguageFromExtension(file.extension),
    after: snippet,
    description: generateSnippetDescription(file),
    lineStart: snippetStart,
    lineEnd: snippetStart + addedLines.length
  };
};

// Get language identifier from file extension
const getLanguageFromExtension = (ext: string): string => {
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript', 
    'jsx': 'javascript',
    'css': 'css',
    'scss': 'scss',
    'html': 'html',
    'json': 'json',
    'md': 'markdown'
  };
  
  return langMap[ext] || ext;
};

// Generate description for code snippet
const generateSnippetDescription = (file: FileChange): string => {
  const baseName = file.path.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || '';
  
  switch (file.category) {
    case 'component':
      return `New ${baseName} component implementation`;
    case 'util':
      return `Utility functions in ${baseName}`;
    case 'api':
      return `API endpoint: ${baseName}`;
    case 'test':
      return `Test coverage for ${baseName}`;
    default:
      return `Implementation in ${baseName}`;
  }
};

// Generate comprehensive summary
const generateChangeSummary = (commits: GitCommit[], fileChanges: FileChange[]): ChangeSummary => {
  const categories = [...new Set(fileChanges.map(f => f.category))];
  const extensions = fileChanges.map(f => f.extension).filter(Boolean);
  const languages = [...new Set(extensions.map(getLanguageFromExtension))];
  
  const totalInsertions = fileChanges.reduce((sum, f) => sum + f.insertions, 0);
  const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);
  
  const newFiles = fileChanges.filter(f => f.isNew).length;
  const modifiedFiles = fileChanges.filter(f => !f.isNew && f.status === 'modified').length;
  const deletedFiles = fileChanges.filter(f => f.status === 'deleted').length;
  const testFiles = fileChanges.filter(f => f.category === 'test').length;
  
  const hasNewComponents = fileChanges.some(f => f.category === 'component' && f.isNew);
  const hasNewTests = fileChanges.some(f => f.category === 'test' && f.isNew);
  const hasAPIChanges = fileChanges.some(f => f.category === 'api');
  const hasUIChanges = fileChanges.some(f => ['component', 'style'].includes(f.category));
  
  const architecturalChanges = detectArchitecturalChanges(fileChanges, commits);
  
  return {
    totalFiles: fileChanges.length,
    newFiles,
    modifiedFiles,
    deletedFiles,
    totalInsertions,
    totalDeletions,
    primaryLanguages: languages.slice(0, 3),
    categories,
    architecturalChanges,
    testFiles,
    hasNewComponents,
    hasNewTests,
    hasAPIChanges,
    hasUIChanges
  };
};

// Detect architectural changes from patterns
const detectArchitecturalChanges = (fileChanges: FileChange[], commits: GitCommit[]): string[] => {
  const changes: string[] = [];
  
  // Analyze commit messages for patterns
  const commitMessages = commits.map(c => c.message.toLowerCase()).join(' ');
  
  if (commitMessages.includes('refactor')) {
    changes.push('Code refactoring');
  }
  
  if (commitMessages.includes('performance') || commitMessages.includes('optimize')) {
    changes.push('Performance optimization');
  }
  
  if (commitMessages.includes('test') || commitMessages.includes('tdd')) {
    changes.push('Test-driven development');
  }
  
  if (fileChanges.some(f => f.path.includes('api/'))) {
    changes.push('API development');
  }
  
  if (fileChanges.some(f => f.category === 'component' && f.isNew)) {
    changes.push('New component architecture');
  }
  
  if (fileChanges.some(f => f.path.includes('util') && f.isNew)) {
    changes.push('New utility functions');
  }
  
  return changes;
};