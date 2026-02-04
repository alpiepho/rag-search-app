#!/bin/bash

# TO USE:
# set -a && source .env.local && set +a && bash scripts/test-ollama.sh


# Ollama Health Check and Test Script
# This script verifies that Ollama is running and ready for use

set -e

# Configuration - require OLLAMA_URL and EMBEDDING_MODEL to be set
OLLAMA_URL="${OLLAMA_URL}"
EMBEDDING_MODEL="${EMBEDDING_MODEL}"
CHAT_MODEL="${CHAT_MODEL:-llama3.1:8b}"  # Default to llama3.1:8b if not set
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validate required environment variables
if [ -z "$OLLAMA_URL" ]; then
  echo -e "${RED}❌ Error: OLLAMA_URL environment variable not set${NC}"
  echo "Please set it in .env.local or export it:"
  echo "  export OLLAMA_URL=http://10.0.0.60:11434"
  exit 1
fi

if [ -z "$EMBEDDING_MODEL" ]; then
  echo -e "${RED}❌ Error: EMBEDDING_MODEL environment variable not set${NC}"
  echo "Please set it in .env.local or export it:"
  echo "  export EMBEDDING_MODEL=nomic-embed-text"
  exit 1
fi
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Ollama Health Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Ollama URL: $OLLAMA_URL"
echo "Embedding Model: $EMBEDDING_MODEL"
echo "Chat Model: $CHAT_MODEL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Check if Ollama is running
echo -e "${YELLOW}1️⃣  Checking Ollama connectivity...${NC}"
if curl -s --max-time $TIMEOUT "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Ollama is responding${NC}"
else
  echo -e "${RED}❌ Ollama is not responding at $OLLAMA_URL${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Verify Ollama is running: ollama serve"
  echo "  2. Check network connectivity to 10.0.0.60"
  echo "  3. Ensure port 11434 is accessible"
  echo ""
  exit 1
fi

# Check if model is available
echo ""
echo -e "${YELLOW}2️⃣  Checking if models are available...${NC}"

MODELS_RESPONSE=$(curl -s --max-time $TIMEOUT "$OLLAMA_URL/api/tags")
if echo "$MODELS_RESPONSE" | grep -q "$EMBEDDING_MODEL"; then
  echo -e "${GREEN}✅ Embedding model '$EMBEDDING_MODEL' is available${NC}"
else
  echo -e "${RED}❌ Embedding model '$EMBEDDING_MODEL' not found${NC}"
  echo "Available models:"
  echo "$MODELS_RESPONSE" | grep -o '"name":"[^"]*"' | sed 's/"name":"\|"//g' | sed 's/^/  - /'
  echo ""
  echo "To pull the embedding model, run:"
  echo -e "  ${BLUE}ollama pull $EMBEDDING_MODEL${NC}"
  exit 1
fi

if echo "$MODELS_RESPONSE" | grep -q "$CHAT_MODEL"; then
  echo -e "${GREEN}✅ Chat model '$CHAT_MODEL' is available${NC}"
else
  echo -e "${RED}❌ Chat model '$CHAT_MODEL' not found${NC}"
  echo "To pull the chat model, run:"
  echo -e "  ${BLUE}ollama pull $CHAT_MODEL${NC}"
  exit 1
fi

# Test embedding generation
echo ""
echo -e "${YELLOW}3️⃣  Testing embedding generation...${NC}"

EMBED_RESPONSE=$(curl -s --max-time 30 -X POST "$OLLAMA_URL/api/embed" \
  -H "Content-Type: application/json" \
  -d '{"model":"'"$EMBEDDING_MODEL"'","input":"test embedding"}' 2>&1)

if echo "$EMBED_RESPONSE" | grep -q '"embedding'; then
  # Check for both single embedding and embeddings array formats
  if echo "$EMBED_RESPONSE" | grep -q '"embeddings"'; then
    EMBED_DIM=$(echo "$EMBED_RESPONSE" | jq '.embeddings[0] | length' 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ Embedding generation works${NC}"
    echo -e "   Embedding dimension: ${BLUE}$EMBED_DIM${NC}"
  elif echo "$EMBED_RESPONSE" | grep -q '"embedding"'; then
    EMBED_DIM=$(echo "$EMBED_RESPONSE" | jq '.embedding | length' 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ Embedding generation works${NC}"
    echo -e "   Embedding dimension: ${BLUE}$EMBED_DIM${NC}"
  else
    echo -e "${RED}❌ Embedding response format invalid${NC}"
    echo "   Response: $EMBED_RESPONSE" | head -c 200
    exit 1
  fi
else
  echo -e "${RED}❌ Embedding generation failed${NC}"
  echo "   Response: $EMBED_RESPONSE" | head -c 200
  exit 1
fi

# Test text generation
echo ""
echo -e "${YELLOW}4️⃣  Testing text generation...${NC}"

GEN_RESPONSE=$(curl -s --max-time 30 -X POST "$OLLAMA_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{"model":"'"$CHAT_MODEL"'","prompt":"What is 2+2?","stream":false}' 2>&1)

if echo "$GEN_RESPONSE" | grep -q '"response"'; then
  ANSWER=$(echo "$GEN_RESPONSE" | jq -r '.response' 2>/dev/null | head -c 150)
  echo -e "${GREEN}✅ Text generation works${NC}"
  echo -e "   Sample response: ${BLUE}${ANSWER}...${NC}"
else
  echo -e "${RED}❌ Text generation failed${NC}"
  echo "   Response: $GEN_RESPONSE"
  exit 1
fi

# All tests passed
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Ollama tests passed! System is ready to use.${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit 0
