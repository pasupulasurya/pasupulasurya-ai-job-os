// 2H.0 apply lab — Surya-only Playwright harness for the fill engine.
// Fills, highlights, PAUSES. NEVER submits. Run:
//   npm run apply:lab -- --matchId=<id>
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../src/server/lib/prisma";
import type { ApplicantProfile } from "../src/apply/types";
import { decideAnswers, type GHAnswerProfile } from "../src/apply/gh-questions";
import { fetchGHQuestions } from "../src/server/services/apply/gh-job-questions";

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
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          applyProfile: true,
        },
      },
      master: { select: { parsedJson: true } },
      job: {
        select: {
          title: true,
          company: true,
          sourceUrl: true,
          source: true,
          companySlug: true,
          externalId: true,
        },
      },
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

  // Phase 3: GH question semantics from the public API -> select fills.
  const phase3Handled: string[] = [];
  if (row.job.source === "greenhouse" && row.job.companySlug && row.job.externalId) {
    const ap = row.user.applyProfile;
    const ghProfile: GHAnswerProfile = {
      workAuthorizedUS: ap?.workAuthorizedUS ?? null,
      requiresSponsorship: ap?.requiresSponsorship ?? null,
      previouslyEmployed: ap?.previouslyEmployed ?? null,
      gender: ap?.gender ?? null,
      hispanicLatino: ap?.hispanicLatino ?? null,
      raceEthnicity: ap?.raceEthnicity ?? null,
      veteranStatus: ap?.veteranStatus ?? null,
      disabilityStatus: ap?.disabilityStatus ?? null,
      linkedinUrl: ap?.linkedinUrl ?? null,
      githubUrl: ap?.githubUrl ?? null,
      portfolioUrl: ap?.portfolioUrl ?? null,
      location: null,
    };
    const questions = await fetchGHQuestions(row.job.companySlug, row.job.externalId);
    const decisions = decideAnswers(questions, ghProfile);
    console.log(`\n── GH question decisions (${questions.length} questions) ──`);
    for (const d of decisions) {
      if (d.kind === "defer")
        console.log(`  defer [${d.fieldName}] ${d.label.slice(0, 60)} — ${d.reason}`);
    }
    // Phase-3 text fills (links etc.) — decided by the API layer.
    for (const d of decisions) {
      if (d.kind !== "fill") continue;
      try {
        const input = page.locator(`[id="${d.fieldName}"]`).first();
        await input.fill(d.value);
        console.log(`  filled [${d.fieldName}] (from ${d.sourceKey})`);
        phase3Handled.push(d.fieldName);
      } catch {
        console.log(`  fill FAILED [${d.fieldName}] — left for you`);
      }
    }
    const sel = await executeSelects(page, decisions);
    phase3Handled.push(...sel.handledIds);
    phase3Handled.push(
      ...(await fillEducation(page, {
        schoolName: ap?.schoolName ?? null,
        degreeLevel: ap?.degreeLevel ?? null,
      })),
    );
    const parsedLoc =
      (row.master.parsedJson as { location?: string | null } | null)?.location ?? null;
    phase3Handled.push(
      ...(await fillCountryAndLocation(page, {
        countryCode: row.user.country,
        locationText: parsedLoc,
      })),
    );
    console.log(`Selected: ${sel.selected}`);
    for (const f of sel.failed) console.log(`  FAILED ${f}`);
  }

  // ── Final summary (after ALL phases, so the defer list is honest) ──
  const handledIds = new Set<string>();
  for (const id of phase3Handled) handledIds.add(id);
  const stillDeferred = summary.deferred.filter((d: { label: string }) => !handledIds.has(d.label));
  console.log("\n── Final summary ──");
  console.log(`Fields detected: ${summary.fieldCount}`);
  console.log(`Filled by engine: ${summary.filled}`);
  console.log(`Skipped (portal prefilled): ${summary.skippedPrefilled}`);
  console.log(`Still deferred to you (amber outline): ${stillDeferred.length}`);
  for (const d of stillDeferred) console.log(`  - [${d.label}] ${d.reason}`);

  console.log("\nReview the form. This script NEVER submits. Ctrl+C when done.");
  await new Promise(() => undefined); // pause forever
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());

/** Execute select decisions via trusted Playwright input. react-select
 *  ignores synthetic clicks, so this lives in the harness, not the
 *  injected engine. Targets the combobox inside the container that
 *  holds the hidden input whose id === fieldName. */
