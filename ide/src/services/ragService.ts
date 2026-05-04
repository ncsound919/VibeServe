/**
 * Nexus Alpha RAG (Retrieval-Augmented Generation) Service
 * Qdrant vector store with Transformers.js local embeddings.
 * Falls back to in-memory store if Qdrant is unreachable.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import type { RAGContext } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    agentId?: string;
    timestamp: string;
    type: "repo" | "build_log" | "analysis" | "user_note" | "news";
  };
  embedding?: number[];
}

// ─── Qdrant Config ────────────────────────────────────────────────────────────
const COLLECTION_NAME = "nexus_rag";
const VECTOR_SIZE = 384;
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

let qdrantClient: QdrantClient | null = null;
let qdrantAvailable = false;
let embedPipeline: FeatureExtractionPipeline | null = null;

// ─── In-memory Vector Store (fallback & sync access) ─────────────────────────
const vectorStore = new Map<string, Document>();
let lastSync = new Date().toISOString();

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

// ─── Qdrant Connection (lazy) ─────────────────────────────────────────────────

async function getQdrant(): Promise<QdrantClient | null> {
  if (qdrantAvailable && qdrantClient) return qdrantClient;
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  try {
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      });
    }
    qdrantAvailable = true;
    return qdrantClient;
  } catch {
    console.warn(
      `[RAG] Qdrant unreachable at ${QDRANT_URL}, using in-memory fallback.`
    );
    qdrantAvailable = false;
    return null;
  }
}

// ─── Local Embeddings ─────────────────────────────────────────────────────────

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedPipeline) {
    embedPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embedPipeline;
}

async function localEmbed(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const result = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(result.data as Float32Array);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Index a document into the vector store */
export async function indexDocument(
  doc: Omit<Document, "embedding">,
  apiKey: string
): Promise<void> {
  const embedding = await localEmbed(doc.content);
  const fullDoc: Document = { ...doc, embedding };

  const client = await getQdrant();
  if (client) {
    try {
      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: doc.id,
            vector: embedding,
            payload: {
              content: doc.content,
              metadata: doc.metadata,
            },
          },
        ],
      });
    } catch {
      qdrantAvailable = false;
    }
  }

  vectorStore.set(doc.id, fullDoc);
  lastSync = new Date().toISOString();
}

/** Index multiple documents in parallel (batched) */
export async function indexDocuments(
  docs: Omit<Document, "embedding">[],
  apiKey: string,
  batchSize = 5
): Promise<void> {
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await Promise.all(batch.map((d) => indexDocument(d, apiKey)));
  }
}

/** Search the vector store for the top-k most relevant documents */
export async function search(
  query: string,
  apiKey: string,
  topK = 5
): Promise<Array<{ document: Document; score: number }>> {
  const queryEmbedding = await localEmbed(query);

  const client = await getQdrant();
  if (client) {
    try {
      const results = await client.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
        with_vector: true,
      });
      return results.map((r) => ({
        document: {
          id: String(r.id),
          content: (r.payload as Record<string, unknown>).content as string,
          metadata: (r.payload as Record<string, unknown>).metadata as Document["metadata"],
          embedding: r.vector as number[],
        },
        score: r.score,
      }));
    } catch {
      qdrantAvailable = false;
    }
  }

  if (vectorStore.size === 0) return [];

  const results: Array<{ document: Document; score: number }> = [];
  for (const doc of vectorStore.values()) {
    if (!doc.embedding) continue;
    const score = cosineSimilarity(queryEmbedding, doc.embedding);
    results.push({ document: doc, score });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Get RAGContext summary for dashboard */
export function getRAGContext(): RAGContext {
  const docs = Array.from(vectorStore.values());
  return {
    indexedDocs: docs.length,
    relevantSnippets: docs
      .slice(-5)
      .map((d) => `[${d.metadata.type}] ${d.content.slice(0, 100)}...`),
    lastSync,
  };
}

/** Clear all indexed documents */
export function clearIndex(): void {
  vectorStore.clear();
  lastSync = new Date().toISOString();
}

/** Get all documents (for debugging) */
export function getAllDocuments(): Document[] {
  return Array.from(vectorStore.values());
}
