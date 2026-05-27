// src/server/services/matcher/score.ts
//
// Pure scoring functions. Two algorithmic principles:
//
// 1. Title keyword scoring saturates quickly. 1 strong keyword match = ~70%,
//    2 matches = ~90%, 3+ = 100%. Linear division by user's keyword count was
//    penalizing legitimate matches when users have many keywords.
//    Keywords are matched with word boundaries so short tokens like "llm"
//    don't false-positive inside words like "fulfillment".
//
// 2. Skills scoring is dampened when the job has too few extracted skills.
//    A job with 1 skill "matching" a resume's 47 was scoring 100% — but that's
//    a sparsity artifact, not a real signal. We require 3+ extracted skills
//    on the job side before skills can contribute full weight.

export type MatchableJob = {
  title: string;
  location: string | null;
  remote: boolean;
  seniority: string | null;
  experienceYears: number | null;
  skills: string[];
  sponsorsVisa: boolean | null;
};

export type MatchableUser = {
  keywords: string[];
  locations: string[];
  visaSponsorship: boolean;
  totalYearsExperience: number | null;
  resumeSkills: string[];
};

export type DimensionResult = { score: number; signal: string };
export type ScoreBreakdown = {
  titleKeywords: DimensionResult & { weighted: number };
  skills: DimensionResult & { weighted: number };
  seniority: DimensionResult & { weighted: number };
  sponsorship: DimensionResult & { weighted: number };
  location: DimensionResult & { weighted: number };
  salary: DimensionResult & { weighted: number };
  relevanceGate: { applied: boolean; reason?: string };
};

export const WEIGHTS = {
  titleKeywords: 25,
  skills: 20,
  seniority: 15,
  sponsorship: 15,
  location: 15,
  salary: 10,
} as const;

const NO_RELEVANCE_CAP = 35;
const MIN_JOB_SKILLS_FOR_FULL_CREDIT = 3;

const lower = (s: string) => s.toLowerCase();
const lowerSet = (arr: string[]) => new Set(arr.map(lower));

// Escapes regex metachars in a user-supplied keyword so they're matched literally.
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True when `keyword` appears in `text` as a whole word/phrase.
// Word boundary on each side prevents "llm" matching inside "fulfillment".
function matchesAsWord(text: string, keyword: string): boolean {
  const k = escapeForRegex(keyword);
  const re = new RegExp(`(?:^|\\W)${k}(?:$|\\W)`, "i");
  return re.test(text);
}

export function scoreTitleKeywords(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (user.keywords.length === 0) return { score: 0, signal: "no keywords set" };
  const title = lower(job.title);
  const matches = user.keywords.filter((k) => matchesAsWord(title, lower(k)));
  if (matches.length === 0) return { score: 0, signal: "no keyword matches in title" };
  // Saturating curve: 1 match = 0.7, 2 = 0.9, 3+ = 1.0.
  const saturationCurve = [0, 0.7, 0.9, 1.0];
  const score = matches.length >= 3 ? 1.0 : saturationCurve[matches.length];
  return { score, signal: `${matches.length} keyword(s) match: ${matches.join(", ")}` };
}

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
      signal: `${overlap.length}/${job.skills.length} job skills in resume (dampened: <${MIN_JOB_SKILLS_FOR_FULL_CREDIT} skills extracted)`,
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
    const score = Math.max(0, 1 - dist / 4);
    return {
      score,
      signal: `${user.totalYearsExperience}y vs ${job.seniority} band (off by ${dist}y)`,
    };
  }
  if (job.experienceYears != null) {
    const dist = Math.abs(user.totalYearsExperience - job.experienceYears);
    const score = Math.max(0, 1 - dist / 4);
    return { score, signal: `${user.totalYearsExperience}y vs job's ${job.experienceYears}y` };
  }
  return { score: 0, signal: "job seniority unknown" };
}

export function scoreSponsorship(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (!user.visaSponsorship) return { score: 1, signal: "user does not need sponsorship" };
  if (job.sponsorsVisa === true) return { score: 1, signal: "job sponsors visa" };
  if (job.sponsorsVisa === false) return { score: 0, signal: "job explicitly does not sponsor" };
  return { score: 0, signal: "sponsorship unknown" };
}

export function scoreLocation(job: MatchableJob, user: MatchableUser): DimensionResult {
  if (user.locations.length === 0)
    return { score: 0, signal: "user has no location preferences set" };
  const wantsRemote = user.locations.some((l) => lower(l) === "remote");
  if (wantsRemote && job.remote) return { score: 1, signal: "remote match" };
  if (!job.location) return { score: 0, signal: "job location unknown" };
  const jobLoc = lower(job.location);
  const matched = user.locations.find((l) => lower(l) !== "remote" && jobLoc.includes(lower(l)));
  if (matched) return { score: 1, signal: `location match: ${matched}` };
  return { score: 0, signal: "no location overlap" };
}

export function scoreSalary(_job: MatchableJob, _user: MatchableUser): DimensionResult {
  return { score: 0, signal: "salary data not available" };
}

export function composeScore(
  job: MatchableJob,
  user: MatchableUser,
): { totalScore: number; breakdown: ScoreBreakdown } {
  const dims = {
    titleKeywords: scoreTitleKeywords(job, user),
    skills: scoreSkills(job, user),
    seniority: scoreSeniority(job, user),
    sponsorship: scoreSponsorship(job, user),
    location: scoreLocation(job, user),
    salary: scoreSalary(job, user),
  };

  const breakdown: ScoreBreakdown = {
    titleKeywords: {
      ...dims.titleKeywords,
      weighted: dims.titleKeywords.score * WEIGHTS.titleKeywords,
    },
    skills: { ...dims.skills, weighted: dims.skills.score * WEIGHTS.skills },
    seniority: { ...dims.seniority, weighted: dims.seniority.score * WEIGHTS.seniority },
    sponsorship: { ...dims.sponsorship, weighted: dims.sponsorship.score * WEIGHTS.sponsorship },
    location: { ...dims.location, weighted: dims.location.score * WEIGHTS.location },
    salary: { ...dims.salary, weighted: dims.salary.score * WEIGHTS.salary },
    relevanceGate: { applied: false },
  };

  let totalScore =
    breakdown.titleKeywords.weighted +
    breakdown.skills.weighted +
    breakdown.seniority.weighted +
    breakdown.sponsorship.weighted +
    breakdown.location.weighted +
    breakdown.salary.weighted;

  const titleKeywordsHasData = user.keywords.length > 0;
  const skillsHasData = job.skills.length > 0 && user.resumeSkills.length > 0;

  if (
    titleKeywordsHasData &&
    skillsHasData &&
    dims.titleKeywords.score === 0 &&
    dims.skills.score === 0
  ) {
    if (totalScore > NO_RELEVANCE_CAP) {
      breakdown.relevanceGate = {
        applied: true,
        reason: `no title-keyword or skills match (both signals had data); capped at ${NO_RELEVANCE_CAP}`,
      };
      totalScore = NO_RELEVANCE_CAP;
    }
  }

  return { totalScore: Math.round(totalScore * 10) / 10, breakdown };
}
