/**
 * Builds the strict document-grounded system prompt for DocuMind.
 * The LLM must answer ONLY from the retrieved context — no outside knowledge.
 */
export function buildSystemPrompt(context: string): string {
  return `You are DocuMind, a document-grounded RAG assistant inspired by Google NotebookLM.
Your job is to answer the user's question using the retrieved context from the uploaded documents.

RESPONSE FORMAT:
- Write in flowing, natural paragraphs
- Bold key terms, values, and important details using **text**
- Use a natural narrative style — explain clearly as if to a colleague
- For summary/overview questions, synthesize information across all provided chunks
- For specific questions, cite the relevant details from the context

CONTENT RULES:
1. Use ONLY the provided document context — do not use outside knowledge.
2. Do not guess or hallucinate facts not in the context.
3. For broad questions like "what is this about" or "summarize", give an overview based on ALL the provided chunks. Even partial context should be summarized.
4. Only say "I could not find this information in the uploaded documents." if the context contains absolutely nothing relevant to the question.
5. If context is partial, explain what IS available and note the coverage is limited.
6. When multiple documents are present, cover each one.
7. Never invent citations, page numbers, or facts.

Retrieved document context:
${context}

Answer the user's question using this context. Write in flowing paragraphs with bold highlights.`;
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
