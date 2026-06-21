import { prisma } from "../src/server/lib/prisma";
import {
  composeScore,
  type MatchableJob,
  type MatchableUser,
} from "../src/server/services/matcher/score";
import { ResumeParseSchema } from "../src/server/services/ai/parse-resume";

const userId = "usr_98b04a8e6a854a0bb7ce8e04b4357922";

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preferences: true, resumes: { where: { isMaster: true }, take: 1 } },
  });
  if (!user?.preferences) throw new Error("no prefs");
  const parsed = ResumeParseSchema.parse(user.resumes[0].parsedJson);

  const mUser: MatchableUser = {
    targetRoles: user.preferences.targetRoles,
    keywords: user.preferences.keywords,
    visaSponsorship: user.preferences.visaSponsorship,
    totalYearsExperience: parsed.totalYearsExperience,
    resumeSkills: parsed.skills,
  };
  console.log("USER targetRoles:", JSON.stringify(mUser.targetRoles));
  console.log(
    "USER years:",
    mUser.totalYearsExperience,
    "needsSponsorship:",
    mUser.visaSponsorship,
  );

  const sponsorRows = await prisma.company.findMany({
    select: { slug: true, knownToSponsor: true },
  });
  const sponsorMap = new Map(sponsorRows.map((c) => [c.slug, c.knownToSponsor]));

  // Pull 8 "Machine Learning Engineer"-ish jobs and score them
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      enrichmentVersion: { not: null },
      OR: [
        { title: { contains: "Machine Learning", mode: "insensitive" } },
        { title: { contains: "ML Engineer", mode: "insensitive" } },
        { title: { contains: "Data Engineer", mode: "insensitive" } },
      ],
    },
    take: 8,
  });

  console.log("\nScoring", jobs.length, "sample jobs:\n");
  for (const j of jobs) {
    const mJob: MatchableJob = {
      title: j.title,
      seniority: j.seniority,
      experienceYears: j.experienceYears,
      skills: j.skills,
      description: j.description,
      sponsorsVisa: j.sponsorsVisa,
      knownToSponsor: j.companySlug ? (sponsorMap.get(j.companySlug) ?? null) : null,
    };
    const { totalScore, breakdown } = composeScore(mJob, mUser);
    const b: any = breakdown;
    console.log(
      `${totalScore.toString().padStart(5)}  ${j.title}  [seniority=${j.seniority}, knownSpon=${mJob.knownToSponsor}]`,
    );
    console.log(
      `        title=${b.title.weighted.toFixed(1)}(${b.title.signal}) exp=${b.seniority.weighted.toFixed(1)} spon=${b.sponsorship.weighted.toFixed(1)} kw=${b.keywordsInJD.weighted.toFixed(1)} skills=${b.skills.weighted.toFixed(1)}`,
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
