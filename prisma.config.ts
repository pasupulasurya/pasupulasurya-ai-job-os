import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // For Supabase: use DIRECT_URL (session pooler, port 5432) for migrations.
    // Runtime queries use DATABASE_URL (transaction pooler, port 6543) via PrismaPg adapter.
    url: env("DIRECT_URL"),
  },
});
