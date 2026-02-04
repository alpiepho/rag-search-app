# Ollama Migration - Database Schema Update

## Overview
The migration from OpenAI to Ollama requires updating your Supabase database schema to use 768-dimensional embeddings (from nomic-embed-text) instead of 1536-dimensional embeddings (from text-embedding-3-small).

## Steps to Update the Schema

### Option 1: Clean Migration (Recommended - Deletes all existing documents)

1. Go to your Supabase project: https://app.supabase.com
2. Click on **SQL Editor** in the left sidebar
3. Click **+ New Query**
4. Copy and paste the following SQL:

```sql
-- Drop the old table
DROP TABLE IF EXISTS documents CASCADE;

-- Create the new documents table with 768-dim embeddings
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(768),
  file_path text null,
  file_url text null
);

-- Create index for vector similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);

-- Create the match_documents function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

5. Click **Run** button (or press Ctrl+Enter)
6. Wait for the query to complete (you should see "Success")
7. The schema is now ready for Ollama embeddings!

### Option 2: Preserve Existing Data (Advanced)

If you have important documents you want to keep, you can migrate to 768-dim by:

1. Truncating the table (keep schema but delete data): Delete from the UI
2. Then run Option 1 above

OR

Use a script to convert embeddings (not recommended as data loss is inevitable when reducing dimensions).

## Verification

To verify the schema was updated correctly:

1. Go to SQL Editor
2. Run this query:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents';
```

You should see:
- `embedding` column with type `vector` (or similar)
- No dimension mismatch errors when uploading documents

## After Migration

Once the schema is updated:

1. The dev server should automatically use the new schema
2. You can upload documents and they will be embedded with nomic-embed-text (768-dim)
3. Search will work correctly with the new embeddings

## Troubleshooting

**Error: "expected 1536 dimensions, not 768"**
- Your schema still has the old 1536-dim column
- Run Option 1 above to fix it

**Error: "vector extension not found"**
- The vector extension is already enabled by Supabase
- This should not happen - contact Supabase support if it does

**Documents table not found**
- Run Option 1 above to create the table from scratch

## More Information

- Embedding model: nomic-embed-text (768 dimensions)
- Chat model: llama3.1:8b
- Supabase project: https://app.supabase.com
- SQL documentation: https://supabase.com/docs/guides/database/extensions/pgvector
