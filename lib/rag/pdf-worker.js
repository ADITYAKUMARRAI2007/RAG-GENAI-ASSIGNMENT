/**
 * PDF Worker — runs as a child process outside webpack.
 *
 * Reads PDF buffer from stdin.
 * 1. Tries text extraction with pdf-parse.
 * 2. Falls back to pdfjs-dist for richer text extraction.
 * 3. If still no text (scanned PDF), renders pages to PNG via
 *    pdfjs-dist + @napi-rs/canvas (pure-JS, no system binaries).
 *
 * Output JSON:
 *   { type: "text", text: "...", numpages: N }
 *   { type: "images", pages: [ { page: 1, b64: "..." }, ... ] }
 *   { error: "..." }
 */

const path = require("path");

process.stdin.resume();
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));

process.stdin.on("end", async () => {
  try {
    const buffer = Buffer.concat(chunks);

    // ── Step 1: Try pdf-parse (fast, handles most text PDFs) ──────────────
    let textResult = null;
    try {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 0) {
        textResult = { type: "text", text: data.text, numpages: data.numpages };
      }
    } catch (_) {
      // ignore — fall through
    }

    if (textResult) {
      process.stdout.write(JSON.stringify(textResult));
      return;
    }

    // ── Step 2: Try pdfjs-dist text extraction (handles more formats) ─────
    let pdfjsLib;
    try {
      pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
    } catch (_) {
      try {
        pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
      } catch (_2) {
        pdfjsLib = require("pdfjs-dist");
      }
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;

    const extractedPages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => "str" in item)
        .map((item) => item.str)
        .join(" ");
      if (text.trim()) extractedPages.push(text.trim());
    }

    if (extractedPages.length > 0 && extractedPages.join("").length > 30) {
      process.stdout.write(
        JSON.stringify({
          type: "text",
          text: extractedPages.join("\f"),
          numpages: doc.numPages,
        })
      );
      return;
    }

    // ── Step 3: Scanned PDF — render pages to PNG with canvas ─────────────
    const { createCanvas } = require("@napi-rs/canvas");

    const DPI_SCALE = 1.5;
    const pages = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: DPI_SCALE });

      const canvas = createCanvas(
        Math.floor(viewport.width),
        Math.floor(viewport.height)
      );
      const ctx = canvas.getContext("2d");

      const canvasFactory = {
        create(w, h) {
          const c = createCanvas(w, h);
          return { canvas: c, context: c.getContext("2d") };
        },
        reset(pair, w, h) {
          pair.canvas.width = w;
          pair.canvas.height = h;
        },
        destroy() {},
      };

      await page.render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
      }).promise;

      const pngBuf = canvas.toBuffer("image/png");
      pages.push({ page: i, b64: pngBuf.toString("base64") });
    }

    if (pages.length === 0) {
      throw new Error("Could not extract text or render any pages from the PDF.");
    }

    process.stdout.write(JSON.stringify({ type: "images", pages }));
  } catch (err) {
    process.stdout.write(
      JSON.stringify({ error: err.message || String(err) })
    );
  }
});
