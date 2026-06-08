import { prisma } from "../src/server/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true },
  });
  console.log(users);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
