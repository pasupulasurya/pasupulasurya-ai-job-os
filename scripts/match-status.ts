import { prisma } from "../src/server/lib/prisma";

async function main() {
  const userId = "usr_98b04a8e6a854a0bb7ce8e04b4357922";
  const rows = await prisma.userJobMatch.groupBy({
    by: ["status", "dismissed"],
    where: { userId },
    _count: true,
  });
  console.log("Status breakdown:");
  for (const r of rows) {
    console.log(`  status=${r.status} dismissed=${r.dismissed} → ${r._count}`);
  }
  const versions = await prisma.userJobMatch.groupBy({
    by: ["matchVersion"],
    where: { userId },
    _count: true,
  });
  console.log("\nMatch versions:");
  for (const v of versions) {
    console.log(`  ${v.matchVersion ?? "null"} → ${v._count}`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
