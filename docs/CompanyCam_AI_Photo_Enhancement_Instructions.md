
# ✳️ CompanyCam AI Photo Inspirations — Phase 2 AI Enhancement Instructions

## Objective

Extend the current AI tagging system to include a **contextual hybrid filtering model** that improves the relevance and accuracy of AI-suggested tags and descriptions. This should combine:

1. **Google Cloud Vision API** for raw label and web entity extraction  
2. **OpenAI GPT‑4o (or similar LLM)** for context-aware transformation  
3. **Vector-based memory** (global and user-specific) to personalize AI behavior  

---

## ✳️ Tasks and Implementation Details

### 1. Modify `suggest-ai-tags.js` → `suggest-ai-tags.ts`

**Convert it to TypeScript** and refactor the logic into modular steps:

#### Inputs
- `photoUrl: string` (required)
- `userId: string` (required – passed from frontend or inferred via session)

#### New flow:
1. Call Google Cloud Vision API to extract:
   - `labelAnnotations`
   - `webDetection`
   - `textAnnotations` (if needed)
2. Embed the label set and description text via OpenAI `text-embedding-3-small` or similar model
3. Query vector DB for memory:
   - **Global memory namespace** (shared)
   - **User-specific memory namespace** (via `userId`)
   - Retrieve 3–6 closest matches based on label content
4. Assemble a GPT-4o prompt containing:
   - Raw Google labels
   - Matched memory examples
   - System prompt (see below)
5. Call OpenAI `/chat/completions` with the full prompt
6. Return:
   - Suggested tags (3–5)
   - Checklist triggers (if applicable)
   - Description (1 sentence, CompanyCam-style)
7. Log response for future memory expansion (optional)

---

### 2. Add Vector Memory Layer

#### Choose backend:
- **Option 1:** Supabase Vector (recommended for easy integration)
- **Option 2:** Pinecone (if performance scaling becomes a concern)

#### Schema (per record):
```ts
{
  id: string; // UUID
  userId: string; // scope key
  labels: string[];
  description: string;
  imageUrl: string;
  createdAt: timestamp;
  embedding: number[]; // stored vector
  namespace: "global" | "user:<userId>";
}
```

#### Embedding logic:
- Combine labels + description + optional OCR into a single string
- Use `text-embedding-3-small` or local alternative
- Store embeddings on successful AI tag generation (or on photo save)

---

### 3. System Prompt for LLM (Hardcoded into backend)

```txt
You are an intelligent assistant for CompanyCam, a photo-first job site documentation platform used by contractors.

You are tagging and describing job site photos using:
- Google Vision labels
- Past examples
- This user's tagging preferences

Goals:
1. Suggest up to 5 relevant tags a contractor would use
2. Suggest any checklist triggers (optional)
3. Generate a 1-sentence description of the image

Tone: Clear, direct, construction-specific. Avoid vague or corporate-sounding language.

Output JSON only.
```

---

### 4. Frontend Changes (Minimal for now)

#### Pass `userId` to the `/api/suggest-ai-tags` call
- Can be temporary placeholder if real auth isn't implemented
- Store as `VITE_APP_DEFAULT_USER_ID` in `.env` for now

#### Optional: Show a banner like:
> “AI suggestions are now personalized to your past tagging behavior.”

---

### 5. Error Handling & Logging

- Wrap GPT + Vision + Vector steps in try/catch
- If vector memory fails, fall back to Vision + default GPT
- Log all outputs and failures in Supabase or a simple `./logs/` dev file for now

---

## ✳️ Optional (Phase 3 or Stretch Goal)

- Build `/api/store-memory.ts` route that lets the system add new memory chunks after tagging success
- Add a toggle to let users vote “Helpful” or “Wrong” on AI suggestions (for future tuning)

---

## ✳️ Keys, Auth, and Env

| Key | Location | Notes |
|-----|----------|-------|
| `VITE_APP_COMPANYCAM_API_KEY` | Frontend `.env` | Used for GET/POST photo/tag requests |
| `GOOGLE_CLOUD_VISION_API_KEY` | Vercel + Backend `.env` | Used in suggest-ai-tags.ts |
| `OPENAI_API_KEY` | Vercel + Backend `.env` | Used in GPT and embedding steps |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Backend `.env` | Required for vector insert/query (read/write) |

---

## ✅ Done =

- `suggest-ai-tags.ts` modularized with LLM + memory steps
- Vector memory system in place with basic schema
- Prompt assembly pulls user-scoped and global examples
- Outputs: `tags[]`, `description`, optional `checklist[]`
- Frontend can call this function per-photo
