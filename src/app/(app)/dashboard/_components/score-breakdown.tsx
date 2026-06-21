"use client";
import { motion } from "framer-motion";
import { spring } from "@/styles/tokens";
type Dimension = {
  score: number;
  signal: string;
  weighted: number;
};
type ScoreBreakdownData = {
  title?: Dimension;
  seniority?: Dimension;
  skills?: Dimension;
  keywordsInJD?: Dimension;
  sponsorship?: Dimension;
  relevanceGate?: { applied: boolean };
};
const DIMENSION_META: Array<{ key: keyof ScoreBreakdownData; label: string; maxWeight: number }> = [
  { key: "title", label: "Title match", maxWeight: 35 },
  { key: "seniority", label: "Experience fit", maxWeight: 25 },
  { key: "skills", label: "Skills overlap", maxWeight: 15 },
  { key: "keywordsInJD", label: "Keywords in description", maxWeight: 10 },
  { key: "sponsorship", label: "Visa sponsorship", maxWeight: 15 },
];
function isDimension(value: unknown): value is Dimension {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === "number" && typeof v.signal === "string" && typeof v.weighted === "number"
  );
}
function getBarColor(score: number): string {
  if (score >= 0.7) return "bg-accent";
  if (score >= 0.3) return "bg-accent/60";
  return "bg-text-tertiary/30";
}
export function ScoreBreakdown({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <p className="text-text-tertiary text-xs">Breakdown not available.</p>;
  }
  const breakdown = data as ScoreBreakdownData;
  // Build list of present dimensions, sorted by weighted contribution desc.
  // Filters to whatever keys are present, so matches scored under an older
  // breakdown shape degrade gracefully (fewer bars) until they re-score.
  const rows = DIMENSION_META.filter((meta) => meta.key !== "relevanceGate")
    .map((meta) => {
      const dim = breakdown[meta.key];
      if (!isDimension(dim)) return null;
      return { ...meta, dim };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.dim.weighted - a.dim.weighted);
  return (
    <div className="border-border bg-surface/40 mt-4 space-y-3 rounded-lg border p-4">
      <p className="text-text-tertiary mb-2 text-xs tracking-widest uppercase">
        How this score was computed
      </p>
      {rows.map((row, i) => (
        <div key={row.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-text-secondary text-xs font-medium">{row.label}</p>
            <p className="text-text-tertiary text-xs tabular-nums">
              {row.dim.weighted.toFixed(1)} / {row.maxWeight}
            </p>
          </div>
          <div className="bg-border/40 h-1 overflow-hidden rounded-full">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(row.dim.score * 100)}%` }}
              transition={{ ...spring.smooth, delay: 0.05 * i }}
              className={`h-full rounded-full ${getBarColor(row.dim.score)}`}
            />
          </div>
          <p className="text-text-tertiary text-xs leading-relaxed">{row.dim.signal}</p>
        </div>
      ))}
    </div>
  );
}
