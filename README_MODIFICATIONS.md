# RAG Search App - Modifications for Local Development

Based on: https://www.freecodecamp.org/news/how-to-build-an-ai-powered-rag-search-application-with-nextjs-supabase-and-openai/  
Original Repository: https://github.com/mayur9210/rag-search-app

## Overview

This branch (`feature/local_dev`) transforms the tutorial's cloud-based RAG search application into a fully local development environment. The app now uses local Ollama for embeddings and completions, remote Supabase instance, and Docker for Node.js development.

## Key Changes from Main Branch

### 1. **AI Integration: OpenAI → Ollama**
- **Removed:** OpenAI API dependencies (`openai`, `@langchain/openai`)
- **Added:** Local Ollama HTTP API client
- **Files Modified:**
  - `src/lib/ollama.ts` (new) - Ollama API client with functions for embeddings and text generation
  - `src/app/api/search/route.ts` - Replaced OpenAI embeddings and chat completions
  - `src/app/api/upload/route.ts` - Replaced OpenAI embedding generation

### 2. **Docker & Containerization**
- **New Files:**
  - `Dockerfile` - Node.js 25-alpine container setup for Next.js development
  - `docker-compose.yaml` - Container orchestration (app service only, Supabase/Ollama run remotely)

### 3. **Configuration & Environment**
- **New Files:**
  - `env.local.example` - Example environment configuration for local development
  - `.vscode/settings.json` - VS Code settings with Peacock color theme for branch identification

### 4. **Documentation & Utilities**
- **New Files:**
  - `supabase_instructions.txt` - SQL schema for 768-dim vector embeddings
  - `scripts/migrate-schema.js` - Schema migration script for dimension changes
  - `scripts/test-ollama.sh` - Bash script to validate Ollama setup
  - `samples/generate_linux_pdfs.sh` - Script to generate sample PDFs for testing
  - `samples/.gitignore` - Git ignore for sample files

### 5. **Dependency Updates**
- Next.js: `16.1.4` → `16.1.6`
- Package-lock.json updated with new versions

## Architecture

```
┌─────────────────────────────────────────┐
│  Docker Container (This App)            │
│  ┌─────────────────────────────────────┐│
│  │  Next.js 16 (Node.js 25-alpine)     ││
│  │  - API Routes (/api/upload, /api/search)
│  │  - React Frontend Components        ││
│  │  - Supabase JS Client               ││
│  └─────────────────────────────────────┘│
└──────────┬──────────────────────────────┘
           │
    ┌──────┴──────────────────────────────┐
    │                                      │
    ▼                                      ▼
┌─────────────────────┐    ┌──────────────────────┐
│  Ollama (Remote)    │    │  Supabase (Remote)   │
│  http://10.0.0.xx   │    │  http://10.0.0.yy    │
│  - Embeddings       │    │  - Vector DB         │
│  - Completions      │    │  - File Storage      │
│  Port: 11434        │    │  Port: 8000, 5432    │
└─────────────────────┘    └──────────────────────┘
```

## Environment Configuration

### .env.local Example
```env
# Supabase (remote instance)
NEXT_PUBLIC_SUPABASE_URL=http://10.0.0.nn:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

# Ollama (remote instance)
OLLAMA_URL=http://10.0.0.nn:11434
EMBEDDING_MODEL=nomic-embed-text
CHAT_MODEL=llama3.1:8b
```

## Running the Application

### Prerequisites
1. Ollama running at `http://10.0.0.xx:11434` with models:
   - `nomic-embed-text` (for embeddings)
   - `llama3.1:8b` (for chat/completion)
2. Supabase instance running at `http://10.0.0.yy:8000`
3. Docker and Docker Compose installed

### Start the App
```bash
# Build and start the containerized app
docker-compose up --build

# The app will be available at http://localhost:3000
```

### Docker Useful Commands
```bash
# Detach from running container (keep it running)
Ctrl+P, Ctrl+Q

# Re-attach to running container
docker attach <container_id>
# or
docker attach <container_name>

# Stop containers
docker-compose down

# View logs
docker-compose logs -f app
```

## API Integration Changes

### /api/upload Route
- **Before:** Used OpenAI embedding-3-small (1536 dimensions)
- **After:** Uses Ollama nomic-embed-text (768 dimensions)
- Embeds document chunks using local Ollama instance
- Stores embeddings in Supabase database

### /api/search Route
- **Before:** Query embedded with OpenAI, completion with gpt-4o-mini
- **After:** Query embedded with Ollama, completion with llama3.1:8b
- Returns search results with source documents

## Database Schema

Supabase PostgreSQL with pgvector extension:
- Embedding dimension: **768** (for nomic-embed-text)
- Index: ivfflat for fast similarity search
- Function: `match_documents()` for semantic search

## Testing & Validation

### Test Ollama Setup
```bash
# Load environment variables and test Ollama
set -a && source .env.local && set +a && bash scripts/test-ollama.sh
```

This validates:
- Ollama connectivity
- Model availability (embedding & chat)
- Embedding generation
- Text generation

### Sample Data
Generate sample PDFs from Linux man pages:
```bash
bash samples/generate_linux_pdfs.sh
```

## Development Workflow

1. **Start containers:** `docker-compose up --build`
2. **Edit code:** All changes are live-reloaded (Next.js hot reload)
3. **Upload documents:** Use `/documents` page to upload and process
4. **Test search:** Try queries on `/` (search page)
5. **View logs:** `docker-compose logs -f app`

## Ollama API Details

### Embedding Endpoint
```
POST http://OLLAMA_URL/api/embed
{
  "model": "nomic-embed-text",
  "input": "text to embed"
}
```

### Generation Endpoint
```
POST http://OLLAMA_URL/api/generate
{
  "model": "llama3.1:8b",
  "prompt": "...",
  "stream": false
}
```

## Performance Notes

- **Embedding:** ~2-5s per document (local Ollama)
- **Chat completion:** ~5-15s per response (depends on response length)
- **Vector search:** <100ms (PostgreSQL ivfflat index)

## Future Improvements

1. Add streaming responses for better UX
2. Implement batch embedding processing
3. Add document chunking optimization
4. Support for more Ollama models
5. Add request caching layer
6. Integrate Docker Compose for Supabase/Ollama as well
