# Ollama Migration Implementation Summary

## Documents Created

### 1. **OLLAMA_MIGRATION_PLAN.md**
Comprehensive detailed plan for replacing OpenAI calls with Ollama, including:
- Phase 3 analysis of current code
- Specific implementation steps for each API route
- Code comparison (OpenAI vs Ollama)
- Environment variable configuration
- Performance considerations and troubleshooting

### 2. **scripts/test-ollama.sh**
Bash script to verify Ollama setup:
- Checks if Ollama is running at `10.0.0.60:11434`
- Verifies `llama3.1:8b` model is available
- Tests embedding generation
- Tests text generation
- Provides colored output and helpful error messages
- Usage: `bash scripts/test-ollama.sh`

### 3. **src/lib/ollama.ts**
TypeScript utility module providing:
- `generateEmbedding(text)` - Creates embeddings for text chunks
- `generateCompletion(systemPrompt, userMessage)` - Generates responses
- `checkOllamaHealth()` - Verifies Ollama is running
- `getAvailableModels()` - Lists available models
- `validateOllamaSetup()` - Startup validation
- `getOllamaInfo()` - Returns configuration info

---

## Implementation Workflow

### Phase 1: Preparation
```bash
# 1. Test Ollama connectivity
bash scripts/test-ollama.sh

# 2. Ensure model is pulled
ollama pull llama3.1:8b
```

### Phase 2: Code Updates (Two files to modify)

#### File 1: `src/app/api/upload/route.ts`
**Replace lines 1-12:**
```typescript
// REMOVE:
import OpenAI from 'openai';
const openai = new OpenAI();

// ADD:
import { generateEmbedding } from '@/lib/ollama';
```

**Replace lines 77-82:**
```typescript
// REMOVE:
const emb = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunk,
});

// ADD:
const embedding = await generateEmbedding(chunk);
```

**Replace line 97:**
```typescript
// CHANGE:
embedding: JSON.stringify(emb.data[0].embedding),
// TO:
embedding: JSON.stringify(embedding),
```

#### File 2: `src/app/api/search/route.ts`
**Replace lines 1-6:**
```typescript
// REMOVE:
import OpenAI from 'openai';
const openai = new OpenAI();

// ADD:
import { generateEmbedding, generateCompletion } from '@/lib/ollama';
```

**Replace lines 8-9:**
```typescript
// REMOVE:
const emb = await openai.embeddings.create({ 
  model: 'text-embedding-3-small', 
  input: query 
});

// ADD:
const queryEmbedding = await generateEmbedding(query);
```

**Replace line 12:**
```typescript
// CHANGE:
query_embedding: JSON.stringify(emb.data[0].embedding),
// TO:
query_embedding: JSON.stringify(queryEmbedding),
```

**Replace lines 19-28:**
```typescript
// REMOVE:
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant...' },
    { role: 'user', content: `Context: ${context}\n\nQuestion: ${query}` }
  ],
});

// ADD:
const systemPrompt = 'You are a helpful assistant. Use the provided context to answer. If the answer is not in the context, say you do not know.';
const userMessage = `Context: ${context}\n\nQuestion: ${query}`;
const answer = await generateCompletion(systemPrompt, userMessage);
```

**Replace line 31:**
```typescript
// CHANGE:
return NextResponse.json({ answer: completion.choices[0].message.content, sources: results });
// TO:
return NextResponse.json({ answer: answer, sources: results });
```

### Phase 3: Environment Configuration
Update `.env.local` with required variables:
```dotenv
# Required Ollama configuration
OLLAMA_URL=http://10.0.0.60:11434
EMBEDDING_MODEL=nomic-embed-text
CHAT_MODEL=llama3.1:8b

# Keep OpenAI key (optional, for future use):
# OPENAI_API_KEY=...
```

⚠️ **Important:** Both `OLLAMA_URL` and `EMBEDDING_MODEL` are **required**. The application will fail to start without them.

### Phase 4: Testing
```bash
# 1. Start development server (if not running)
npm run dev

# 2. Test document upload
# - Open app in browser
# - Upload a sample PDF from samples/ directory
# - Verify document appears in documents list

# 3. Test search
# - Click on a document
# - Enter a search query
# - Verify response is generated

# 4. Check server logs
# - Look for embedding and completion calls
# - Verify no OpenAI API errors
```

---

## Key Differences: OpenAI → Ollama

| Aspect | OpenAI | Ollama |
|--------|--------|--------|
| **Embedding API** | `/v1/embeddings` | `/api/embed` |
| **Generation API** | `/v1/chat/completions` | `/api/generate` |
| **Auth** | API Key header | None (local) |
| **Response format** | `data[0].embedding` | `embedding` |
| **Chat format** | Message objects array | Single prompt string |
| **Streaming** | Built-in support | Separate parameter |
| **Rate limits** | Yes | None |
| **Cost** | Per-token pricing | Free (local) |
| **Latency** | ~100-500ms | Varies (CPU dependent) |

---

## Critical Points

### ✅ What Works the Same
- Document chunking (RecursiveCharacterTextSplitter)
- Supabase storage and database
- File upload handling
- Vector similarity search (PostgreSQL pgvector)

### ⚠️ What Changes
- API calls are now local (no internet required)
- Response format slightly different
- Model parameters are fixed (temperature, etc.)
- No more API quota issues

### 🔍 What to Monitor
- Embedding generation latency (Llama3.1:8b may be different from nomic-embed-text)
- Text generation quality (Llama3.1:8b vs GPT-4o-mini)
- Memory usage (Ollama runs locally)
- Network connectivity to `10.0.0.60:11434`

---

## Troubleshooting Quick Reference

### Issue: "Connection refused"
```bash
# Verify Ollama is running
curl http://10.0.0.60:11434/api/tags

# Or check from terminal
ollama serve  # Start Ollama if not running
```

### Issue: "Model not found"
```bash
# Pull the model
ollama pull llama3.1:8b

# Verify it's available
ollama list
```

### Issue: Slow performance
- nomic-embed-text and Llama3.1:8b have different performance characteristics than OpenAI models
- Increase `REQUEST_TIMEOUT` in `src/lib/ollama.ts` if needed
- Consider profiling on your hardware

### Issue: Out of memory
- Reduce model size (llama2:7b or neural-chat)
- Check available system memory
- Increase Ollama memory limit if using Docker

---

## Files Modified/Created

```
Created:
  ✨ OLLAMA_MIGRATION_PLAN.md          (comprehensive guide)
  ✨ scripts/test-ollama.sh             (health check)
  ✨ src/lib/ollama.ts                  (Ollama API client)

To Modify:
  📝 src/app/api/upload/route.ts        (4 changes)
  📝 src/app/api/search/route.ts        (5 changes)
  📝 .env.local                         (add 3 env vars)
```

---

## Next Steps

1. **Run the test script:**
   ```bash
   bash scripts/test-ollama.sh
   ```

2. **Review OLLAMA_MIGRATION_PLAN.md** for detailed step-by-step instructions

3. **Update the two API routes** with imports and function calls

4. **Test the application:**
   - Upload documents
   - Perform searches
   - Verify embeddings and completions work

5. **Optional: Optimize**
   - Adjust timeout values if needed
   - Consider different Ollama models
   - Tune temperature/generation parameters

---

## Questions?

Check OLLAMA_MIGRATION_PLAN.md for:
- API endpoint details
- Request/response formats
- Performance considerations
- Detailed troubleshooting guide

