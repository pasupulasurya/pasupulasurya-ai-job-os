// scripts/test-groq.ts — one-shot smoke test for GroqProvider
import { z } from "zod";
import { getLLMProvider } from "../src/server/services/ai/llm";

const Schema = z.object({
  seniority: z.enum(["entry", "mid", "senior", "staff"]).nullable(),
  experienceYears: z.number().int().min(0).max(40).nullable(),
});

async function main() {
  const llm = await getLLMProvider();
  console.log("provider:", llm.name, "model:", llm.model);
  const out = await llm.generate({
    system: "You extract structured data from job postings. Return ONLY a JSON object.",
    user: "Job: Senior Backend Engineer. Requires 5+ years of experience. Return JSON: { seniority: 'entry'|'mid'|'senior'|'staff'|null, experienceYears: number|null }",
    schema: Schema,
  });
  console.log("result:", out);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
