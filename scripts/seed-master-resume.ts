#!/usr/bin/env tsx
/**
 * One-off seed: parse a PDF and insert as the user's master ResumeVersion.
 *
 * Usage:
 *   npm run seed:resume -- --user=<id> --file=<path>
 *
 * Same parsing + master-switch semantics as uploadMasterResumeAction, but
 * invokable from CLI for development. Idempotent: re-running with the same
 * user flips the previous master to isMaster=false and inserts a new master.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { prisma } from "../src/server/lib/prisma";
import { parseResume, RESUME_PARSE_VERSION } from "../src/server/services/ai/parse-resume";

function parseArgs(argv: string[]): { userId: string; file: string } {
  let userId: string | undefined;
  let file: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--user=")) userId = arg.slice("--user=".length);
    else if (arg.startsWith("--file=")) file = arg.slice("--file=".length);
  }
  if (!userId || !file) {
    console.error("Usage: npm run seed:resume -- --user=<id> --file=<path>");
    process.exit(1);
  }
  return { userId, file };
}

async function main() {
  const { userId, file } = parseArgs(process.argv.slice(2));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  const buffer = await readFile(file);
  const ext = extname(file).toLowerCase();
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
    console.error(`Unsupported extension: ${ext}`);
    process.exit(1);
  }

  console.log(`→ Extracted ${rawText.length} chars from ${file}`);
  console.log(`→ Parsing via LLM...`);
  const parsed = await parseResume(rawText);

  console.log(`→ Inserting as master resume for user ${userId}`);
  const result = await prisma.$transaction(async (tx) => {
    const previousMaster = await tx.resumeVersion.findFirst({
      where: { userId, isMaster: true },
      select: { id: true },
    });
    if (previousMaster) {
      await tx.resumeVersion.update({
        where: { id: previousMaster.id },
        data: { isMaster: false },
      });
    }
    const created = await tx.resumeVersion.create({
      data: {
        userId,
        isMaster: true,
        contentJson: { rawText },
        parsedJson: parsed,
        parsedAt: new Date(),
        parseVersion: RESUME_PARSE_VERSION,
        fileName: file.split("/").pop() ?? null,
        fileSize: buffer.length,
      },
      select: { id: true },
    });
    return { previousMasterId: previousMaster?.id ?? null, newId: created.id };
  });

  console.log(`\nDone.`);
  console.log(`  previous master: ${result.previousMasterId ?? "(none)"}`);
  console.log(`  new master:      ${result.newId}`);
  console.log(`  fullName:        ${parsed.fullName}`);
  console.log(`  currentRole:     ${parsed.currentRole} @ ${parsed.currentCompany}`);
  console.log(`  skills:          ${parsed.skills.length}`);
  console.log(`  workHistory:     ${parsed.workHistory.length} roles`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
