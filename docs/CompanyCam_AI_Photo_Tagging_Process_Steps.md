
# 🪜 CompanyCam AI Tagging Process — Step-by-Step Integration Guide

This guide outlines how to implement the hybrid AI tagging pipeline into the existing "CompanyCam AI Photo Inspirations" app using the current architecture (React + TypeScript frontend, Node.js serverless backend on Vercel).

---

## 🔧 Existing App Overview (Recap)

- **Frontend:** React + TypeScript + Vite
- **Backend:** Vercel serverless function (`suggest-ai-tags.js`)
- **AI Services:** Google Cloud Vision API for initial image label extraction
- **CompanyCam API:** Used to fetch/add tags
- **Current AI Process:** Vision-only label extraction, no context or memory

---

## ✅ Goal

Enhance the AI pipeline to include:
1. Google Vision for raw labels
2. OpenAI GPT-4o for context-aware refinement
3. Vector memory (global + per-user) to personalize AI output

---

## 🪜 Step-by-Step Process

### 🔁 Step 1: Upgrade `suggest-ai-tags.js` → TypeScript with Modular Flow

- Rename to `suggest-ai-tags.ts`
- Accept input:
  - `photoUrl`
  - `userId`
- Refactor into steps:
  1. Get Google Vision labels
  2. Generate embedding from the label set
  3. Query global + user-specific vector memory
  4. Assemble system + dynamic prompt
  5. Call GPT-4o for final tags/description
  6. Return structured result to frontend

---

### 🧠 Step 2: Add Vector Memory Layer

- Use **Supabase Vector** or **Pinecone**
- Store:
  - `userId`, `labels`, `description`, `imageUrl`, `embedding`, `createdAt`
- On every AI-tagged photo:
  - Generate and store embedding from: `"labels + description"`
- Create a utility module for querying the vector DB:
  ```ts
  async function getUserScopedMemory(input: string, userId: string): Promise<MemoryChunk[]> {}
  ```

---

### 🧠 Step 3: Assemble GPT Prompt with Memory

- Include:
  - Google Vision output
  - Matching memory records
  - System-level CompanyCam context
- Inject into LLM like:
  ```ts
  const prompt = `
  You are an AI assistant for CompanyCam...
  Vision Labels: ${labels.join(", ")}
  Memory Examples:
  - ${example1}
  - ${example2}
  ...
  `;
  ```

---

### 🧑‍💻 Step 4: Update Frontend to Send `userId`

- In `PhotoModal.tsx`, when requesting suggestions:
  - Include `userId` in POST to `/api/suggest-ai-tags`
- Temporary: use a placeholder value from `.env` until user auth is set up:
  ```ts
  const userId = import.meta.env.VITE_APP_DEFAULT_USER_ID;
  ```

---

### 🧼 Step 5: Add Error Handling + Fallbacks

- Wrap:
  - Google Vision call
  - Vector DB query
  - GPT-4o call
- If vector query fails, fallback to vision + basic prompt
- Log to console or local dev file (`/logs/`) in development mode

---

### 🔁 Step 6: Log Results + Store New Memory

- After a successful tag generation:
  - Store the result back into memory vector DB
  - Use a `POST /api/store-memory.ts` route to append memory
  - Embed `"labels + description"` and persist

---

### 📦 Step 7: Deploy and Monitor

- Deploy updated backend functions to Vercel
- Add feature flag or banner for `"AI tagging is now personalized!"`
- Track:
  - Suggestion generation rate
  - Error rates
  - Tag click-through rate (optional)

---

## 🚀 Output Example

```json
{
  "tags": ["roof framing", "underlayment", "valley flashing"],
  "description": "Roof prep stage with visible underlayment and tools in view.",
  "checklist": ["Check ridge vent alignment"]
}
```

---

Let me know if you’d like follow-up steps for UI enhancements or to add a feedback system on suggested tags.
