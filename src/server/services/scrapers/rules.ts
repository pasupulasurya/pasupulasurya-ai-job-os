/**
 * Owner-level rule engine.
 *
 * Reads ScrapingRule rows from the DB and applies each to a job.
 * Returns pass:true iff ALL enabled rules approve the job.
 *
 * Supports 3 ruleTypes (from ADR + seeded data):
 *   - "exclude_keyword"          → if pattern matches `appliesTo` field, reject
 *   - "require_location_match"   → if pattern doesn't match location, reject
 *   - "max_age_days"             → if postedAt is older than N days, reject
 *
 * Patterns are treated as case-insensitive regex (matches our seeded rules
 * which use `|` for alternation in require_location_match).
 */

export interface RuleableJob {
  title: string;
  description: string;
  location: string;
  postedAt: Date | null;
}

export interface OwnerRule {
  id: string;
  name: string;
  ruleType: string;
  pattern: string;
  enabled: boolean;
  appliesTo: string; // "title" | "description" | "location" | "any"
}

export type RuleResult =
  | { pass: true }
  | { pass: false; rejectedBy: { ruleId: string; name: string; ruleType: string } };

/**
 * Pick the text to test against, based on rule.appliesTo.
 * "any" concatenates title + description + location.
 */
function targetText(job: RuleableJob, appliesTo: string): string {
  switch (appliesTo) {
    case "title":
      return job.title;
    case "description":
      return job.description;
    case "location":
      return job.location;
    case "any":
      return `${job.title} ${job.description} ${job.location}`;
    default:
      return "";
  }
}

/**
 * Build a case-insensitive regex from a pattern.
 * Returns null if the pattern is malformed.
 */
function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export function applyRules(job: RuleableJob, rules: OwnerRule[]): RuleResult {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.ruleType === "max_age_days") {
      if (!job.postedAt) continue; // can't evaluate — accept
      const maxDays = parseInt(rule.pattern, 10);
      if (Number.isNaN(maxDays)) continue;
      const ageMs = Date.now() - job.postedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > maxDays) {
        return {
          pass: false,
          rejectedBy: { ruleId: rule.id, name: rule.name, ruleType: rule.ruleType },
        };
      }
      continue;
    }

    const regex = compileRegex(rule.pattern);
    if (!regex) continue; // malformed pattern — skip rather than crash

    const text = targetText(job, rule.appliesTo);
    const matches = regex.test(text);

    if (rule.ruleType === "exclude_keyword" && matches) {
      return {
        pass: false,
        rejectedBy: { ruleId: rule.id, name: rule.name, ruleType: rule.ruleType },
      };
    }

    if (rule.ruleType === "require_location_match" && !matches) {
      return {
        pass: false,
        rejectedBy: { ruleId: rule.id, name: rule.name, ruleType: rule.ruleType },
      };
    }
  }

  return { pass: true };
}
