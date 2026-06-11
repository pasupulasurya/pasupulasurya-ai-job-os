// 2H.0 apply lab — Surya-only Playwright harness for the fill engine.
// Fills, highlights, PAUSES. NEVER submits. Run:
//   npm run apply:lab -- --matchId=<id>
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/server/lib/prisma";
import type { ApplicantProfile } from "../src/apply/types";

function getArg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
}

type ParsedLinks = {
  links?: { linkedin?: string | null; github?: string | null; website?: string | null } | null;
};

async function loadTarget(matchId: string) {
  const row = await prisma.tailoredResume.findUnique({
    where: { matchId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      master: { select: { parsedJson: true } },
      job: { select: { title: true, company: true, sourceUrl: true, source: true } },
    },
  });
  if (!row) throw new Error(`No TailoredResume for matchId=${matchId}`);
  if (!["generated", "verified", "saved"].includes(row.status)) {
    throw new Error(`TailoredResume status is "${row.status}" — not renderable`);
  }
  return row;
}

function buildProfile(
  user: { firstName: string | null; lastName: string | null; email: string; phone: string | null },
  parsed: ParsedLinks & { location?: string | null },
): ApplicantProfile {
  const values: ApplicantProfile["values"] = {};
  if (user.firstName) values.firstName = user.firstName;
  if (user.lastName) values.lastName = user.lastName;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  if (full) values.fullName = full;
  values.email = user.email;
  if (user.phone) values.phone = user.phone;
  if (parsed.location) values.location = parsed.location;
  if (parsed.links?.linkedin) values.linkedin = parsed.links.linkedin;
  if (parsed.links?.github) values.github = parsed.links.github;
  if (parsed.links?.website) values.website = parsed.links.website;
  return { values };
}

async function renderPdfToTmp(row: Awaited<ReturnType<typeof loadTarget>>): Promise<string> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { ResumeDocument, pdfSafe, assembleResumePdfData } =
    await import("../src/server/pdf/resume-document");
  const { createElement } = await import("react");
  const data = assembleResumePdfData({
    user: row.user,
    parsed: (row.master.parsedJson ?? {}) as Record<string, never>,
    tailored: row.tailoredJson as never,
  });
  const safe = JSON.parse(
    JSON.stringify(data, (_k, v) => (typeof v === "string" ? pdfSafe(v) : v)),
  ) as typeof data;
  const element = createElement(ResumeDocument, { data: safe });
  // Same element shape the route renders via JSX; createElement just types
  // it by component props instead of DocumentProps. Runtime-identical.
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  const path = join(mkdtempSync(join(tmpdir(), "apply-lab-")), "tailored.pdf");
  writeFileSync(path, buffer);
  return path;
}

/** Bundle src/apply/* into one browser-injectable IIFE exposing window.__applyEngine. */
async function bundleEngine(): Promise<string> {
  const esbuild = await import("esbuild");
  const entry = `
    import { detectFields } from "./src/apply/detect-fields";
    import { buildFillPlan } from "./src/apply/fill-plan";
    import { executeFillPlan } from "./src/apply/execute-fill";
    (window as never as Record<string, unknown>).__applyEngine = {
      detectFields, buildFillPlan, executeFillPlan,
    };
  `;
  const result = await esbuild.build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
  });
  return result.outputFiles[0].text;
}

async function main() {
  const matchId = getArg("matchId");
  if (!matchId) throw new Error("Usage: npm run apply:lab -- --matchId=<id>");
  const row = await loadTarget(matchId);
  console.log(`Target: ${row.job.title} @ ${row.job.company} (${row.job.source})`);
  console.log(`URL: ${row.job.sourceUrl}`);
  const profile = buildProfile(row.user, (row.master.parsedJson ?? {}) as ParsedLinks);
  const pdfPath = await renderPdfToTmp(row);
  console.log(`Tailored PDF rendered: ${pdfPath}`);
  const engineJs = await bundleEngine();

  const { chromium } = await import("playwright");
  const context = await chromium.launchPersistentContext(".apply-lab-profile", {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(row.job.sourceUrl, { waitUntil: "domcontentloaded" });
  console.log("Page loaded. Waiting 3s for client-side form render...");
  await page.waitForTimeout(3000);

  await page.addScriptTag({ content: engineJs });

  // Phase 1: resume-upload-first. Find resume file inputs via the engine.
  const fileRefs = await page.evaluate(() => {
    const eng = window.__applyEngine;
    const fields = eng.detectFields();
    return fields
      .filter(
        (f: { kind: string; label: string; name: string; id: string }) =>
          f.kind === "file" && /resume|résumé|\bcv\b/i.test(`${f.label} ${f.name} ${f.id}`),
      )
      .map((f: { ref: number }) => f.ref);
  });
  if (fileRefs.length > 0) {
    const inputs = await page.$$("input[type=file]");
    if (inputs[0]) {
      await inputs[0].setInputFiles(pdfPath);
      console.log("Resume uploaded. Waiting 8s for portal autofill...");
      await page.waitForTimeout(8000);
    }
  } else {
    console.log("No resume file input detected — continuing to direct fill.");
  }

  // Phase 2: re-scan (autofill changed values), plan, execute.
  const summary = await page.evaluate((prof) => {
    const eng = window.__applyEngine;
    const fields = eng.detectFields();
    const plan = eng.buildFillPlan(fields, prof);
    const result = eng.executeFillPlan(plan);
    return { fieldCount: fields.length, ...result };
  }, profile);

  console.log("\n── Fill summary ──");
  console.log(`Fields detected: ${summary.fieldCount}`);
  console.log(`Filled by engine: ${summary.filled}`);
  console.log(`Skipped (portal prefilled): ${summary.skippedPrefilled}`);
  console.log(`Deferred to you (amber outline): ${summary.deferred.length}`);
  for (const d of summary.deferred) console.log(`  - [${d.label}] ${d.reason}`);
  console.log("\nReview the form. This script NEVER submits. Ctrl+C when done.");
  await new Promise(() => undefined); // pause forever
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
