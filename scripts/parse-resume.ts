#!/usr/bin/env tsx
/**
 * CLI smoke test for the resume parser.
 *
 * Usage:
 *   npm run parse:resume -- path/to/resume.pdf
 *   npm run parse:resume -- path/to/resume.txt
 *
 * Reads the file, extracts text, calls parseResume(), prints the structured
 * output. No DB writes. Useful for prompt-iteration and debugging the parser
 * in isolation from the upload Server Action.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseResume } from "../src/server/services/ai/parse-resume";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run parse:resume -- <path-to-pdf-or-txt>");
    process.exit(1);
  }

  const buffer = await readFile(path);
  const ext = extname(path).toLowerCase();

  let rawText: string;
  if (ext === ".txt") {
    rawText = buffer.toString("utf8");
  } else if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      rawText = result.text;
    } finally {
      await parser.destroy();
    }
  } else {
    console.error(`Unsupported extension: ${ext}. Use .pdf or .txt`);
    process.exit(1);
  }

  console.log(`→ Extracted ${rawText.length} chars from ${path}`);
  console.log(`→ Calling parser...\n`);

  const parsed = await parseResume(rawText);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
