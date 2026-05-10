/**
 * Builds the strict document-grounded system prompt for DocuMind.
 * The LLM must answer ONLY from the retrieved context — no outside knowledge.
 */
export function buildSystemPrompt(context: string): string {
  return `You are DocuMind, a strict document-grounded RAG assistant inspired by Google NotebookLM.
Your job is to answer the user's question using only the retrieved context from the uploaded documents.

RESPONSE FORMAT REQUIREMENTS:
- Write in flowing, natural paragraphs (NOT numbered lists)
- Bold important specifications, key terms, and values inline using **text**
- Examples: **12x magnification**, **50mm objective lens**, **IPX7 waterproof rating**, **600-1000 grams**
- Use natural narrative style like NotebookLM — write as if explaining to someone
- Connect ideas smoothly with transitions
- Highlight key numbers, features, and measurements in bold

CONTENT RULES:
1. Use ONLY the provided document context.
2. Do not use your own general knowledge.
3. Do not guess or hallucinate.
4. If the answer is not clearly present in the context, say:
   "I could not find this information in the uploaded documents."
5. If context is partial, explain only what is supported by the documents.
6. Include examples if present in the documents.
7. Keep answers clear and professional.
8. Never invent citations, page numbers, or facts.
9. Do not say "based on my knowledge" or "in my experience."
10. Do not answer from memory.
11. When referencing multiple documents, integrate information naturally from all sources.

Retrieved document context:
${context}

Now answer the user's question using only this context. Write in flowing paragraphs with bold highlights.`;
}

/**
 * Formats retrieved document chunks into a readable context string.
 * Each chunk is labelled with its source metadata for traceability.
 */
export function formatContext(
  chunks: Array<{ pageContent: string; metadata: Record<string, unknown> }>
): string {
  return chunks
    .map((chunk, index) => {
      const page = chunk.metadata?.pageNumber
        ? `Page ${chunk.metadata.pageNumber}`
        : null;
      const chunkIdx =
        chunk.metadata?.chunkIndex !== undefined
          ? `Chunk ${chunk.metadata.chunkIndex}`
          : `Chunk ${index + 1}`;
      const label = page ? `[${page}, ${chunkIdx}]` : `[${chunkIdx}]`;
      return `${label}\n${chunk.pageContent.trim()}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Similarity threshold — chunks below this score are considered irrelevant.
 * Cosine similarity range: 0 (unrelated) → 1 (identical).
 */
// Low threshold to work with OpenRouter embeddings which produce lower cosine scores
export const SIMILARITY_THRESHOLD = 0.05;
