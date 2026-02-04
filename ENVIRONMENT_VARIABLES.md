# Environment Variables - Required Configuration

## Changes Made

Updated the codebase to **require** explicit environment variable configuration instead of using defaults.

### Files Updated

1. **src/lib/ollama.ts**
   - `OLLAMA_URL` - Now required (no default)
   - `EMBEDDING_MODEL` - Now required (defaults to `nomic-embed-text`)
   - `CHAT_MODEL` - Optional (defaults to `llama3.1:8b`)
   - Added validation that throws errors if required variables are missing

2. **.env.local**
   - Added required variables:
     ```dotenv
     OLLAMA_URL=http://10.0.0.60:11434
     EMBEDDING_MODEL=nomic-embed-text
     CHAT_MODEL=llama3.1:8b
     ```

3. **scripts/test-ollama.sh**
   - Updated to read from `OLLAMA_URL` and `EMBEDDING_MODEL` environment variables
   - Added validation that exits with helpful error messages if variables are not set
   - Shows exact commands to set variables if missing

4. **Documentation Updates**
   - `OLLAMA_MIGRATION_PLAN.md` - Added environment variable requirements
   - `OLLAMA_MIGRATION_IMPLEMENTATION.md` - Marked variables as required with warning

## Benefits

✅ **Explicit Configuration** - Users must consciously set these values  
✅ **No Hidden Defaults** - Clear what Ollama URL and model are being used  
✅ **Early Error Detection** - Application fails at startup if variables missing  
✅ **Better Error Messages** - Helpful guidance on how to fix missing variables  
✅ **Clearer Intent** - Variables marked as required in code and docs  

## How to Run

### Option 1: Set in .env.local (Recommended)
```dotenv
OLLAMA_URL=http://10.0.0.60:11434
EMBEDDING_MODEL=nomic-embed-text
CHAT_MODEL=llama3.1:8b
```

### Option 2: Export before running
```bash
export OLLAMA_URL=http://10.0.0.60:11434
export EMBEDDING_MODEL=nomic-embed-text
export CHAT_MODEL=llama3.1:8b

# Then run tests
bash scripts/test-ollama.sh

# Or start dev server
npm run dev
```

## Testing

Run the test script after setting environment variables:
```bash
# If using .env.local, the dev server will automatically load these
npm run dev

# For manual testing:
export OLLAMA_URL=http://10.0.0.60:11434 && \
export EMBEDDING_MODEL=llama3.1:8b && \
bash scripts/test-ollama.sh
```

✅ All tests now require explicit environment variables before running!
