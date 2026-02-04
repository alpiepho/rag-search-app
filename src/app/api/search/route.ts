import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateEmbedding, generateCompletion } from '@/lib/ollama';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!);

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const queryEmbedding = await generateEmbedding(query);
    const { data: results, error } = await supabase.rpc('match_documents', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.0,
      match_count: 5,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const context = results?.map((r: any) => r.content).join('\n---\n') || '';
    const systemPrompt = 'You are a helpful assistant. Use the provided context to answer. If the answer is not in the context, say you do not know.';
    const userMessage = `Context: ${context}\n\nQuestion: ${query}`;
    const answer = await generateCompletion(systemPrompt, userMessage);
    return NextResponse.json({ answer, sources: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
