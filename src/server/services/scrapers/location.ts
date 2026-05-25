/**
 * US location detection.
 *
 * Pure functions, no I/O. Used by scrapers to decide which jobs to keep.
 *
 * Conservative bias: when ambiguous, return false.
 * (Per VISION: "we'd rather miss a US job than show a foreign one.")
 */

const US_STATES_FULL = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "District of Columbia",
];

const US_STATES_ABBR = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

const NON_US_INDICATORS = [
  "London",
  "United Kingdom",
  "UK,",
  " UK ",
  "England",
  "Scotland",
  "Berlin",
  "Germany",
  "Munich",
  "Paris",
  "France",
  "Toronto",
  "Vancouver",
  "Canada",
  "Sydney",
  "Melbourne",
  "Australia",
  "Tokyo",
  "Japan",
  "Singapore",
  "Dubai",
  "UAE",
  "Bangalore",
  "Mumbai",
  "Delhi",
  "India",
  "Sao Paulo",
  "Brazil",
  "Mexico City",
  "Mexico,",
  "Amsterdam",
  "Netherlands",
  "Madrid",
  "Spain",
  "Dublin",
  "Ireland",
  "Stockholm",
  "Sweden",
  "Copenhagen",
  "Denmark",
  "Zurich",
  "Switzerland",
];

const US_REMOTE_INDICATORS = [
  "Remote - US",
  "US Remote",
  "Remote, US",
  "Remote (US)",
  "United States Remote",
  "Remote United States",
  "USA Remote",
  "Remote (United States)",
  "Remote in US",
  "US-Remote",
];

export function isUSLocation(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;

  const lower = text.toLowerCase();
  for (const flag of NON_US_INDICATORS) {
    if (lower.includes(flag.toLowerCase())) return false;
  }

  if (lower === "remote" || lower === "remote, remote") return false;

  for (const flag of US_REMOTE_INDICATORS) {
    if (lower.includes(flag.toLowerCase())) return true;
  }

  const abbrMatch = /\b([A-Z]{2})\b/.exec(text);
  if (abbrMatch && US_STATES_ABBR.has(abbrMatch[1])) return true;

  for (const state of US_STATES_FULL) {
    if (text.includes(state)) return true;
  }

  return false;
}

/**
 * Splits the raw location on both "|" and ";" because Anthropic
 * (and possibly others) uses both as separators. A job is US-based
 * if ANY of its segments matches isUSLocation().
 */
export function hasUSLocation(raw: string): boolean {
  return raw
    .split(/[|;]/)
    .map((s) => s.trim())
    .some((s) => isUSLocation(s));
}
