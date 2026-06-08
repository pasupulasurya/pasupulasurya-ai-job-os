import { prisma } from "../src/server/lib/prisma";

// The six null/test users to remove. Real account (usr_98b04a8e...) is NOT here.
const TARGETS = [
  "usr_1f0e80c7a7934a85832d66b2e10b8244",
  "usr_5b54df7c6a934fe4a90995a2bb3f2144",
  "usr_a2de5b0fa55b48d68523b78d7af6d616",
  "usr_88e49cac49b349f6a2cc0bcdcdd852fa",
  "usr_f177c8a8ca654bbbb93a6247de63d754",
  "usr_484765d487454a119702681134db0b10",
];

async function main() {
  // Safety: refuse to run if the real account id is somehow in the list.
  const KEEP = "usr_98b04a8e6a854a0bb7ce8e04b4357922";
  if (TARGETS.includes(KEEP)) {
    console.error("ABORT: real account id is in the delete list");
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    const where = { userId: { in: TARGETS } };
    const matches = await tx.userJobMatch.deleteMany({ where });
    const apps = await tx.application.deleteMany({ where });
    const resumes = await tx.resumeVersion.deleteMany({ where });
    const blocked = await tx.userBlockedCompany.deleteMany({ where });
    const prefs = await tx.userPreference.deleteMany({ where });
    const users = await tx.user.deleteMany({ where: { id: { in: TARGETS } } });
    return { matches, apps, resumes, blocked, prefs, users };
  });

  console.log("Deleted:");
  console.log(
    `  matches=${result.matches.count} apps=${result.apps.count} resumes=${result.resumes.count}`,
  );
  console.log(
    `  blocked=${result.blocked.count} prefs=${result.prefs.count} users=${result.users.count}`,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
