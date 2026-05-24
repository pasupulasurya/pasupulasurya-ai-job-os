"use client";

interface ExperienceRangeProps {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

const PRESETS: Array<{
  label: string;
  min: number | null;
  max: number | null;
}> = [
  { label: "Any", min: null, max: null },
  { label: "0–1 yrs", min: 0, max: 1 },
  { label: "0–3 yrs", min: 0, max: 3 },
  { label: "3–6 yrs", min: 3, max: 6 },
  { label: "7+ yrs", min: 7, max: null },
];

export function ExperienceRange({ min, max, onChange }: ExperienceRangeProps) {
  function isActive(p: (typeof PRESETS)[number]) {
    return p.min === min && p.max === max;
  }

  return (
    <div className="space-y-2">
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        Experience level
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = isActive(p);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.min, p.max)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-card border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
