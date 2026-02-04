# Ollama Migration Plan - Phase 3 Detailed Implementation

## Overview
Replace all OpenAI API calls with local Ollama at `10.0.0.60:11434` using `llama3.1:8b` model.

---

## 1. Create Ollama Service Utility

### File: `src/lib/ollama.ts`

**Purpose:** Centralized Ollama API client to handle embeddings and completions

```typescript
// Utility functions for Ollama API calls
interface EmbeddingResponse {
  embedding: number[];
}

interface GenerateResponse {
  response: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://10.0.0.60:11434';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'llama3.1:8b';
const CHAT_MODEL = process.env.CHAT_MODEL || 'llama3.1:8b';

export async function generateEmbedding(text: string): Promise<number[]> {
  // POST /api/embed with prompt
  // Returns embedding vector
}

export async function generateCompletion(systemPrompt: string, userMessage: string): Promise<string> {
  // POST /api/generate with system context
  // Returns completion text
}

export async function checkOllamaHealth(): Promise<boolean> {
  // GET /api/tags to verify Ollama is running
  // Returns true/false
}
```

**Key differences from OpenAI:**
- Ollama uses `/api/embed` for embeddings (different request/response format)
- Ollama uses `/api/generate` for text generation (not streaming by default)
- Response structure is different - embedding is in `response` field, not `data[0].embedding`

---

## 2. Update Upload Endpoint

### File: `src/app/api/upload/route.ts`

**Current Implementation (Lines 77-97):**
```typescript
const emb = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunk,
});

const { error } = await supabase.from('documents').insert({
  content: chunk,
  metadata: { /* ... */ },
  embedding: JSON.stringify(emb.data[0].embedding),
});
```

**New Implementation:**
```typescript
const embedding = await generateEmbedding(chunk);

const { error } = await supabase.from('documents').insert({
  content: chunk,
  metadata: { /* ... */ },
  embedding: JSON.stringify(embedding),
});
```

**Changes:**
1. Remove `import OpenAI from 'openai'`
2. Add `import { generateEmbedding } from '@/lib/ollama'`
3. Remove `const openai = new OpenAI()`
4. Replace embedding call (lines 78-82)
5. Update parsing of embedding response (line 97: `emb.data[0].embedding` → `embedding`)

---

## 3. Update Search Endpoint

### File: `src/app/api/search/route.ts`

**Current Implementation:**
```typescript
// Line 8-9: Generate embedding for query
const emb = await openai.embeddings.create({ 
  model: 'text-embedding-3-small', 
  input: query 
});

// Line 10-15: Query database with embedding
const { data: results, error } = await supabase.rpc('match_documents', {
  query_embedding: JSON.stringify(emb.data[0].embedding),
  match_threshold: 0.0,
  match_count: 5,
});

// Line 19-28: Generate completion
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant...' },
    { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` }
  ],
});
```

**New Implementation:**
```typescript
// Generate embedding for query
const queryEmbedding = await generateEmbedding(query);

// Query database with embedding
const { data: results, error } = await supabase.rpc('match_documents', {
  query_embedding: JSON.stringify(queryEmbedding),
  match_threshold: 0.0,
  match_count: 5,
});

// Generate completion using Ollama
const systemPrompt = 'You are a helpful assistant. Use the provided context to answer. If the answer is not in the context, say you do not know.';
const userMessage = `Context: ${context}\n\nQuestion: ${query}`;
const answer = await generateCompletion(systemPrompt, userMessage);
```

**Changes:**
1. Remove `import OpenAI from 'openai'`
2. Add `import { generateEmbedding, generateCompletion } from '@/lib/ollama'`
3. Remove `const openai = new OpenAI()`
4. Replace embedding call (lines 8-9)
5. Replace chat completion call (lines 19-28)
6. Update response to use `answer` directly instead of `completion.choices[0].message.content`

---

## 4. Update Environment Variables

### File: `.env.local`

**Add (Required):**
```dotenv
# Ollama Configuration (REQUIRED - application will fail without these)
OLLAMA_URL=http://10.0.0.60:11434
EMBEDDING_MODEL=nomic-embed-text
CHAT_MODEL=llama3.1:8b
```

**Important Notes:**
- Both `OLLAMA_URL` and `EMBEDDING_MODEL` are **required** environment variables
- The application will throw an error at startup if these are not set
- `CHAT_MODEL` specifies the model for text generation (set to `llama3.1:8b`)

---

## 5. Create Ollama Health Check Test Script

### File: `scripts/test-ollama.sh`

**Purpose:** Verify Ollama is running and model is available

```bash
#!/bin/bash

OLLAMA_URL="${OLLAMA_URL:-http://10.0.0.60:11434}"
MODEL="llama3.1:8b"

echo "🔍 Testing Ollama at $OLLAMA_URL"
echo ""

# 1. Check if Ollama is running
echo "1️⃣  Checking Ollama health..."
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
  echo "✅ Ollama is running"
