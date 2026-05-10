/**
 * PDF Worker — runs as a child process outside webpack.
 *
 * Reads PDF buffer from stdin.
 * Tries text extraction first (pdf-parse).
 * If text is empty (scanned PDF), converts pages to base64 PNG images via pdftoppm
 * and returns them for OCR processing.
 *
 * Output JSON:
 *   { type: "text", text: "...", numpages: N }          — text PDF
 *   { type: "images", pages: [ { page: 1, b64: "..." }, ... ] }  — scanned PDF
 *   { error: "..." }
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.stdin.resume();
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));

process.stdin.on("end", async () => {
  try {
    const buffer = Buffer.concat(chunks);

    // ── Step 1: Try text extraction ──────────────────────────────────────
    let textResult = null;
    try {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 50) {
        textResult = { type: "text", text: data.text, numpages: data.numpages };
      }
    } catch (_) {
      // ignore — fall through to image OCR
    }

    if (textResult) {
      process.stdout.write(JSON.stringify(textResult));
      return;
    }

    // ── Step 2: Scanned PDF — convert to images via pdftoppm ─────────────
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docmind-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    fs.writeFileSync(pdfPath, buffer);

    const outPrefix = path.join(tmpDir, "page");

    // Convert all pages to PNG at 150 DPI (good quality, reasonable size)
    const result = spawnSync("pdftoppm", [
      "-png", "-r", "150", pdfPath, outPrefix
    ], { timeout: 60000 });

    if (result.status !== 0) {
      throw new Error("pdftoppm failed: " + (result.stderr?.toString() || "unknown error"));
    }

    // Collect generated PNG files
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    if (pngFiles.length === 0) {
      throw new Error("pdftoppm produced no images");
    }

    const pages = pngFiles.map((f, i) => ({
      page: i + 1,
      b64: fs.readFileSync(path.join(tmpDir, f)).toString("base64"),
    }));

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

    process.stdout.write(JSON.stringify({ type: "images", pages }));

  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message || String(err) }));
  }
});
