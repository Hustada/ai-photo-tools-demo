# Photo Chat Feature

This feature enables natural language search over your photo collection using AI-powered semantic search.

## Overview

The chat feature allows users to search for photos using natural language queries like:
- "Show cracked foundation shots from March"
- "Find roofing photos from last week"
- "Show all plumbing issues in the main building"

## Architecture

### Components

1. **Chat API** (`/api/chat.ts`)
   - Server-sent events (SSE) for streaming responses
   - GPT-4o for query understanding and criteria extraction
   - Hybrid search combining semantic similarity and metadata filtering
   - Conversation context management via Vercel KV

2. **UI Components**
   - `PhotoChatBubble.tsx` - Floating chat interface
   - `usePhotoChat.ts` - React hook for chat functionality

3. **Vector Search**
   - Pinecone vector database for semantic search
   - OpenAI text-embedding-3-small for embeddings
   - Metadata filtering for dates, tags, creators, projects

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=companycam-photos
```

### 2. Create Pinecone Index

Create a Pinecone index with:
- Dimension: 1536 (for text-embedding-3-small)
- Metric: cosine
- Cloud: AWS
- Region: us-east-1 (or your preferred region)

### 3. Index Your Photos

Run the indexing script to populate Pinecone with your photo data:

```bash
npm run index:photos
```

Note: The current script uses mock data. You'll need to modify `scripts/index-photos.ts` to fetch from your actual database.

### 4. Test the Feature

1. Start the development server:
   ```bash
   npm run dev:full
   ```

2. Navigate to the Duplicate Analysis page
3. Click the orange chat bubble in the bottom-right corner
4. Try queries like "show foundation photos from March"

## Integration

The chat bubble is already integrated into `DuplicateAnalysisPage.tsx`. To add it to other pages:

```tsx
import { PhotoChatBubble } from '../components/PhotoChatBubble';

// In your component
<PhotoChatBubble
  onPhotosFound={(photos) => {
    // Handle found photos
    console.log('Found photos:', photos);
  }}
  projectId={currentProjectId} // Optional: filter by project
/>
```

## Customization

### Modify Search Behavior

Edit the extraction prompt in `/api/chat.ts` to customize how queries are interpreted:

```typescript
const EXTRACTION_PROMPT = `Based on the user's query, extract search criteria...`
```

### Add Custom Metadata

Extend the `PhotoMetadata` interface in `src/utils/pinecone.ts` to include additional searchable fields.

## Troubleshooting

1. **No results found**
   - Ensure photos are indexed in Pinecone
   - Check that embeddings are being generated correctly
   - Verify Pinecone API key and index name

2. **Slow responses**
   - Consider caching frequent queries
   - Optimize embedding generation batch size
   - Review Pinecone query performance

3. **Connection errors**
   - Verify all environment variables are set
   - Check Pinecone service status
   - Ensure Vercel KV is configured for conversation storage