else
  echo "❌ Ollama is not responding at $OLLAMA_URL"
  exit 1
fi

# 2. Check if model is available
echo ""
echo "2️⃣  Checking if model '$MODEL' is available..."
MODELS=$(curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"' | grep "$MODEL")
if [ -z "$MODELS" ]; then
  echo "❌ Model '$MODEL' not found"
  echo "Available models:"
  curl -s "$OLLAMA_URL/api/tags" | grep -o '"name":"[^"]*"'
  exit 1
else
  echo "✅ Model '$MODEL' is available"
fi

# 3. Test embedding generation
echo ""
echo "3️⃣  Testing embedding generation..."
EMBED_RESPONSE=$(curl -s -X POST "$OLLAMA_URL/api/embed" \
  -H "Content-Type: application/json" \
  -d '{"model":"'$MODEL'","input":"test"}')

if echo "$EMBED_RESPONSE" | grep -q "embedding"; then
  echo "✅ Embedding generation works"
  echo "   Response length: $(echo "$EMBED_RESPONSE" | jq '.embedding | length')"
else
  echo "❌ Embedding generation failed"
  echo "   Response: $EMBED_RESPONSE"
  exit 1
fi

# 4. Test text generation
echo ""
echo "4️⃣  Testing text generation..."
GEN_RESPONSE=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"model":"'$MODEL'","prompt":"What is 2+2?","stream":false}')

if echo "$GEN_RESPONSE" | grep -q "response"; then
  echo "✅ Text generation works"
  ANSWER=$(echo "$GEN_RESPONSE" | jq -r '.response' | head -c 100)
  echo "   Sample response: $ANSWER..."
else
  echo "❌ Text generation failed"
  echo "   Response: $GEN_RESPONSE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Ollama tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## 6. Create TypeScript Health Check

### File: `src/lib/ollama-health.ts`

**Purpose:** Runtime health check for application startup

```typescript
import { checkOllamaHealth } from './ollama';

export async function validateOllamaSetup(): Promise<void> {
  console.log('🔍 Validating Ollama setup...');
  
  const isHealthy = await checkOllamaHealth();
  
  if (!isHealthy) {
    throw new Error(
      `Ollama is not running at ${process.env.OLLAMA_URL || 'http://10.0.0.60:11434'}`
    );
  }
  
  console.log('✅ Ollama is running and ready');
}
```

---

## 7. Implementation Checklist

### Step 1: Create Ollama Utility
- [ ] Create `src/lib/ollama.ts`
  - [ ] Implement `generateEmbedding()`
  - [ ] Implement `generateCompletion()`
  - [ ] Implement `checkOllamaHealth()`

### Step 2: Update Dependencies
- [ ] Remove `import OpenAI` statements
- [ ] Add environment variables to `.env.local`
- [ ] Verify `axios` or `node-fetch` is available (for HTTP calls)

### Step 3: Update Upload Endpoint
- [ ] Replace OpenAI embedding call in `src/app/api/upload/route.ts`
- [ ] Update embedding response parsing
- [ ] Test file upload and embedding generation

### Step 4: Update Search Endpoint
- [ ] Replace OpenAI embedding call in `src/app/api/search/route.ts`
- [ ] Replace OpenAI chat completion call
- [ ] Update response handling
- [ ] Test search functionality

### Step 5: Create Test Scripts
- [ ] Create `scripts/test-ollama.sh`
- [ ] Create `src/lib/ollama-health.ts`
- [ ] Test Ollama connectivity

### Step 6: Validation
- [ ] Run test-ollama.sh to verify Ollama is accessible
- [ ] Upload a test document
- [ ] Search with test query
- [ ] Verify embeddings and completions work end-to-end

---

## 8. Key API Differences

### Embedding Generation

**OpenAI:**
```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'text'
});
// response.data[0].embedding → number[]
```

**Ollama:**
```typescript
const response = await fetch('http://10.0.0.60:11434/api/embed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.1:8b',
    input: 'text'
  })
});
// response.embedding → number[]
```

### Chat Completion

**OpenAI:**
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: '...' },
    { role: 'user', content: '...' }
  ]
});
// response.choices[0].message.content → string
```

**Ollama:**
```typescript
const response = await fetch('http://10.0.0.60:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.1:8b',
    prompt: 'system instruction...\n\nuser message...',
    stream: false
  })
});
// response.response → string
```

---

## 9. Performance Considerations

- **Embedding latency:** Ollama may be slower than OpenAI (varies by hardware)
- **Timeout settings:** May need to increase API timeouts in Next.js routes
- **Rate limiting:** Local Ollama has no rate limits, but single-threaded by default
- **Vector dimension:** Llama3.1 typically produces 4096-dimensional embeddings (verify actual size)

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Verify Ollama is running at `10.0.0.60:11434` |
| Model not found | Pull model: `ollama pull llama3.1:8b` |
| Slow embeddings | Llama3.1:8b is slower; consider using a smaller model |
| 429 quota errors gone | ✅ No more API rate limiting with local Ollama |

