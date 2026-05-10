import { Document } from "@langchain/core/documents";
import { spawn } from "child_process";
import path from "path";
import type { DocumentMetadata } from "./types";

// ─── PDF Worker ──────────────────────────────────────────────────────────────

type WorkerTextResult = { type: "text"; text: string; numpages: number };
type WorkerImageResult = { type: "images"; pages: Array<{ page: number; b64: string }> };
type WorkerError = { error: string };
type WorkerResult = WorkerTextResult | WorkerImageResult | WorkerError;

function runPDFWorker(buffer: Buffer): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(process.cwd(), "lib", "rag", "pdf-worker.js");
    const child = spawn(process.execPath, [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => err.push(c));

    child.on("close", () => {
      const raw = Buffer.concat(out).toString("utf-8").trim();
      if (!raw) {
        const errMsg = Buffer.concat(err).toString("utf-8").trim();
        return reject(new Error(`PDF worker produced no output. stderr: ${errMsg.slice(0, 300)}`));
      }
      try {
        resolve(JSON.parse(raw) as WorkerResult);
      } catch {
        reject(new Error(`PDF worker returned invalid JSON: ${raw.slice(0, 200)}`));
      }
    });

    child.on("error", (e) => reject(new Error(`Failed to spawn PDF worker: ${e.message}`)));

    child.stdin.write(buffer);
    child.stdin.end();
  });
}

// ─── OCR via OpenRouter Vision ───────────────────────────────────────────────

async function ocrPageWithVision(b64: string, pageNum: number): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const apiKey = (openrouterKey && !openrouterKey.startsWith("your_"))
    ? openrouterKey
    : (openaiKey && !openaiKey.startsWith("your_"))
    ? openaiKey
    : null;

  if (!apiKey) throw new Error("No API key configured for OCR.");

  const isOpenRouter = apiKey === openrouterKey;
  const baseURL = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const model = isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini";

  const response = await fetch(baseURL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter && {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "DocuMind RAG",
      }),
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a precise OCR engine. Extract ALL text from this document image exactly as it appears. 
Preserve tables, headings, bullet points, and structure. 
Output only the extracted text — no commentary, no markdown fences.
This is page ${pageNum} of the document.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}`, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── PDF Loader ──────────────────────────────────────────────────────────────

export async function loadPDF(buffer: Buffer, fileName: string): Promise<Document[]> {
  const result = await runPDFWorker(buffer);

  if ("error" in result) {
    throw new Error(`PDF parsing failed: ${result.error}`);
  }

  // ── Text PDF ──
  if (result.type === "text") {
    const fullText = result.text.trim();
    if (!fullText) throw new Error("PDF has no extractable text.");

    const rawPages = fullText.split("\f").map((p: string) => p.trim()).filter(Boolean);
    const pages = rawPages.length > 0 ? rawPages : [fullText];

    return pages.map((pageText: string, index: number) =>
      new Document({
        pageContent: pageText,
        metadata: {
          fileName, pageNumber: index + 1, chunkIndex: index,
          uploadedAt: new Date().toISOString(), source: fileName,
        } as DocumentMetadata,
      })
    );
  }

  // ── Scanned / Image PDF — OCR each page ──
  if (result.type === "images") {
    console.log(`[Loader] Scanned PDF detected — running OCR on ${result.pages.length} page(s) via vision model...`);

    const docs: Document[] = [];

    for (const { page, b64 } of result.pages) {
      console.log(`[Loader] OCR page ${page}/${result.pages.length}...`);
      try {
        const text = await ocrPageWithVision(b64, page);
        if (text.trim()) {
          docs.push(
            new Document({
              pageContent: text.trim(),
              metadata: {
                fileName, pageNumber: page, chunkIndex: page - 1,
                uploadedAt: new Date().toISOString(), source: fileName,
                ocrExtracted: true,
              } as DocumentMetadata & { ocrExtracted: boolean },
            })
          );
        }
      } catch (err) {
        console.warn(`[Loader] OCR failed for page ${page}:`, err);
      }
    }

    if (docs.length === 0) {
      throw new Error("OCR could not extract any text from the scanned PDF pages.");
    }

    console.log(`[Loader] OCR complete — extracted text from ${docs.length} page(s).`);
    return docs;
  }

  throw new Error("Unexpected PDF worker result.");
}

// ─── TXT Loader ──────────────────────────────────────────────────────────────

export async function loadTXT(buffer: Buffer, fileName: string): Promise<Document[]> {
  const text = buffer.toString("utf-8").trim();
  if (!text) throw new Error("Text file appears to be empty.");

  return [
    new Document({
      pageContent: text,
      metadata: {
        fileName, pageNumber: 1, chunkIndex: 0,
        uploadedAt: new Date().toISOString(), source: fileName,
      } as DocumentMetadata,
    }),
  ];
}

// ─── CSV Loader ──────────────────────────────────────────────────────────────

export async function loadCSV(buffer: Buffer, fileName: string): Promise<Document[]> {
  const text = buffer.toString("utf-8").trim();
  if (!text) throw new Error("CSV file appears to be empty.");

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const headers = lines[0];
  const chunkSize = 50;
  const docs: Document[] = [];

  for (let i = 1; i < lines.length; i += chunkSize) {
    const content = [headers, ...lines.slice(i, i + chunkSize)].join("\n");
    const chunkIndex = Math.floor((i - 1) / chunkSize);
    docs.push(
      new Document({
        pageContent: content,
        metadata: {
          fileName, pageNumber: chunkIndex + 1, chunkIndex,
          uploadedAt: new Date().toISOString(), source: fileName,
        } as DocumentMetadata,
      })
    );
  }

  return docs.length > 0 ? docs : [
    new Document({
      pageContent: text,
      metadata: {
        fileName, pageNumber: 1, chunkIndex: 0,
        uploadedAt: new Date().toISOString(), source: fileName,
      } as DocumentMetadata,
    }),
  ];
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function loadDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<Document[]> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || mimeType === "application/pdf") return loadPDF(buffer, fileName);
  if (ext === "txt" || mimeType === "text/plain" || mimeType.startsWith("text/")) return loadTXT(buffer, fileName);
  if (ext === "csv" || mimeType === "text/csv") return loadCSV(buffer, fileName);

  throw new Error(`Unsupported file type: .${ext}. Please upload PDF, TXT, or CSV.`);
}
