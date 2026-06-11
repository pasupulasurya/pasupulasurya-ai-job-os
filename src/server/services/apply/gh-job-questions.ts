// Fetch + parse a Greenhouse job's application questions from the
// public Job Board API (?questions=true). Boundary-validated: strict
// on fields we use, permissive elsewhere (Phase 2C.6 pattern).
import { z } from "zod";
import { logger } from "@/server/lib/logger";
import type { GHQuestion } from "@/apply/gh-questions";

const FieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  values: z.array(z.object({ label: z.string() }).loose()).catch([]),
});
const QuestionSchema = z.object({
  label: z.string(),
  required: z.boolean().catch(false),
  fields: z.array(FieldSchema),
});
const DemographicAnswerSchema = z.object({
  label: z.string(),
  decline_to_answer: z.boolean().catch(false),
});
const DemographicQuestionSchema = z.object({
  id: z.number(),
  label: z.string(),
  required: z.boolean().catch(false),
  type: z.string(),
  answer_options: z.array(DemographicAnswerSchema).catch([]),
});
const ResponseSchema = z.object({
  questions: z.array(z.unknown()).catch([]),
  demographic_questions: z
    .object({ questions: z.array(z.unknown()).catch([]) })
    .nullable()
    .catch(null),
});

function mapType(apiType: string): GHQuestion["type"] {
  if (apiType === "input_text") return "input_text";
  if (apiType === "textarea") return "textarea";
  if (apiType === "input_file") return "input_file";
  if (apiType === "multi_value_single_select") return "single_select";
  if (apiType === "multi_value_multi_select") return "multi_select";
  return "other";
}

export async function fetchGHQuestions(
  boardToken: string,
  externalId: string,
): Promise<GHQuestion[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${externalId}?questions=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GH questions fetch failed: ${res.status}`);
  const body = ResponseSchema.parse(await res.json());

  const out: GHQuestion[] = [];
  let skipped = 0;

  for (const raw of body.questions) {
    const parsed = QuestionSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    // One question can aggregate fields (resume = input_file + textarea);
    // take the primary (first) field for targeting.
    const f = parsed.data.fields[0];
    if (!f) {
      skipped += 1;
      continue;
    }
    out.push({
      fieldName: f.name,
      label: parsed.data.label,
      required: parsed.data.required,
      type: mapType(f.type),
      options: f.values.map((v) => ({ label: v.label })),
    });
  }

  for (const raw of body.demographic_questions?.questions ?? []) {
    const parsed = DemographicQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    out.push({
      // Demographic field name in the DOM is the bare numeric id.
      fieldName: String(parsed.data.id),
      label: parsed.data.label,
      required: parsed.data.required,
      type: mapType(parsed.data.type),
      options: parsed.data.answer_options.map((o) => ({
        label: o.label,
        decline: o.decline_to_answer,
      })),
    });
  }

  logger.info(
    { boardToken, externalId, questions: out.length, skipped },
    "apply.gh_questions.fetched",
  );
  return out;
}
