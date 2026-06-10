// 2H apply engine — maps detected fields to planned actions.
// PURE browser-context module. Core integrity rule: a field either
// matches a closed ProfileKey rule set, is the resume upload, or is
// deferred to the human. The engine NEVER guesses.

import type { ApplicantProfile, DetectedField, PlannedAction, ProfileKey } from "./types";

/** Order matters: first match wins. Patterns test label + name, lowercased. */
const KEY_RULES: { key: ProfileKey; pattern: RegExp }[] = [
  { key: "firstName", pattern: /first\s*name|given\s*name/ },
  { key: "lastName", pattern: /last\s*name|family\s*name|surname/ },
  { key: "fullName", pattern: /full\s*name|^name$|your\s*name/ },
  { key: "email", pattern: /e-?mail/ },
  { key: "phone", pattern: /phone|mobile|cell/ },
  { key: "location", pattern: /location|city|current\s*address/ },
  { key: "linkedin", pattern: /linked\s*in/ },
  { key: "github", pattern: /git\s*hub/ },
  { key: "website", pattern: /website|portfolio|personal\s*site/ },
];

const RESUME_PATTERN = /resume|résumé|\bcv\b/;

function matchKey(field: DetectedField): ProfileKey | null {
  const haystack = `${field.label} ${field.name} ${field.id}`.toLowerCase();
  for (const rule of KEY_RULES) {
    if (rule.pattern.test(haystack)) return rule.key;
  }
  return null;
}

/** Build a fill plan. Every action traces to a ProfileKey or is deferred. */
export function buildFillPlan(fields: DetectedField[], profile: ApplicantProfile): PlannedAction[] {
  const plan: PlannedAction[] = [];
  for (const field of fields) {
    const haystack = `${field.label} ${field.name} ${field.id}`.toLowerCase();

    if (field.kind === "file") {
      if (RESUME_PATTERN.test(haystack)) {
        plan.push({ ref: field.ref, action: "upload_resume" });
      } else {
        plan.push({
          ref: field.ref,
          action: "defer_to_human",
          reason: "file input that is not a resume (e.g. cover letter)",
        });
      }
      continue;
    }

    // Portal autofill (from resume upload) may have filled this already.
    if (field.currentValue.trim() !== "") {
      plan.push({ ref: field.ref, action: "skip_prefilled" });
      continue;
    }

    const key = matchKey(field);
    const value = key ? profile.values[key] : undefined;

    if (
      key &&
      value &&
      (field.kind === "text" ||
        field.kind === "email" ||
        field.kind === "tel" ||
        field.kind === "textarea")
    ) {
      plan.push({ ref: field.ref, action: "fill", value, sourceKey: key });
      continue;
    }

    plan.push({
      ref: field.ref,
      action: "defer_to_human",
      reason: key
        ? value
          ? `matched "${key}" but field kind "${field.kind}" needs review`
          : `matched "${key}" but profile has no value for it`
        : "no matching rule — engine never guesses",
    });
  }
  return plan;
}
