// src/server/services/matcher/score.ts
//
// Pure scoring functions. Five live dimensions (total 100):
//   title 35 · experience(seniority) 25 · skills 15 · keywordsInJD 10 · sponsorship 15
//
// Design (locked 2026-06-21, supersedes the original 6-dimension weights):
//   - TITLE is the primary signal: user.targetRoles matched against job.title.
//     Saturating curve (1 match=0.7, 2=0.9, 3+=1.0). Word-boundary matching so
//     "llm" doesn't hit inside "fulfillment".
//   - EXPERIENCE second: user years vs job seniority band. "3y matches mid" = full.
//   - SKILLS subordinate (15, down from 20): skill GAPS are recoverable via
//     resume tailoring downstream, so skills inform ranking but never gate.
//   - KEYWORDS-IN-JD (new, 10): user.keywords matched against title + description.
//     This is where specialist terms (rag, langchain, kubernetes) earn credit —
//     they live in the JD body, not the title.
//   - SPONSORSHIP (15): per-job sponsorsVisa is null on ~99.9% of jobs, so we
//     fall back to the company's knownToSponsor prior (the USCIS-verified signal).
//   - LOCATION and SALARY dimensions REMOVED (location not scored; salary was
//     always 0). Their weight folded into title/experience.

export type MatchableJob = {
  title: string;
  seniority: string | null;
  experienceYears: number | null;
  skills: string[];
  description: string | null;
  sponsorsVisa: boolean | null;
  knownToSponsor: boolean | null;
};

export type MatchableUser = {
  targetRoles: string[];
  keywords: string[];
  visaSponsorship: boolean;
  totalYearsExperience: number | null;
  resumeSkills: string[];
};

export type DimensionResult = { score: number; signal: string };
export type ScoreBreakdown = {
  title: DimensionResult & { weighted: number };
  seniority: DimensionResult & { weighted: number };
  skills: DimensionResult & { weighted: number };
  keywordsInJD: DimensionResult & { weighted: number };
  sponsorship: DimensionResult & { weighted: number };
  relevanceGate: { applied: boolean; reason?: string };
};

export const WEIGHTS = {
  title: 35,
  seniority: 25,
  skills: 15,
  keywordsInJD: 10,
  sponsorship: 15,
} as const;

const NO_RELEVANCE_CAP = 35;
const MIN_JOB_SKILLS_FOR_FULL_CREDIT = 3;
const KNOWN_SPONSOR_PRIOR = 0.8; // company verified sponsor, this role unstated

const lower = (s: string) => s.toLowerCase();
const lowerSet = (arr: string[]) => new Set(arr.map(lower));

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAsWord(text: string, keyword: string): boolean {
  const k = escapeForRegex(keyword);
  const re = new RegExp(`(?:^|\\W)${k}(?:$|\\W)`, "i");
  return re.test(text);
}

const SATURATION = [0, 0.7, 0.9, 1.0];
function saturate(n: number): number {
  return n >= 3 ? 1.0 : SATURATION[n];
}

// TITLE (35): user.targetRoles vs job.title.
export function scoreTitle(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (user.targetRoles.length === 0) return { score: 0, signal: "no target roles set" };
  const title = lower(job.title);
  const matches = user.targetRoles.filter((r) => matchesAsWord(title, lower(r)));
  if (matches.length === 0) return { score: 0, signal: "no target-role match in title" };
  return {
    score: saturate(matches.length),
    signal: `${matches.length} role(s) match title: ${matches.join(", ")}`,
  };
}

// KEYWORDS-IN-JD (10): user.keywords vs title + description.
export function scoreKeywordsInJD(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (user.keywords.length === 0) return { score: 0, signal: "no keywords set" };
  const haystack = `${lower(job.title)} ${lower(job.description ?? "")}`;
  const matches = user.keywords.filter((k) => matchesAsWord(haystack, lower(k)));
  if (matches.length === 0) return { score: 0, signal: "no keyword matches in title/description" };
  return {
    score: saturate(matches.length),
    signal: `${matches.length} keyword(s) in JD: ${matches.join(", ")}`,
  };
}

