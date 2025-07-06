# Scout AI

An intelligent photo management application that enhances CompanyCam with AI-powered analysis, smart curation, and automated organization capabilities.

## What Scout AI Does

Scout AI is a working demonstration of AI-enhanced photo management for construction professionals. It connects to your CompanyCam account and adds intelligent features for analyzing, organizing, and managing photo collections.

### Core Capabilities

**AI-Powered Photo Analysis**
- **Smart Tagging**: Analyzes photos using Google Vision API and generates construction-specific tags
- **Descriptive Text**: Creates detailed photo descriptions using OpenAI GPT-4o
- **Context Awareness**: Incorporates project information and construction industry knowledge
- **User Review**: All AI suggestions require user approval before being applied

**Scout AI Intelligent Curation**
- **Visual Similarity Detection**: 4-layer pipeline identifies duplicate and similar photos
- **Smart Recommendations**: Suggests which photos to keep, archive, or organize
- **Efficiency Optimization**: Reduces manual photo management work
- **Analysis Modes**: Smart (new photos), date range, all photos, or manual selection

**Automated Retention Management**
- **Time-Based Policies**: Configurable deletion schedules with grace periods
- **Notification System**: Advance warnings with restore capabilities
- **Visual Indicators**: Photo cards show deletion status and timelines
- **Background Processing**: Automated cleanup without user intervention

**CompanyCam Integration**
- **Native API Access**: Full read/write integration with CompanyCam photos and tags
- **Seamless Workflow**: Enhances existing CompanyCam interface without disruption
- **Data Separation**: AI enhancements stored separately from CompanyCam data

## Technical Implementation

### Architecture
- **Frontend**: React 19 + TypeScript with Tailwind CSS
- **Backend**: Vercel serverless functions
- **AI Services**: Google Vision API, OpenAI GPT-4o, Pinecone vector database
- **Storage**: Vercel KV for AI data, CompanyCam API for core photo data
- **Testing**: 616/616 tests passing with comprehensive coverage

### AI Pipeline
1. **Computer Vision**: Google Vision API analyzes photo content
2. **Embeddings**: OpenAI generates vector representations for similarity search
3. **Context Assembly**: Combines visual analysis with project and user context
4. **Smart Suggestions**: GPT-4o generates construction-specific tags and descriptions
5. **User Review**: Interface for accepting/rejecting AI recommendations

### Visual Similarity Detection
- **Layer 1**: File hash for exact duplicates (instant, free)
- **Layer 1.5**: Perceptual hash for near-duplicates (85% threshold)
- **Layer 2**: TensorFlow.js visual features (99.9% threshold)
- **Layer 3**: Metadata-based filtering
- **Layer 4**: AI-powered content analysis

## Setup & Installation

### Prerequisites
- Node.js (LTS version)
- CompanyCam API key
- Vercel account with KV storage

### Environment Variables
Create `.env.local` with:
```env
# Vercel KV Store
KV_URL=your_vercel_kv_store_url
KV_REST_API_URL=your_vercel_kv_store_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_store_api_token
KV_REST_API_READ_ONLY_TOKEN=your_vercel_kv_store_read_only_token

# AI Services (optional for full functionality)
OPENAI_API_KEY=your_openai_api_key
GOOGLE_VISION_API_KEY=your_google_vision_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
```

### Installation
```bash
git clone <repository-url>
cd scout-ai
npm install
npm run dev
```

Open http://localhost:3000 and enter your CompanyCam API key to begin.

## How to Use

### Getting AI Suggestions
1. Log in with your CompanyCam API key
2. Browse your photo gallery
3. Click "Get AI Suggestions" on any photo
4. Review and accept/reject suggested tags and descriptions
5. AI enhancements are saved and displayed with visual distinction

### Scout AI Curation
1. Click "Trigger Analysis" to analyze your photos
2. Choose analysis mode (smart, date range, all photos)
3. Review similarity groups and curation recommendations
4. Accept suggestions to automatically organize photos
5. Monitor progress and undo actions if needed

### Retention Management
1. Configure retention policies in settings
2. Set deletion timeframes and notification preferences
3. Monitor photo lifecycle with visual status indicators
4. Respond to deletion notifications or let automation handle cleanup

## Project Status

Scout AI is a functional proof-of-concept demonstrating AI integration possibilities for CompanyCam. It includes:

**Fully Working Features:**
- CompanyCam API integration
- AI tag and description generation
- Visual similarity detection and curation
- Automated retention policies
- User authentication and data persistence

**Demonstration Scope:**
- Designed for testing and evaluation
- Production deployment would require scaling considerations
- AI processing costs scale with usage
- Sample images included for testing

## CodeCraft Documentation System

Scout AI includes **CodeCraft**, an intelligent automated documentation system that transforms your development work into comprehensive technical documentation.

### How CodeCraft Works

CodeCraft tracks your git commits and code changes, then uses AI to generate professional technical documentation automatically. Instead of manually writing documentation, CodeCraft watches your development session and creates detailed blog posts about what you built.

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run docs:start "Feature Name"` | Start documentation session |
| `npm run docs:status` | Check current session status |
| `npm run docs:complete` | Generate documentation and complete session |
| `npm run docs:cancel` | Cancel current session |
| `npm run docs:preview` | Preview generated content |
| `npm run docs:publish` | Publish documentation |
| `npm run docs:cleanup` | Clean up stale sessions |

### Basic Workflow

1. **Start Session**: `npm run docs:start "Your Feature Name"`
2. **Develop Normally**: Make commits as usual
3. **Generate Documentation**: `npm run docs:complete`

CodeCraft analyzes your actual code changes and generates professional documentation with:
- Technical overview and architecture decisions
- Real code examples from your commits
- Performance considerations and best practices
- Comprehensive change analysis and rationale

### AI-Powered Analysis

CodeCraft uses advanced AI (Gemini 2.5 Pro or OpenAI GPT-4) to:
- Analyze git diffs and commit history
- Extract meaningful code snippets
- Identify architectural patterns
- Generate technical explanations
- Create professional documentation

Perfect for maintaining comprehensive project documentation without the manual effort.

## API Endpoints

- `/api/suggest-ai-tags` - Full AI analysis pipeline
- `/api/ai-enhancements` - CRUD for AI-generated content
- `/api/photo-analysis/[photoId]` - Analysis tracking
- `/api/photo-tags-batch` - Bulk tag operations

## License

MIT License