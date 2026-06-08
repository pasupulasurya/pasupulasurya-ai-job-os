import { prisma } from "../src/server/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true },
  });

  for (const u of users) {
    const [prefs, resumes, matches, apps] = await Promise.all([
      prisma.userPreference.count({ where: { userId: u.id } }),
      prisma.resumeVersion.count({ where: { userId: u.id } }),
      prisma.userJobMatch.count({ where: { userId: u.id } }),
      prisma.application.count({ where: { userId: u.id } }),
    ]);
    console.log(`${u.email}`);
    console.log(`  id=${u.id} name=${u.firstName ?? "null"}`);
    console.log(`  prefs=${prefs} resumes=${resumes} matches=${matches} apps=${apps}\n`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
