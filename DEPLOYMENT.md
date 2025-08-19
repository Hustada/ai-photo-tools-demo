# Deployment Guide for AI Photo Tools

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with the following variables (see `.env.example` below)

3. **Run locally:**
   ```bash
   vercel dev --yes
   ```
   The app will be available at http://localhost:3000

## Required Environment Variables

Create a `.env` file with these variables:

```bash
# CompanyCam API
COMPANYCAM_API_KEY=your_companycam_api_key
VITE_APP_COMPANYCAM_API_KEY=your_companycam_api_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Vercel KV Database
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token

# Pinecone Vector Database (optional, for photo search)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_ENVIRONMENT=your_environment

# User Configuration
VITE_APP_DEFAULT_USER_ID=your_default_user_id

# Blog Configuration (optional)
GHOST_API_KEY=your_ghost_api_key
GHOST_API_URL=your_ghost_api_url
```

## Deploying to a New Vercel Project

### Option 1: Deploy from GitHub (Recommended)

1. **Create a new GitHub repository:**
   ```bash
   git remote add origin https://github.com/yourusername/ai-photo-tools.git
   git branch -M main
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Configure environment variables in Vercel dashboard
   - Deploy

### Option 2: Deploy using Vercel CLI

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Deploy to production:**
   ```bash
   vercel --prod
   ```
   
   When prompted:
   - Set up and deploy: Y
   - Which scope: Choose your account
   - Link to existing project: N
   - What's your project's name: ai-photo-tools (or your preferred name)
   - In which directory is your code located: ./
   - Want to override the settings: N

3. **Add environment variables:**
   ```bash
   # Add each environment variable
   vercel env add COMPANYCAM_API_KEY production
   vercel env add ANTHROPIC_API_KEY production
   vercel env add OPENAI_API_KEY production
   vercel env add KV_REST_API_URL production
   vercel env add KV_REST_API_TOKEN production
   # ... add all other required variables
   ```

   Or add them through the Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all required variables

4. **Redeploy with environment variables:**
   ```bash
   vercel --prod
   ```

## Setting up Vercel KV

1. Go to your Vercel dashboard
2. Navigate to the Storage tab
3. Create a new KV database
4. Copy the connection details to your environment variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

## Testing the Deployment

After deployment, test the key features:

1. **Health Check:**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

2. **Claude Analysis:**
   Test the duplicate photo analysis feature

3. **AI Enhancements:**
   Test tag suggestions and descriptions

## Troubleshooting

### Common Issues:

1. **500 Errors on API calls:**
   - Check that all environment variables are set correctly
   - Verify API keys are valid
   - Check Vercel function logs

2. **Build failures:**
   - Ensure all TypeScript files compile: `npm run build`
   - Check for missing dependencies

3. **API rate limits:**
   - Monitor usage of external APIs (Claude, OpenAI)
   - Implement caching where appropriate

## Project Structure

```
ai-photo-tools/
├── api/                 # Vercel serverless functions
├── src/                 # React frontend
├── public/             # Static assets
├── scripts/            # Utility scripts
├── .env                # Local environment variables (not committed)
├── vercel.json         # Vercel configuration
└── package.json        # Dependencies and scripts
```

## Key Features

- **Duplicate Photo Detection:** Uses Claude Vision API to analyze photos
- **AI Tag Suggestions:** Generates relevant tags for photos
- **AI Descriptions:** Creates descriptions for photos
- **Photo Enhancement Storage:** Stores AI enhancements in Vercel KV
- **Blog Generation:** Creates blog posts from photo collections

## Support

For issues or questions, please check:
- Vercel function logs in the dashboard
- Browser console for frontend errors
- Network tab for API response details