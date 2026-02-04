# Ollama Configuration - Models and Embedding Dimensions

## Models Selected

### Embedding Model: `nomic-embed-text`
- **Dimension:** 768 (vs OpenAI's 1536)
- **Advantages:** Smaller vectors, faster processing
- **Use case:** Vector similarity search in document chunks

### Chat Model: `llama3.1:8b`
- **Size:** 8 billion parameters
- **Advantages:** Good balance of quality and performance  
- **Use case:** Generating contextual responses based on retrieved documents

## Database Impact

**Important:** You may need to adjust your PostgreSQL vector column type:
- **Current (OpenAI):** `vector(1536)` for text-embedding-3-small
- **New (Ollama):** `vector(768)` for nomic-embed-text

If you're starting fresh, the database will auto-detect the correct dimension.  
If migrating existing data, you may need to recreate the vector column or the embeddings table.

## Performance Comparison

| Metric | OpenAI | Ollama |
|--------|--------|--------|
| **Embedding Model** | text-embedding-3-small | nomic-embed-text |
| **Embedding Dimension** | 1536 | 768 |
| **Chat Model** | gpt-4o-mini | llama3.1:8b |
| **Vector Storage** | Requires API | Local |
| **Cost** | Per-token | Free |
| **Latency** | Network dependent | Local CPU |

## Testing Results

✅ **Models verified working:**
- `nomic-embed-text` - Generates 768-dimensional embeddings
- `llama3.1:8b` - Generates contextual responses

Run test script to verify:
```bash
export OLLAMA_URL=http://10.0.0.60:11434
export EMBEDDING_MODEL=nomic-embed-text
export CHAT_MODEL=llama3.1:8b
bash scripts/test-ollama.sh
```

## Next Steps

1. Pull the models in Ollama:
   ```bash
   ollama pull nomic-embed-text
   ollama pull llama3.1:8b
   ```

2. Update API routes to use `src/lib/ollama.ts` utilities

3. Test document upload and search functionality
