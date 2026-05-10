/**
 * Quick test: node test-pdf.js /path/to/file.pdf
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node test-pdf.js /path/to/file.pdf");
  process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const workerPath = path.join(__dirname, "lib", "rag", "pdf-worker.js");
const child = spawn(process.execPath, [workerPath], { stdio: ["pipe", "pipe", "pipe"] });

const out = [];
const err = [];
child.stdout.on("data", (d) => out.push(d));
child.stderr.on("data", (d) => err.push(d));

child.on("close", () => {
  const raw = Buffer.concat(out).toString().trim();
  try {
    const result = JSON.parse(raw);
    if (result.error) {
      console.error("❌ Parse error:", result.error);
    } else {
      console.log("✅ Success!");
      console.log("   Pages:", result.numpages);
      console.log("   Text length:", result.text.length, "chars");
      console.log("   Preview:", result.text.slice(0, 200).replace(/\n/g, " "));
    }
  } catch {
    console.error("❌ Bad JSON output:", raw.slice(0, 300));
    console.error("   stderr:", Buffer.concat(err).toString().slice(0, 300));
  }
});

child.stdin.write(buf);
child.stdin.end();