async function executeSelects(
  page: import("playwright").Page,
  decisions: ReturnType<typeof decideAnswers>,
): Promise<{ selected: number; failed: string[]; handledIds: string[] }> {
  let selected = 0;
  const failed: string[] = [];
  const handledIds: string[] = [];
  for (const d of decisions) {
    if (d.kind !== "select") continue;
    try {
      const hidden = page.locator(`[id="${d.fieldName}"]`).first();
      const container = hidden.locator(
        "xpath=ancestor::*[contains(@class,'select')][1]/ancestor::div[1]",
      );
      const combo = container.locator('input[role="combobox"]').first();
      await combo.click();
      await combo.fill(d.optionLabel.slice(0, 30));
      await page.waitForTimeout(400);
      const option = page.getByRole("option", { name: d.optionLabel, exact: true }).first();
      await option.click({ timeout: 3000 });
      selected += 1;
      handledIds.push(d.fieldName);
      console.log(`  selected [${d.fieldName}] = "${d.optionLabel}" (from ${d.sourceKey})`);
    } catch {
      failed.push(`${d.fieldName}: "${d.optionLabel}" — option click failed, left for you`);
    }
    await page.waitForTimeout(300);
  }
  return { selected, failed, handledIds };
}

const DEGREE_LABEL: Record<string, string> = {
  high_school: "High School",
  associate: "Associate's Degree",
  bachelors: "Bachelor's Degree",
  masters: "Master's Degree",
  doctorate: "Doctorate",
};

/** Fill GH education typeaheads from stored truth. School is a
 *  typeahead against GH's database: type stored name, click only an
 *  option whose text matches exactly (case-insensitive) — otherwise
 *  leave deferred. Degree is a fixed list via the label table. */
async function fillEducation(
  page: import("playwright").Page,
  ap: { schoolName: string | null; degreeLevel: string | null },
): Promise<string[]> {
  const handledIds: string[] = [];
  const targets: { id: string; text: string | null; exactOnly: boolean }[] = [
    { id: "school--0", text: ap.schoolName, exactOnly: true },
    {
      id: "degree--0",
      text: ap.degreeLevel ? (DEGREE_LABEL[ap.degreeLevel] ?? null) : null,
      exactOnly: false,
    },
  ];
  for (const t of targets) {
    if (!t.text) {
      console.log(`  education [${t.id}]: no stored answer — left for you`);
      continue;
    }
    try {
      const input = page.locator(`[id="${t.id}"]`).first();
      await input.click();
      await input.fill(t.text);
      await page.waitForTimeout(900); // typeahead debounce
      const option = t.exactOnly
        ? page.getByRole("option", { name: t.text, exact: true }).first()
        : page.getByRole("option", { name: t.text }).first();
      await option.click({ timeout: 3000 });
      console.log(`  education [${t.id}] = "${t.text}"`);
      handledIds.push(t.id);
    } catch {
      console.log(`  education [${t.id}]: no exact match for "${t.text}" — left for you`);
    }
    await page.waitForTimeout(300);
  }
  return handledIds;
}

/** Fill the country + candidate-location react-select comboboxes.
 *  Country: exact-match "United States" when User.country === "US".
 *  Location: type parsedJson location; click only an option that
 *  STARTS WITH the typed city (geocoders append region/country). */
async function fillCountryAndLocation(
  page: import("playwright").Page,
  input: { countryCode: string | null; locationText: string | null },
): Promise<string[]> {
  const handledIds: string[] = [];
  if (input.countryCode === "US") {
    try {
      const combo = page.locator("#country");
      await combo.click();
      await combo.fill("United States");
      await page.waitForTimeout(600);
      // Options render as "United States +1" — anchor name + dial code
      // so "United States Minor Outlying Islands" cannot match.
      await page
        .getByRole("option", { name: /^United States\s*\+1/ })
        .first()
        .click({ timeout: 3000 });
      handledIds.push("country");
      console.log('  filled [country] = "United States"');
    } catch {
      console.log("  country: option click failed — left for you");
    }
  }
  if (input.locationText) {
    const city = input.locationText.split(",")[0].trim();
    try {
      const combo = page.locator("#candidate-location");
      await combo.click();
      await combo.fill(city);
      await page.waitForTimeout(1200); // geocoder debounce
      const option = page.getByRole("option", { name: new RegExp(`^${city}\\b`, "i") }).first();
      await option.click({ timeout: 3000 });
      handledIds.push("candidate-location");
      console.log(`  filled [candidate-location] starting "${city}"`);
    } catch {
      console.log(`  location: no option starting "${city}" — left for you`);
    }
  }
  return handledIds;
}
