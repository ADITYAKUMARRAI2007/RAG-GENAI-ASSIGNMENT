import { NextRequest, NextResponse } from "next/server";
import { loadDocument } from "@/lib/rag/loaders";
import { splitDocuments } from "@/lib/rag/splitter";
import { storeDocuments } from "@/lib/rag/vectorstore";

export const runtime = "nodejs";
export const maxDuration = 120; // OCR on scanned PDFs can take time

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  try {
    // ── Validate API key first ────────────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const hasValidKey =
      (openaiKey && !openaiKey.startsWith("your_")) ||
      (openrouterKey && !openrouterKey.startsWith("your_"));

    if (!hasValidKey) {
      return NextResponse.json(
        { success: false, error: "API key not configured. Add OPENAI_API_KEY or OPENROUTER_API_KEY to .env.local and restart the server." },
        { status: 500 }
      );
    }

    // ── Parse upload ──────────────────────────────────────────────────────
    const formData = await req.formData();
    const rawFiles = formData.getAll("files").filter((item): item is File => item instanceof File);
    const singleFile = formData.get("file");
    const files = rawFiles.length > 0
      ? rawFiles
      : singleFile instanceof File
        ? [singleFile]
        : [];

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
    }

    const supportedFiles = files.filter((file) => {
      const fileName = file.webkitRelativePath || file.name;
      const ext = fileName.split(".").pop()?.toLowerCase();
      return !!ext && ["pdf", "txt", "csv"].includes(ext);
    });

    if (supportedFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No supported files found. Upload PDF, TXT, or CSV documents." },
        { status: 400 }
      );
    }

    const allChunks: Awaited<ReturnType<typeof splitDocuments>> = [];
    const fileSummaries: Array<{ fileName: string; totalChunks: number }> = [];
    const fileErrors: Array<{ fileName: string; error: string }> = [];

    for (const file of supportedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        fileErrors.push({ fileName: file.name, error: `File too large. Maximum 20 MB per file.` });
        continue;
      }

      const fileName = file.webkitRelativePath || file.name;
      const mimeType = file.type || "application/octet-stream";
      const buffer = Buffer.from(await file.arrayBuffer());

      console.log(`[Upload] Loading: ${fileName} (${(file.size / 1024).toFixed(1)} KB)`);
      let rawDocs;
      try {
        rawDocs = await loadDocument(buffer, fileName, mimeType);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse document.";
        fileErrors.push({ fileName, error: message });
        continue;
      }

      if (rawDocs.length === 0) {
        fileErrors.push({ fileName, error: "Document is empty." });
        continue;
      }

      console.log(`[Upload] Splitting ${fileName} (${rawDocs.length} page(s))...`);
      let chunks;
      try {
        chunks = await splitDocuments(rawDocs);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Chunking failed.";
        fileErrors.push({ fileName, error: message });
        continue;
      }

      if (chunks.length === 0) {
        fileErrors.push({ fileName, error: `No text could be extracted from ${fileName}.` });
        continue;
      }

      fileSummaries.push({ fileName, totalChunks: chunks.length });
      allChunks.push(...chunks);
    }

    // ── Step 3: Embed + Store ─────────────────────────────────────────────
    console.log(`[Upload] Embedding ${allChunks.length} chunks from ${fileSummaries.length} file(s)...`);
    if (allChunks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: fileErrors[0]?.error || "No supported documents could be indexed.",
          fileErrors,
        },
        { status: 400 }
      );
    }

    const { mode, count } = await storeDocuments(allChunks);

    console.log(`[Upload] ✓ Done — ${count} chunks via ${mode.toUpperCase()}`);

    return NextResponse.json({
      success: true,
      fileName: fileSummaries[0]?.fileName,
      files: fileSummaries,
      totalFiles: fileSummaries.length,
      totalChunks: count,
      storageMode: mode,
      fileErrors,
      message: `Indexed ${fileSummaries.length} file(s) successfully (${mode === "qdrant" ? "Qdrant" : "memory store"}).`,
    });

  } catch (error: unknown) {
    console.error("[Upload] Error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
