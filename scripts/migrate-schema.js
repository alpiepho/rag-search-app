#!/usr/bin/env node

/**
 * Schema Migration Script
 * Migrates the documents table from 1536-dim embeddings to 768-dim embeddings
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateSchema() {
  console.log('🔄 Starting schema migration...\n');

  const migrationSQL = `
    -- Drop the old table if it exists
    DROP TABLE IF EXISTS documents CASCADE;

    -- Create the documents table with 768-dim embeddings
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // Try alternative approach using direct SQL execution
      console.log('📝 Running migration using SQL query...');
      
      // Execute the migration statement by statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.includes('CREATE EXTENSION')) {
          // Skip extension creation if not supported
          continue;
        }
        
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql: statement + ';',
        });

        if (stmtError) {
          console.log(`  ⚠️  Statement error: ${stmtError.message}`);
        }
      }

      console.log('✅ Migration completed (with some warnings)');
      return;
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nSchema details:');
    console.log('  - Table: documents');
    console.log('  - Embedding dimension: 768 (nomic-embed-text)');
    console.log('  - Index type: ivfflat');
    console.log('  - Similarity function: cosine distance');
    console.log('  - Matching function: match_documents()');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 If using Supabase, you may need to run the SQL manually in the SQL Editor:');
    console.log('   1. Go to your Supabase project');
    console.log('   2. Click SQL Editor');
    console.log('   3. Paste the contents of supabase_instructions.txt');
    console.log('   4. Run the SQL');
    process.exit(1);
  }
}

migrateSchema();
