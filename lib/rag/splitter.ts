import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

/**
 * Chunking Strategy:
 * ─────────────────
 * We use RecursiveCharacterTextSplitter with:
 *   - chunkSize: 1000 characters
 *   - chunkOverlap: 200 characters
 *
 * Why RecursiveCharacterTextSplitter?
 * It tries to split on natural boundaries first (paragraphs → sentences → words)
 * before falling back to hard character splits. This preserves semantic coherence.
 *
 * Why 1000 / 200?
 * - 1000 chars keeps each chunk large enough to hold a complete idea or paragraph.
 * - 200-char overlap ensures that context spanning two adjacent chunks is not lost
 *   at the boundary — critical for questions whose answers straddle chunk edges.
 *
 * Each chunk inherits the parent document's metadata (fileName, pageNumber, etc.)
 * and receives an additional chunkIndex for traceability.
 */
export async function splitDocuments(
  docs: Document[],
  chunkSize = 1000,
  chunkOverlap = 200
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
  });

  const splitDocs = await splitter.splitDocuments(docs);

  // Re-index chunkIndex across all split documents
  return splitDocs.map((doc, index) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      chunkIndex: index,
    },
  }));
}
