#!/usr/bin/env tsx
/**
 * Smoke-test the Cerebras provider end-to-end. No DB writes.
 * Run via: npm run test:cerebras
 *   or:    dotenv -e .env.local -- tsx scripts/test-cerebras-provider.ts
 */
import { z } from "zod";
import { CerebrasProvider } from "../src/server/services/ai/cerebras-provider";

const ResponseSchema = z.object({
  greeting: z.string(),
  language: z.string(),
});

async function main() {
  console.log("Instantiating CerebrasProvider...");
  const provider = new CerebrasProvider();
  console.log(`Provider: ${provider.name}, default model: ${provider.model}`);

  console.log("\nFiring test generation call...");
  const start = Date.now();
  const result = await provider.generate({
    system: "You return strict JSON matching the requested schema. No prose.",
    user: 'Return JSON: {"greeting": "<a friendly hello>", "language": "english"}',
    schema: ResponseSchema,
    maxTokens: 2048,
  });
  const elapsedMs = Date.now() - start;

  console.log(`\nSuccess in ${elapsedMs}ms`);
  console.log("Parsed result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("\nTest failed:");
  console.error(err);
  process.exit(1);
});