// SKILLS (15): resume skills vs job's extracted skills. Subordinate — never gates.
export function scoreSkills(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (job.skills.length === 0) return { score: 0, signal: "no job skills extracted" };
  if (user.resumeSkills.length === 0) return { score: 0, signal: "no resume skills extracted" };
  const userSet = lowerSet(user.resumeSkills);
  const overlap = job.skills.filter((s) => userSet.has(lower(s)));
  const rawScore = overlap.length / job.skills.length;
  if (job.skills.length < MIN_JOB_SKILLS_FOR_FULL_CREDIT) {
    const dampened = rawScore * (job.skills.length / MIN_JOB_SKILLS_FOR_FULL_CREDIT);
    return {
      score: dampened,
      signal: `${overlap.length}/${job.skills.length} job skills in resume (dampened)`,
    };
  }
  return { score: rawScore, signal: `${overlap.length}/${job.skills.length} job skills in resume` };
}

const SENIORITY_BANDS: Record<string, [number, number]> = {
  entry: [0, 2],
  mid: [2, 5],
  senior: [5, 8],
  staff: [8, 30],
};

// EXPERIENCE (25): user years vs job band. Internal key kept as "seniority".
export function scoreSeniority(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (user.totalYearsExperience == null) return { score: 0, signal: "user experience unknown" };
  const band = job.seniority ? SENIORITY_BANDS[job.seniority] : null;
  if (band) {
    const [lo, hi] = band;
    if (user.totalYearsExperience >= lo && user.totalYearsExperience <= hi) {
      return { score: 1, signal: `${user.totalYearsExperience}y matches ${job.seniority} band` };
    }
    const dist =
      user.totalYearsExperience < lo
        ? lo - user.totalYearsExperience
        : user.totalYearsExperience - hi;
    return {
      score: Math.max(0, 1 - dist / 4),
      signal: `${user.totalYearsExperience}y vs ${job.seniority} band (off by ${dist}y)`,
    };
  }
  if (job.experienceYears != null) {
    const dist = Math.abs(user.totalYearsExperience - job.experienceYears);
    return {
      score: Math.max(0, 1 - dist / 4),
      signal: `${user.totalYearsExperience}y vs job's ${job.experienceYears}y`,
    };
  }
  return { score: 0, signal: "job seniority unknown" };
}

// SPONSORSHIP (15): per-job signal, falling back to company knownToSponsor prior.
export function scoreSponsorship(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (!user.visaSponsorship) return { score: 1, signal: "user does not need sponsorship" };
  if (job.sponsorsVisa === true) return { score: 1, signal: "job sponsors visa" };
  if (job.sponsorsVisa === false) return { score: 0, signal: "job explicitly does not sponsor" };
  if (job.knownToSponsor === true)
    return { score: KNOWN_SPONSOR_PRIOR, signal: "verified sponsor company (role unstated)" };
  return { score: 0, signal: "sponsorship unknown" };
}

export function composeScore(
  job: MatchableJob,
  user: MatchableUser,
): { totalScore: number; breakdown: ScoreBreakdown } {
  const dims = {
    title: scoreTitle(job, user),
    seniority: scoreSeniority(job, user),
    skills: scoreSkills(job, user),
    keywordsInJD: scoreKeywordsInJD(job, user),
    sponsorship: scoreSponsorship(job, user),
  };

  const breakdown: ScoreBreakdown = {
    title: { ...dims.title, weighted: dims.title.score * WEIGHTS.title },
    seniority: { ...dims.seniority, weighted: dims.seniority.score * WEIGHTS.seniority },
    skills: { ...dims.skills, weighted: dims.skills.score * WEIGHTS.skills },
    keywordsInJD: {
      ...dims.keywordsInJD,
      weighted: dims.keywordsInJD.score * WEIGHTS.keywordsInJD,
    },
    sponsorship: { ...dims.sponsorship, weighted: dims.sponsorship.score * WEIGHTS.sponsorship },
    relevanceGate: { applied: false },
  };

  let totalScore =
    breakdown.title.weighted +
    breakdown.seniority.weighted +
    breakdown.skills.weighted +
    breakdown.keywordsInJD.weighted +
    breakdown.sponsorship.weighted;

  const titleHasData = user.targetRoles.length > 0;
  const keywordsHaveData = user.keywords.length > 0;
  if (titleHasData && keywordsHaveData && dims.title.score === 0 && dims.keywordsInJD.score === 0) {
    if (totalScore > NO_RELEVANCE_CAP) {
      breakdown.relevanceGate = {
        applied: true,
        reason: `no title or keyword match (both had data); capped at ${NO_RELEVANCE_CAP}`,
      };
      totalScore = NO_RELEVANCE_CAP;
    }
  }

  return { totalScore: Math.round(totalScore * 10) / 10, breakdown };
}
