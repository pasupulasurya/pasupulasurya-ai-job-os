"use client";

type JobType = "full-time" | "internship" | "contract" | "part-time";

interface JobTypeSelectProps {
  values: JobType[];
  onChange: (next: JobType[]) => void;
}

const OPTIONS: Array<{ value: JobType; label: string }> = [
  { value: "full-time", label: "Full-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
  { value: "part-time", label: "Part-time" },
];

export function JobTypeSelect({ values, onChange }: JobTypeSelectProps) {
  function toggle(v: JobType) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <div className="space-y-2">
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        Job types (optional)
      </label>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-card border-border text-text-secondary hover:border-border-strong hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-text-tertiary text-xs">Leave empty to include all types.</p>
    </div>
  );
}
