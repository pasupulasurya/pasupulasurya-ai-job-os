/**
 * One-time backfill: canonicalize legacy Greenhouse URLs.
 * boards.greenhouse.io -> job-boards.greenhouse.io (301 alias, path identical).
 * Idempotent: re-running finds zero rows. Per-row safe; malformed URLs skipped.
 *
 * Dry run (default):  npx tsx --env-file=.env.local scripts/canonicalize-gh-urls.ts
 * Apply:              npx tsx --env-file=.env.local scripts/canonicalize-gh-urls.ts --apply
 */
import { prisma } from "../src/server/lib/prisma";

const LEGACY = "boards.greenhouse.io";
const CANONICAL = "job-boards.greenhouse.io";
const APPLY = process.argv.includes("--apply");

function canonicalize(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.host !== LEGACY) return null;
    u.host = CANONICAL;
    return u.toString();
  } catch {
    return null;
  }
}

async function main() {
  const rows = await prisma.job.findMany({
    where: { sourceUrl: { startsWith: `https://${LEGACY}/` } },
    select: { id: true, sourceUrl: true },
  });
  console.log(`Found ${rows.length} legacy-host rows. Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const next = canonicalize(row.sourceUrl);
    if (!next) {
      skipped += 1;
      console.warn(`SKIP (unparseable/host-mismatch): ${row.id} ${row.sourceUrl}`);
      continue;
    }
    if (!APPLY) {
      console.log(`WOULD UPDATE ${row.id}: ${row.sourceUrl} -> ${next}`);
      updated += 1;
      continue;
    }
    try {
      await prisma.job.update({ where: { id: row.id }, data: { sourceUrl: next } });
      updated += 1;
    } catch (err) {
      skipped += 1;
      console.error(`FAILED ${row.id}: ${(err as Error).message}`);
    }
  }

  console.log(`Done. ${APPLY ? "Updated" : "Would update"}: ${updated}, skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
