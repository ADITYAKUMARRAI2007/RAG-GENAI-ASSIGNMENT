import { NextRequest, NextResponse } from "next/server";
import { retrieveWithScores } from "@/lib/rag/vectorstore";
import { buildSystemPrompt, formatContext, SIMILARITY_THRESHOLD } from "@/lib/rag/prompts";
import type { ChatRequest, SourceChunk } from "@/lib/rag/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { question } = body;

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey || openrouterKey.startsWith("your_")) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    // Retrieve top-k chunks
    let results: Array<[{ pageContent: string; metadata: Record<string, unknown> }, number]>;
    try {
      results = await retrieveWithScores(question, 8);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No document has been indexed")) {
        return NextResponse.json({
          answer: "Please upload and index a document before asking questions.",
          sources: [],
        });
      }
      throw err;
    }

    // Filter by similarity threshold — use lower threshold for OCR'd docs
    const relevantResults = results.filter(([, score]) => score >= SIMILARITY_THRESHOLD);

    if (relevantResults.length === 0) {
      return NextResponse.json({
        answer: "I could not find this information in the uploaded document.",
        sources: [],
      });
    }

    // Build context + prompt
    const contextDocs = relevantResults.map(([doc]) => doc);
    const context = formatContext(contextDocs);
    const systemPrompt = buildSystemPrompt(context);

    // Call OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "DocuMind RAG",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "No response from model.";

    const sources: SourceChunk[] = relevantResults.map(([doc, score]) => ({
      content: doc.pageContent.slice(0, 300) + (doc.pageContent.length > 300 ? "…" : ""),
      page: doc.metadata?.pageNumber as number | undefined,
      chunkIndex: doc.metadata?.chunkIndex as number | undefined,
      score: Math.round(score * 100) / 100,
      fileName: doc.metadata?.fileName as string | undefined,
    }));

    return NextResponse.json({ answer, sources });

  } catch (error: unknown) {
    console.error("[Chat] Error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
