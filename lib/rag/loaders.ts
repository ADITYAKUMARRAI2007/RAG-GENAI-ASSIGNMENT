import { Document } from "@langchain/core/documents";
import type { DocumentMetadata } from "./types";

// ─── PDF: text extraction via pdf-parse ──────────────────────────────────────

async function extractTextWithPdfParse(
  buffer: Buffer
): Promise<{ text: string; numpages: number } | null> {
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);
    if (data.text && data.text.trim().length > 0) {
      return { text: data.text, numpages: data.numpages };
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── PDF: text extraction via pdfjs-dist (handles more formats) ──────────────

async function loadPdfjsLib(): Promise<any> {
  try {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch {
    return await import("pdfjs-dist");
  }
}

async function extractTextWithPdfjs(
  buffer: Buffer
): Promise<{ text: string; numpages: number } | null> {
  try {
    const pdfjsLib = await loadPdfjsLib();

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
      .promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item: any) => "str" in item)
        .map((item: any) => item.str)
        .join(" ");
      if (text.trim()) pages.push(text.trim());
    }

    if (pages.length > 0 && pages.join("").length > 30) {
      return { text: pages.join("\f"), numpages: doc.numPages };
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── PDF: render pages to images with pdfjs + @napi-rs/canvas ────────────────

async function renderPdfToImages(
  buffer: Buffer
): Promise<Array<{ page: number; b64: string }>> {
  const pdfjsLib = await loadPdfjsLib();
  const { createCanvas } = require("@napi-rs/canvas");

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    .promise;
  const pages: Array<{ page: number; b64: string }> = [];
  const SCALE = 1.5;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(
      Math.floor(viewport.width),
      Math.floor(viewport.height)
    );
    const ctx = canvas.getContext("2d");

    const canvasFactory = {
      create(w: number, h: number) {
        const c = createCanvas(w, h);
        return { canvas: c, context: c.getContext("2d") };
      },
      reset(pair: any, w: number, h: number) {
        pair.canvas.width = w;
        pair.canvas.height = h;
      },
      destroy() {},
    };

    await page.render({ canvasContext: ctx, viewport, canvasFactory }).promise;
    const pngBuf: Buffer = canvas.toBuffer("image/png");
    pages.push({ page: i, b64: pngBuf.toString("base64") });
  }

  return pages;
}

// ─── OCR via OpenRouter / OpenAI Vision ──────────────────────────────────────

async function ocrPageWithVision(b64: string, pageNum: number): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const apiKey =
    openrouterKey && !openrouterKey.startsWith("your_")
      ? openrouterKey
      : openaiKey && !openaiKey.startsWith("your_")
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
              text: `You are a precise OCR engine. Extract ALL text from this document image exactly as it appears. Preserve tables, headings, bullet points, and structure. Output only the extracted text — no commentary, no markdown fences. This is page ${pageNum} of the document.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${b64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Vision API error ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── PDF Loader ──────────────────────────────────────────────────────────────

export async function loadPDF(
  buffer: Buffer,
  fileName: string
): Promise<Document[]> {
  // Step 1: fast text extraction
  const textResult =
    (await extractTextWithPdfParse(buffer)) ??
    (await extractTextWithPdfjs(buffer));

  if (textResult) {
    const fullText = textResult.text.trim();
    if (!fullText) throw new Error("PDF has no extractable text.");

    const rawPages = fullText
      .split("\f")
      .map((p: string) => p.trim())
      .filter(Boolean);
    const pages = rawPages.length > 0 ? rawPages : [fullText];

    return pages.map(
      (pageText: string, index: number) =>
        new Document({
          pageContent: pageText,
          metadata: {
            fileName,
            pageNumber: index + 1,
            chunkIndex: index,
            uploadedAt: new Date().toISOString(),
            source: fileName,
          } as DocumentMetadata,
        })
    );
  }

  // Step 2: scanned PDF — render to images then OCR
  console.log(`[Loader] No text found — rendering pages to images for OCR...`);

  let imagePages: Array<{ page: number; b64: string }>;
  try {
    imagePages = await renderPdfToImages(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF image rendering failed: ${msg}`);
  }

  if (imagePages.length === 0) {
    throw new Error("Could not extract text or render any pages from the PDF.");
  }

  console.log(
    `[Loader] Scanned PDF — running OCR on ${imagePages.length} page(s) via vision model...`
  );

  const docs: Document[] = [];
  for (const { page, b64 } of imagePages) {
    console.log(`[Loader] OCR page ${page}/${imagePages.length}...`);
    try {
      const text = await ocrPageWithVision(b64, page);
      if (text.trim()) {
        docs.push(
          new Document({
            pageContent: text.trim(),
            metadata: {
              fileName,
              pageNumber: page,
              chunkIndex: page - 1,
              uploadedAt: new Date().toISOString(),
              source: fileName,
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
    throw new Error(
      "OCR could not extract any text from the scanned PDF pages."
    );
  }

  console.log(
    `[Loader] OCR complete — extracted text from ${docs.length} page(s).`
  );
  return docs;
}

// ─── TXT Loader ──────────────────────────────────────────────────────────────

export async function loadTXT(
  buffer: Buffer,
  fileName: string
): Promise<Document[]> {
  const text = buffer.toString("utf-8").trim();
  if (!text) throw new Error("Text file appears to be empty.");

  return [
    new Document({
      pageContent: text,
      metadata: {
        fileName,
        pageNumber: 1,
        chunkIndex: 0,
        uploadedAt: new Date().toISOString(),
        source: fileName,
      } as DocumentMetadata,
    }),
  ];
}

// ─── CSV Loader ──────────────────────────────────────────────────────────────

export async function loadCSV(
  buffer: Buffer,
  fileName: string
): Promise<Document[]> {
  let raw = buffer.toString("utf-8");
  // Strip BOM if present
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const text = raw.trim();
  if (!text) throw new Error("CSV file appears to be empty.");

  // Normalize line endings and split
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) throw new Error("CSV file has no readable rows.");

  const headers = lines[0];
  const dataLines = lines.slice(1);

  // If the file has only headers or is very small, return as a single doc
  if (dataLines.length === 0) {
    return [
      new Document({
        pageContent: text,
        metadata: {
          fileName,
          pageNumber: 1,
          chunkIndex: 0,
          uploadedAt: new Date().toISOString(),
          source: fileName,
        } as DocumentMetadata,
      }),
    ];
  }

  // Chunk rows with headers prepended to each chunk for context
  const chunkSize = 40;
  const docs: Document[] = [];

  for (let i = 0; i < dataLines.length; i += chunkSize) {
    const rows = dataLines.slice(i, i + chunkSize);
    const content = [headers, ...rows].join("\n");
    const chunkIndex = Math.floor(i / chunkSize);
    docs.push(
      new Document({
        pageContent: content,
        metadata: {
          fileName,
          pageNumber: chunkIndex + 1,
          chunkIndex,
          totalRows: dataLines.length,
          uploadedAt: new Date().toISOString(),
          source: fileName,
        } as DocumentMetadata & { totalRows: number },
      })
    );
  }

  return docs;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function loadDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<Document[]> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || mimeType === "application/pdf")
    return loadPDF(buffer, fileName);
  if (
    ext === "txt" ||
    mimeType === "text/plain" ||
    mimeType.startsWith("text/")
  )
    return loadTXT(buffer, fileName);
  if (ext === "csv" || mimeType === "text/csv")
    return loadCSV(buffer, fileName);

  throw new Error(
    `Unsupported file type: .${ext}. Please upload PDF, TXT, or CSV.`
  );
}
