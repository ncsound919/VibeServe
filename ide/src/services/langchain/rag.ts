import { supabase } from '../supabaseClient';

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export async function retrieve(
  query: string,
  k: number = 4
): Promise<RetrievedDocument[]> {
  // Simple text search using Supabase full-text search
  const { data, error } = await supabase
    .from('documents')
    .select('id, content, metadata, created_at')
    .or(`content.ilike.%${query}%,content.like.%${query}%`)
    .limit(k);

  if (error) {
    console.log('RAG retrieve error:', error.message);
  }

  // If we found matches, return them with high similarity
  if (data && data.length > 0) {
    return data.map((doc: { id: string; content: string; metadata: Record<string, unknown>; created_at: string }) => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
      similarity: 0.9,
    }));
  }

  // Fallback: return recent documents
  const { data: recentDocs } = await supabase
    .from('documents')
    .select('id, content, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(k);

  return (recentDocs || []).map((doc: { id: string; content: string; metadata: Record<string, unknown>; created_at: string }) => ({
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
    similarity: 0.3,
  }));
}

export async function ingestDocument(
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabase
    .from('documents')
    .insert({ content, metadata, embedding: null })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to ingest document: ${error.message}`);
  return data.id;
}

export function createRAGPrompt(
  retrievedDocs: RetrievedDocument[],
  question: string
): string {
  const context = retrievedDocs
    .map((doc) => `Document: ${doc.content}`)
    .join('\n\n');

  if (!context) {
    return `You are a helpful AI assistant.\n\nQuestion: ${question}\n\nAnswer:`;
  }

  return `You are a helpful AI assistant. Use the following context to answer the question.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
}
