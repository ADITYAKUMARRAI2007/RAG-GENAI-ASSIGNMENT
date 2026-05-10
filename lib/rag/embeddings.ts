import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Returns embeddings instance.
 * Priority:
 *   1. OPENAI_API_KEY  → direct OpenAI (most reliable for embeddings)
 *   2. OPENROUTER_API_KEY → OpenRouter embeddings endpoint (openai/text-embedding-3-small)
 *
 * OpenRouter supports embeddings at: https://openrouter.ai/api/v1/embeddings
 */
export function getEmbeddings(): OpenAIEmbeddings {
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  const hasOpenAI = openaiKey && !openaiKey.startsWith("your_");
  const hasOpenRouter = openrouterKey && !openrouterKey.startsWith("your_");

  if (!hasOpenAI && !hasOpenRouter) {
    throw new Error(
      "No API key configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY in .env.local"
    );
  }

  // Use direct OpenAI if available (preferred for embeddings)
  if (hasOpenAI) {
    return new OpenAIEmbeddings({
      openAIApiKey: openaiKey!,
      modelName: "text-embedding-3-small",
      batchSize: 512,
    });
  }

  // Use OpenRouter for embeddings
  return new OpenAIEmbeddings({
    openAIApiKey: openrouterKey!,
    modelName: "openai/text-embedding-3-small",
    batchSize: 512,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "DocuMind RAG",
      },
    },
  });
}
