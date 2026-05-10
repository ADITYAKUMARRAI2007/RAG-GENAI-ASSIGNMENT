import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { getEmbeddings } from "./embeddings";

const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION_NAME || "assignment_03_notebooklm_rag";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// ─── Singleton store that survives Next.js hot-reloads ───────────────────────
// We attach it to `globalThis` so it persists across HMR cycles in dev mode.
declare global {
  // eslint-disable-next-line no-var
  var __documindMemoryStore: MemoryVectorStore | null;
  // eslint-disable-next-line no-var
  var __documindStoreMode: "qdrant" | "memory" | null;
}

if (!globalThis.__documindMemoryStore) globalThis.__documindMemoryStore = null;
if (!globalThis.__documindStoreMode) globalThis.__documindStoreMode = null;

function getMemoryStore(): MemoryVectorStore | null {
  return globalThis.__documindMemoryStore;
}
function setMemoryStore(store: MemoryVectorStore) {
  globalThis.__documindMemoryStore = store;
  globalThis.__documindStoreMode = "memory";
}

function isQdrantConfigured(): boolean {
  return !!(QDRANT_URL && QDRANT_URL.trim().length > 0);
}

// ─── Store documents ─────────────────────────────────────────────────────────

export async function storeDocuments(
  docs: Document[]
): Promise<{ mode: "qdrant" | "memory"; count: number }> {
  const embeddings = getEmbeddings();

  if (isQdrantConfigured()) {
    try {
      // Clear old data so each upload is a fresh notebook
      const client = new QdrantClient({
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
      });
      try {
        await client.deleteCollection(COLLECTION_NAME);
        console.log("[VectorStore] Cleared previous collection for fresh index.");
      } catch {
        // Collection might not exist yet — that's fine
      }

      await QdrantVectorStore.fromDocuments(docs, embeddings, {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: COLLECTION_NAME,
      });
      globalThis.__documindStoreMode = "qdrant";
      return { mode: "qdrant", count: docs.length };
    } catch (err) {
      console.warn("[VectorStore] Qdrant unavailable, using MemoryVectorStore:", (err as Error).message);
    }
  }

  // Fallback: in-memory store (persisted on globalThis to survive HMR)
  const store = await MemoryVectorStore.fromDocuments(docs, embeddings);
  setMemoryStore(store);
  return { mode: "memory", count: docs.length };
}

// ─── Retrieve with scores ────────────────────────────────────────────────────

export async function retrieveWithScores(
  query: string,
  topK = 4
): Promise<Array<[Document, number]>> {
  const embeddings = getEmbeddings();

  // Try Qdrant first whenever it is configured.
  // This avoids false negatives after hot reloads or dev-server restarts,
  // because the actual indexed data lives in Qdrant, not in memory.
  if (isQdrantConfigured()) {
    try {
      const store = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: QDRANT_URL,
        apiKey: QDRANT_API_KEY,
        collectionName: COLLECTION_NAME,
      });
      const qdrantResults = await store.similaritySearchWithScore(query, topK);
      if (qdrantResults.length > 0) {
        globalThis.__documindStoreMode = "qdrant";
        return qdrantResults;
      }
    } catch (err) {
      console.warn("[VectorStore] Qdrant retrieval failed, trying memory:", (err as Error).message);
    }
  }

  // Use memory store
  const memStore = getMemoryStore();
  if (memStore) {
    return memStore.similaritySearchWithScore(query, topK);
  }

  throw new Error(
    "No document has been indexed yet. Please upload a document first."
  );
}

// ─── Check if store is ready ─────────────────────────────────────────────────

export function isStoreReady(): boolean {
  return (
    globalThis.__documindStoreMode === "qdrant" ||
    globalThis.__documindMemoryStore !== null
  );
}
