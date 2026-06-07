// src/shared/data/role-suggestions.ts
//
// Curated list of common job titles and technical roles, used as autocomplete
// suggestions in the preferences ChipInput. Users can also free-type anything
// not in this list — these are suggestions, not a closed enum.
//
// Organized by category in comments. Flattened to a single array for the
// autocomplete component. Lowercase preferred for keywords; mixed case for
// titles. Tilt toward roles that hire international workers / sponsor visas.

export const ROLE_SUGGESTIONS: string[] = [
  // ML / AI
  "machine learning",
  "ML Engineer",
  "AI Engineer",
  "Applied Scientist",
  "Research Engineer",
  "Research Scientist",
  "Data Scientist",
  "Senior Data Scientist",
  "Staff Data Scientist",
  "MLOps Engineer",
  "deep learning",
  "computer vision",
  "NLP",
  "LLM",
  "generative AI",
  "RAG",
  "RLHF",

  // Software Engineering
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Principal Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "Mobile Engineer",
  "iOS Engineer",
  "Android Engineer",
  "Platform Engineer",
  "Infrastructure Engineer",
  "Site Reliability Engineer",
  "DevOps Engineer",
  "Cloud Engineer",

  // Data
  "Data Engineer",
  "Senior Data Engineer",
  "Analytics Engineer",
  "Data Analyst",
  "Business Intelligence",

  // Specialty engineering
  "Security Engineer",
  "Performance Engineer",
  "Database Engineer",
  "Embedded Systems Engineer",
  "Robotics Engineer",
  "Compiler Engineer",
  "Distributed Systems Engineer",

  // Design / Product
  "Product Designer",
  "UX Designer",
  "Design Engineer",
  "Product Manager",
  "Technical Program Manager",
  "Engineering Manager",

  // Common tech keywords
  "Python",
  "TypeScript",
  "Rust",
  "Go",
  "React",
  "Next.js",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "PyTorch",
  "TensorFlow",
  "LangChain",
  "vector database",

  // Domain-flavored
  "FinTech",
  "HealthTech",
  "Climate",
  "Robotics",
  "Autonomous Vehicles",
  "Cybersecurity",
];

// Alias layer: maps short tokens users actually type (e.g. "aiml", "ml", "genai")
// to the canonical suggestions they should surface. Explicit and auditable —
// same instinct as SKILL_CANONICAL in the resume parser. Not fuzzy matching.
const SUGGESTION_ALIASES: Record<string, string[]> = {
  aiml: ["ML Engineer", "AI Engineer", "machine learning", "deep learning", "Applied Scientist"],
  "ai/ml": ["ML Engineer", "AI Engineer", "machine learning", "deep learning"],
  "ai ml": ["ML Engineer", "AI Engineer", "machine learning", "deep learning"],
  ml: ["ML Engineer", "machine learning", "MLOps Engineer", "deep learning"],
  ai: ["AI Engineer", "generative AI", "Applied Scientist", "machine learning"],
  genai: ["generative AI", "LLM", "RAG", "AI Engineer"],
  "gen ai": ["generative AI", "LLM", "RAG", "AI Engineer"],
  mle: ["ML Engineer", "MLOps Engineer"],
};

/**
 * Returns suggestions matching a query. Alias hits take priority (deduped,
 * preserving order), then standard case-insensitive substring matches are
 * appended. Already-selected values are filtered by the caller.
 */
export function matchSuggestions(query: string, pool: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const aliasHits = SUGGESTION_ALIASES[q] ?? [];
  const substringHits = pool.filter((s) => s.toLowerCase().includes(q));

  // Merge: alias hits first, then substring hits, deduped (case-insensitive).
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...aliasHits, ...substringHits]) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}
