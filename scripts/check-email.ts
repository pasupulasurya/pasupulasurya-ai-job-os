import { prisma } from "../src/server/lib/prisma";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log("usage: tsx scripts/check-email.ts <email>");
    process.exit(1);
  }
  const u = await prisma.user.findFirst({ where: { email } });
  console.log(u ? `EXISTS: ${email}` : `FREE: ${email}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
