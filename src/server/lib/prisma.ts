import "server-only";
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Match Prisma v6 timeout behavior to avoid hanging queries on Supabase
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
