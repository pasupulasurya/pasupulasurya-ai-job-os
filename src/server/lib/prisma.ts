import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Singleton Prisma client.
 *
 * Used by:
 *   - Server Components & Server Actions (via @/server/lib/prisma)
 *   - API routes
 *   - CLI scripts (npx tsx scripts/...)
 *
 * Note: this file does NOT import "server-only". The Prisma client is a
 * pure DB connector and is safe to import from any server-side context,
 * including standalone Node scripts.
 *
 * The actual "must not be imported from a Client Component" guard lives
 * in files that handle HTTP sessions (e.g. supabase-server.ts).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
