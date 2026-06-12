// 2J.1 — cohort title pre-filter at scrape time (EXCLUSION model).
// Pure function, same family as location.ts / rules.ts.
// WHY: enrichment (~450/day TPD) and DB (500MB) are the binding
// constraints. The beta cohort is broad (software, data/ML, hardware,
// electronics, civil, robotics), so an inclusion list would always
// have a hole a friend falls through. Instead we drop only titles in
// clearly-non-engineering functions. Everything else enters the pool.
// Asymmetric risk: over-inclusion costs a little enrichment;
// over-exclusion silently loses real jobs. Stems err narrow.
// Every drop is logged by the caller (scrape.title_filter.dropped).
// Disable globally via TITLE_FILTER_ENABLED=false (no deploy needed).

const NON_COHORT_STEMS: RegExp[] = [
  /\baccount (executive|manager)\b/i,
  /\baccountant\b/i,
  /\baccounting\b/i,
  /\bsales\b/i,
  /\bmarketing\b/i,
  /\brecruit(er|ing)\b/i,
  /\btalent acquisition\b/i,
  /\bhuman resources\b/i,
  /\bhr (business partner|generalist|manager)\b/i,
  /\bcustomer (support|success|service|care)\b/i,
  /\btechnical support\b/i,
  /\bhelp ?desk\b/i,
  /\blegal\b/i,
  /\bcounsel\b/i,
  /\bparalegal\b/i,
  /\bexecutive assistant\b/i,
  /\badministrative\b/i,
  /\boffice manager\b/i,
  /\breceptionist\b/i,
  /\bcommunit(y|ies) manager\b/i,
  /\bcontent (writer|creator|marketer)\b/i,
  /\bcopywriter\b/i,
  /\bsocial media\b/i,
  /\bpublic relations\b/i,
  /\bbrand\b/i,
  /\bpayroll\b/i,
  /\bbookkeep/i,
  /\bdriver\b/i,
  /\bdelivery\b/i,
  /\bcourier\b/i,
  /\bretail\b/i,
  /\bstore (associate|manager)\b/i,
  /\bcashier\b/i,
  /\bbarista\b/i,
  /\bwarehouse\b/i,
  /\bjanitor/i,
  /\bcustodian\b/i,
  /\bnurse\b/i,
  /\bnursing\b/i,
  /\bclinical\b/i,
  /\bphysician\b/i,
  /\btherapist\b/i,
  /\bchef\b/i,
  /\bcook\b/i,
  /\bserver\b(?!less)/i,
  /\bbartender\b/i,
  /\bsecurity guard\b/i,
  /\bevents? (coordinator|planner)\b/i,
];

/** True = title enters the pool. False = drop (clearly non-cohort). */
export function matchesCohortTitles(title: string): boolean {
  return !NON_COHORT_STEMS.some((stem) => stem.test(title));
}

export function isTitleFilterEnabled(): boolean {
  return process.env.TITLE_FILTER_ENABLED !== "false";
}
