# Local Development Environment Implementation Plan

## Overview
Migrate the RAG search application from external cloud services to a fully local setup using Docker, local Supabase, and Ollama with Llama3.1:8b.

## Phase 1: Infrastructure Setup

### 1.1 Docker & Docker Compose Configuration
- **Create `Dockerfile`** for Node.js application
  - Base image: `node:18-alpine` (or latest compatible)
  - Install dependencies from `package.json`
  - Expose port 3000 for Next.js dev server
  - Volume mount for live code reloading

- **Create `docker-compose.yml`** with services:
  - **rag-search-app**: Next.js application (port 3000)
  - **supabase**: Local Supabase instance (port 5432 for DB)
  - **ollama**: Local Ollama with Llama3.1:8b (port 11434)
  - Network: Connect all services on same network

### 1.2 Environment Configuration
- **Create `.env.local`** for local development:
  - Supabase credentials (local instance)
  - Ollama endpoint: `http://ollama:11434`
  - Database connection string for local Postgres

## Phase 2: Supabase Local Setup

### 2.1 Database Schema
- Configure local Supabase with required tables:
  - Documents table (id, name, content, metadata, created_at)
  - Embeddings table (id, document_id, embedding, content)
- Set up RPC function `match_documents` for vector similarity search

### 2.2 Vector Storage
- Enable pgvector extension in local Postgres
- Create embedding columns as vector type
- Set up proper indexing for similarity search

## Phase 3: API Changes

### 3.1 Search Endpoint (`/api/search`)
- **Replace OpenAI embedding** with local Ollama:
  - Change from `openai.embeddings.create()` to Ollama API call
  - Endpoint: `POST http://ollama:11434/api/embed`
  - Model: `llama3.1:8b`

- **Replace OpenAI chat completion** with Ollama:
  - Change from `openai.chat.completions.create()` to Ollama API call
  - Endpoint: `POST http://ollama:11434/api/generate`
  - Model: `llama3.1:8b`

### 3.2 Upload Endpoint (`/api/upload`)
- Keep existing file extraction logic (PDF, DOCX, TXT)
- **Replace OpenAI embeddings** with Ollama embeddings
- **Replace Supabase client** with local Supabase instance credentials
- Text splitting logic remains the same

### 3.3 Documents Endpoint (`/api/documents`)
- Update to use local Supabase instance
- Keep existing document listing/management logic

## Phase 4: Dependencies Management

### 4.1 Update `package.json`
- Remove or make optional: `@langchain/openai`, `openai`
- Add: Libraries for local Ollama API communication
- Keep: LangChain core, text splitters, file processing

### 4.2 New Dependencies to Consider
- `axios` or `node-fetch` for HTTP calls to Ollama
- Local Supabase CLI (for development)

## Phase 5: Configuration & Documentation

### 5.1 Dockerfile Setup
- Multi-stage build (optional, for optimization)
- Proper port exposure and volume mounting
- Health checks for service readiness

### 5.2 Docker Compose
- Service dependencies and startup order
- Volume mappings for code and data persistence
- Environment variable passing
- Network configuration

### 5.3 Documentation
- Update README with local setup instructions
- Document how to start/stop services
- Detach/reattach container instructions
- Troubleshooting guide

## Phase 6: Testing & Validation

### 6.1 Local Testing
- Verify Docker containers start properly
- Test document upload functionality
- Test search with local Ollama
- Verify embeddings are generated and stored
- Test RAG pipeline end-to-end

### 6.2 Performance Verification
- Monitor local Ollama response times
- Check embedding quality
- Validate vector similarity search results

## Implementation Order

1. Create Docker & Docker Compose files
2. Set up local Supabase configuration
3. Update API endpoints for Ollama integration
4. Update dependencies and package.json
5. Create environment configuration
6. Test each service in isolation
7. Integration testing
8. Documentation updates

## Key Considerations

- **Network**: All services must be on same Docker network for internal communication
- **Ollama Model**: Ensure Llama3.1:8b is pre-pulled in Ollama or download on first run
- **Database**: Local Postgres will persist data in named volumes
- **Port Conflicts**: Ensure no port conflicts on host machine
- **Performance**: Local Ollama may be slower than cloud APIs; adjust timeouts accordingly
- **Development**: Live code reloading via volume mounts for faster iteration

## File Changes Summary

| File | Type | Changes |
|------|------|---------|
| `Dockerfile` | New | Configure Node.js container |
| `docker-compose.yml` | New | Orchestrate all services |
| `.env.local` | New | Local environment variables |
| `src/app/api/search/route.ts` | Modify | Replace OpenAI with Ollama |
| `src/app/api/upload/route.ts` | Modify | Replace OpenAI with Ollama |
| `package.json` | Modify | Update/add dependencies |
| `README.md` | Update | Add local setup instructions |

