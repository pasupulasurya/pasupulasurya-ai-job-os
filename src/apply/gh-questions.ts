// Greenhouse question semantics from the public Job Board API
// (jobs/{id}?questions=true). API = what each field means + exact
// option labels; DOM = where it lives (field name === element id).
// PURE module: types + matching only, no fetch, no DOM.

export interface GHOption {
  label: string;
  decline?: boolean;
}

export interface GHQuestion {
  /** Field name from the API — equals the DOM element id. */
  fieldName: string;
  label: string;
  required: boolean;
  type: "input_text" | "textarea" | "input_file" | "single_select" | "multi_select" | "other";
  options: GHOption[];
}

export type AnswerDecision =
  | { kind: "select"; fieldName: string; optionLabel: string; sourceKey: string }
  | { kind: "fill"; fieldName: string; value: string; sourceKey: string }
  | { kind: "defer"; fieldName: string; label: string; reason: string };

/** Stored answers relevant to GH question matching. */
export interface GHAnswerProfile {
  workAuthorizedUS: boolean | null;
  requiresSponsorship: boolean | null;
  previouslyEmployed: boolean | null;
  gender: string | null;
  hispanicLatino: string | null;
  raceEthnicity: string | null;
  veteranStatus: string | null;
  disabilityStatus: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  location: string | null;
}

// ── Question-label matching rules (first match wins) ────────────────
type Matcher = (q: GHQuestion, p: GHAnswerProfile) => AnswerDecision | null;

function findOption(q: GHQuestion, predicate: (o: GHOption) => boolean): string | null {
  const hit = q.options.find(predicate);
  return hit ? hit.label : null;
}

/** Resolve a stored yes/no boolean against Yes/No option labels. */
function yesNo(q: GHQuestion, fieldKey: string, stored: boolean | null): AnswerDecision | null {
  if (stored === null) return null;
  const want = stored ? /^yes\b/i : /^no\b/i;
  const label = findOption(q, (o) => want.test(o.label));
  if (!label) return null;
  return { kind: "select", fieldName: q.fieldName, optionLabel: label, sourceKey: fieldKey };
}

/** Resolve a stored EEO value: "decline" uses the API's decline flag;
 *  otherwise match via the canonical-value -> label-pattern table. */
function eeo(
  q: GHQuestion,
  fieldKey: string,
  stored: string | null,
  table: Record<string, RegExp>,
): AnswerDecision | null {
  if (stored === null) return null;
  if (stored === "decline") {
    const label = findOption(q, (o) => o.decline === true);
    if (!label) return null;
    return { kind: "select", fieldName: q.fieldName, optionLabel: label, sourceKey: fieldKey };
  }
  const pattern = table[stored];
  if (!pattern) return null;
  const label = findOption(q, (o) => pattern.test(o.label));
  if (!label) return null;
  return { kind: "select", fieldName: q.fieldName, optionLabel: label, sourceKey: fieldKey };
}

// Canonical-value -> option-label patterns, built from real GH labels.
const GENDER_TABLE: Record<string, RegExp> = {
  male: /^male$/i,
  female: /^female$/i,
  non_binary: /non-?binary/i,
};
const YES_NO_TABLE: Record<string, RegExp> = { yes: /^yes\b/i, no: /^no\b/i };
const RACE_TABLE: Record<string, RegExp> = {
  american_indian_alaska_native: /american indian|alaska native/i,
  asian: /^asian$/i,
  black_african_american: /black|african american/i,
  native_hawaiian_pacific_islander: /hawaiian|pacific islander/i,
  white: /^white$/i,
  two_or_more: /two or more/i,
};
const VETERAN_TABLE: Record<string, RegExp> = {
  veteran: /am one or more|^i am a (protected )?veteran/i,
  not_veteran: /not a protected veteran|am not a veteran/i,
};
const DISABILITY_TABLE: Record<string, RegExp> = {
  yes: /^yes, i have/i,
  no: /^no, i don/i,
};

const RULES: { pattern: RegExp; decide: Matcher }[] = [
  {
    pattern: /legally authorized to work/i,
    decide: (q, p) => yesNo(q, "workAuthorizedUS", p.workAuthorizedUS),
  },
  {
    pattern: /require (immigration )?sponsorship/i,
    decide: (q, p) => yesNo(q, "requiresSponsorship", p.requiresSponsorship),
  },
  { pattern: /^gender$/i, decide: (q, p) => eeo(q, "gender", p.gender, GENDER_TABLE) },
  {
    pattern: /hispanic or latin/i,
    decide: (q, p) => eeo(q, "hispanicLatino", p.hispanicLatino, YES_NO_TABLE),
  },
  { pattern: /^race\b/i, decide: (q, p) => eeo(q, "raceEthnicity", p.raceEthnicity, RACE_TABLE) },
  {
    pattern: /veteran status/i,
    decide: (q, p) => eeo(q, "veteranStatus", p.veteranStatus, VETERAN_TABLE),
  },
  {
    pattern: /disability status|have a disability/i,
    decide: (q, p) => eeo(q, "disabilityStatus", p.disabilityStatus, DISABILITY_TABLE),
  },
  {
    pattern: /linkedin/i,
    decide: (q, p) =>
      p.linkedinUrl
        ? { kind: "fill", fieldName: q.fieldName, value: p.linkedinUrl, sourceKey: "linkedinUrl" }
        : null,
  },
  {
    pattern: /github/i,
    decide: (q, p) =>
      p.githubUrl
        ? { kind: "fill", fieldName: q.fieldName, value: p.githubUrl, sourceKey: "githubUrl" }
        : null,
  },
  {
    pattern: /portfolio|personal website/i,
    decide: (q, p) =>
      p.portfolioUrl
        ? { kind: "fill", fieldName: q.fieldName, value: p.portfolioUrl, sourceKey: "portfolioUrl" }
        : null,
  },
  // "Have you worked at <company>": ONLY the clean negative is safe to
  // auto-select. Any stored "yes" or multi-flavor option set defers —
  // the per-company nuance belongs to the human.
  {
    pattern: /have you (ever )?worked at/i,
    decide: (q, p) => {
      if (p.previouslyEmployed !== false) return null;
      const label = findOption(q, (o) => /have not worked|^no\b/i.test(o.label));
      if (!label) return null;
      return {
        kind: "select",
        fieldName: q.fieldName,
        optionLabel: label,
        sourceKey: "previouslyEmployed",
      };
    },
  },
];

export function decideAnswers(questions: GHQuestion[], profile: GHAnswerProfile): AnswerDecision[] {
  const out: AnswerDecision[] = [];
  for (const q of questions) {
    if (q.type === "input_file" || q.type === "other") continue; // harness/basics own these
    const rule = RULES.find((r) => r.pattern.test(q.label));
    const decision = rule ? rule.decide(q, profile) : null;
    out.push(
      decision ?? {
        kind: "defer",
        fieldName: q.fieldName,
        label: q.label,
        reason: rule
          ? "matched rule but no stored answer or option fit"
          : "no matching rule — never guesses",
      },
    );
  }
  return out;
}
