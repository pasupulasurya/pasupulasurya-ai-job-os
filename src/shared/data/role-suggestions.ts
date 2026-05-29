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
