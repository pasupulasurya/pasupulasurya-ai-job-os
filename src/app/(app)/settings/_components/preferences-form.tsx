"use client";

import { useState, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ChipInput } from "@/components/onboarding/chip-input";
import { ExperienceRange } from "@/components/onboarding/experience-range";
import { JobTypeSelect } from "@/components/onboarding/job-type-select";
import { PreferenceToggle } from "@/components/onboarding/preference-toggle";
import { preferencesSchema } from "@/shared/schemas/preferences";
import { savePreferencesAction } from "@/server/actions/preferences";
import { ROLE_SUGGESTIONS } from "@/shared/data/role-suggestions";
import { LOCATION_SUGGESTIONS } from "@/shared/data/location-suggestions";
import { spring } from "@/styles/tokens";

type JobType = "full-time" | "internship" | "contract" | "part-time";
type VisaType = "h1b" | "f1_opt" | "stem_opt" | "green_card" | "citizen" | "other";
type WorkAuth = "needs_sponsorship" | "current_h1b" | "ead" | "citizen_or_gc";
type Employment = "employed" | "unemployed" | "student" | "freelance";

const VISA_OPTIONS: Array<{ value: VisaType; label: string; description: string }> = [
  { value: "f1_opt", label: "F-1 OPT", description: "Recent grad on OPT" },
  { value: "stem_opt", label: "STEM OPT", description: "STEM-extension OPT" },
  { value: "h1b", label: "H-1B", description: "Currently on H-1B" },
  { value: "green_card", label: "Green Card", description: "Permanent resident" },
  { value: "citizen", label: "US Citizen", description: "No work authorization needed" },
  { value: "other", label: "Other", description: "TN, J-1, O-1, etc." },
];

const WORK_AUTH_OPTIONS: Array<{ value: WorkAuth; label: string; description: string }> = [
  {
    value: "needs_sponsorship",
    label: "I need sponsorship now",
    description: "Looking for employers who sponsor",
  },
  {
    value: "current_h1b",
    label: "I'm on H-1B with current employer",
    description: "Need transfer sponsorship",
  },
  { value: "ead", label: "I have an EAD", description: "Can work for any employer" },
  { value: "citizen_or_gc", label: "Citizen or Green Card", description: "No sponsorship needed" },
];

const EMPLOYMENT_OPTIONS: Array<{ value: Employment; label: string }> = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Job-hunting" },
  { value: "student", label: "Student" },
  { value: "freelance", label: "Freelance" },
];

export type PreferencesFormValues = {
  keywords: string[];
  excludeKeywords: string[];
  targetRoles: string[];
  locations: string[];
  jobTypes: JobType[];
  experienceMin: number | null;
  experienceMax: number | null;
  visaSponsorship: boolean;
  stemOptOnly: boolean;
  visaType: VisaType | null;
  workAuthStatus: WorkAuth | null;
  salaryMin: number | null;
  currentEmployment: Employment | null;
  avoidCompanies: string[];
};

export function PreferencesForm({
  initialValues,
  suggestedKeywords = [],
}: {
  initialValues: PreferencesFormValues;
  suggestedKeywords?: string[];
}) {
  const [keywords, setKeywords] = useState(initialValues.keywords);
  const [excludeKeywords, setExcludeKeywords] = useState(initialValues.excludeKeywords);
  const [targetRoles, setTargetRoles] = useState(initialValues.targetRoles);
  const [locations, setLocations] = useState(initialValues.locations);
  const [jobTypes, setJobTypes] = useState<JobType[]>(initialValues.jobTypes);
  const [experienceMin, setExperienceMin] = useState(initialValues.experienceMin);
  const [experienceMax, setExperienceMax] = useState(initialValues.experienceMax);
  const [visaSponsorship, setVisaSponsorship] = useState(initialValues.visaSponsorship);
  const [stemOptOnly, setStemOptOnly] = useState(initialValues.stemOptOnly);
  const [visaType, setVisaType] = useState<VisaType | null>(initialValues.visaType);
  const [workAuthStatus, setWorkAuthStatus] = useState<WorkAuth | null>(
    initialValues.workAuthStatus,
  );
  const [salaryMin, setSalaryMin] = useState<number | null>(initialValues.salaryMin);
  const [currentEmployment, setCurrentEmployment] = useState<Employment | null>(
    initialValues.currentEmployment,
  );
  const [avoidCompanies, setAvoidCompanies] = useState(initialValues.avoidCompanies);

  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<PreferencesFormValues>(initialValues);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const arrayEqual = (a: readonly unknown[], b: readonly unknown[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const dirtyFieldCount = useMemo(() => {
    let count = 0;
    if (!arrayEqual(keywords, savedSnapshot.keywords)) count++;
    if (!arrayEqual(excludeKeywords, savedSnapshot.excludeKeywords)) count++;
    if (!arrayEqual(targetRoles, savedSnapshot.targetRoles)) count++;
    if (!arrayEqual(locations, savedSnapshot.locations)) count++;
    if (!arrayEqual(jobTypes, savedSnapshot.jobTypes)) count++;
    if (experienceMin !== savedSnapshot.experienceMin) count++;
    if (experienceMax !== savedSnapshot.experienceMax) count++;
    if (visaSponsorship !== savedSnapshot.visaSponsorship) count++;
    if (stemOptOnly !== savedSnapshot.stemOptOnly) count++;
    if (visaType !== savedSnapshot.visaType) count++;
    if (workAuthStatus !== savedSnapshot.workAuthStatus) count++;
    if (salaryMin !== savedSnapshot.salaryMin) count++;
    if (currentEmployment !== savedSnapshot.currentEmployment) count++;
    if (!arrayEqual(avoidCompanies, savedSnapshot.avoidCompanies)) count++;
    return count;
     
  }, [
    keywords,
    excludeKeywords,
    targetRoles,
    locations,
    jobTypes,
    experienceMin,
    experienceMax,
    visaSponsorship,
    stemOptOnly,
    visaType,
    workAuthStatus,
    salaryMin,
    currentEmployment,
    avoidCompanies,
    savedSnapshot,
  ]);

  const canSave = keywords.length >= 3 && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedAt(null);

    const input = {
      keywords,
      excludeKeywords,
      targetRoles,
      locations,
      jobTypes,
      experienceMin,
      experienceMax,
      visaSponsorship,
      stemOptOnly,
      visaType,
      workAuthStatus,
      salaryMin,
      currentEmployment,
      avoidCompanies,
      onboardingComplete: true,
    };

    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your preferences");
      return;
    }

    startTransition(async () => {
      const result = await savePreferencesAction(parsed.data, null);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSavedAt(Date.now());
        setSavedSnapshot({
          keywords,
          excludeKeywords,
          targetRoles,
          locations,
          jobTypes,
          experienceMin,
          experienceMax,
          visaSponsorship,
          stemOptOnly,
          visaType,
          workAuthStatus,
          salaryMin,
          currentEmployment,
          avoidCompanies,
        });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Section 1 — Roles */}
      <FormSection
        title="What roles are you looking for?"
        description="We'll match these against job titles and skills."
      >
        <SuggestedChipsRow
          suggestions={suggestedKeywords.filter(
            (s) => !keywords.some((k) => k.toLowerCase() === s.toLowerCase()),
          )}
          onPick={(value) => {
            if (!keywords.includes(value)) setKeywords([...keywords, value]);
          }}
        />
        <ChipInput
          label="Keywords"
          placeholder="e.g. machine learning, react"
          values={keywords}
          onChange={setKeywords}
          suggestions={ROLE_SUGGESTIONS}
          hint="Type to see suggestions, or add your own. At least one required."
        />
        <ChipInput
          label="Target roles"
          placeholder="Specific job titles"
          values={targetRoles}
          onChange={setTargetRoles}
          suggestions={ROLE_SUGGESTIONS}
          maxChips={15}
          hint="Optional. Specific titles you want to target."
        />
        <ChipInput
          label="Exclude keywords"
          placeholder="e.g. senior, manager"
          values={excludeKeywords}
          onChange={setExcludeKeywords}
          hint="Skip jobs mentioning these."
        />
      </FormSection>

      {/* Section 2 — Where */}
      <FormSection title="Where do you want to work?" description="Add cities or 'Remote'.">
        <ChipInput
          label="Locations"
          placeholder="e.g. Remote, San Francisco"
          values={locations}
          onChange={setLocations}
          suggestions={LOCATION_SUGGESTIONS}
          maxChips={15}
          hint="Leave empty to include any US location."
        />
        <JobTypeSelect values={jobTypes} onChange={setJobTypes} />
      </FormSection>

      {/* Section 3 — Experience */}
      <FormSection title="Your experience">
        <ExperienceRange
          min={experienceMin}
          max={experienceMax}
          onChange={(mn, mx) => {
            setExperienceMin(mn);
            setExperienceMax(mx);
          }}
        />
        <SegmentedSelect
          label="Current employment"
          options={EMPLOYMENT_OPTIONS}
          value={currentEmployment}
          onChange={setCurrentEmployment}
        />
      </FormSection>

      {/* Section 4 — Visa */}
      <FormSection
        title="Visa & work authorization"
        description="We'll use this to prioritize sponsor-friendly jobs."
      >
        <RadioCardGroup
          label="Visa type"
          options={VISA_OPTIONS}
          value={visaType}
          onChange={setVisaType}
        />
        <RadioCardGroup
          label="Work authorization status"
          options={WORK_AUTH_OPTIONS}
          value={workAuthStatus}
          onChange={setWorkAuthStatus}
        />
        <PreferenceToggle
          label="I need visa sponsorship"
          description="Show only jobs that sponsor (or don't explicitly refuse)."
          value={visaSponsorship}
          onChange={setVisaSponsorship}
        />
        <PreferenceToggle
          label="STEM OPT only"
          description="Restrict to STEM-OPT-eligible roles."
          value={stemOptOnly}
          onChange={setStemOptOnly}
        />
      </FormSection>

      {/* Section 5 — Salary */}
      <FormSection
        title="Compensation"
        description="Optional. We'll surface roles meeting this minimum."
      >
        <div className="space-y-2">
          <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
            Minimum salary (annual)
          </label>
          <div className="bg-card border-border focus-within:border-accent focus-within:ring-accent/20 flex items-center rounded-md border px-3 py-2 transition-all focus-within:ring-2">
            <span className="text-text-tertiary mr-2 text-sm">$</span>
            <input
              type="number"
              value={salaryMin ?? ""}
              onChange={(e) => setSalaryMin(e.target.value ? Number(e.target.value) : null)}
              placeholder="120000"
              className="text-text-primary placeholder:text-text-tertiary flex-1 bg-transparent text-sm outline-none"
              min={0}
              max={10000000}
              step={5000}
            />
          </div>
        </div>
      </FormSection>

      {/* Section 6 — Avoid */}
      <FormSection
        title="Companies to avoid"
        description="Optional. Free-text — we'll match against company name."
      >
        <ChipInput
          label="Avoid companies"
          placeholder="e.g. Acme Corp"
          values={avoidCompanies}
          onChange={setAvoidCompanies}
          maxChips={30}
        />
      </FormSection>

      {/* Submit row */}
      <div className="border-border flex items-center justify-between border-t pt-6">
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.snappy}
              className="text-sm text-red-400"
            >
              {error}
            </motion.p>
          )}
          {savedAt && !error && (
            <motion.p
              key="saved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.snappy}
              className="text-text-secondary text-sm"
            >
              Saved.
            </motion.p>
          )}
          {!error && !savedAt && (
            <motion.p
              key="hint"
              initial={false}
              animate={{ opacity: 1 }}
              className="text-text-tertiary text-xs"
            >
              {keywords.length < 3
                ? "Add at least " +
                  (3 - keywords.length) +
                  " more keyword" +
                  (3 - keywords.length === 1 ? "" : "s") +
                  " to save."
                : "All set when you're ready."}
            </motion.p>
          )}
        </AnimatePresence>
        <button
          type="submit"
          disabled={!canSave}
          className="bg-accent text-accent-foreground hover:bg-accent-hover rounded-md px-6 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? "Saving…"
            : dirtyFieldCount > 0
              ? `Save changes (${dirtyFieldCount})`
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function SuggestedChipsRow({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (value: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-text-tertiary text-xs tracking-widest uppercase">
        Suggested from your resume
      </p>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {suggestions.map((s) => (
            <motion.button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring.snappy}
              className="border-border text-text-secondary hover:border-accent hover:text-accent inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            >
              <Plus size={12} strokeWidth={2} />
              {s}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <header>
        <h3 className="text-text-primary text-base font-medium">{title}</h3>
        {description && <p className="text-text-tertiary mt-1 text-sm">{description}</p>}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function RadioCardGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; description: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded-md border px-4 py-3 text-left transition-all ${
                active
                  ? "border-accent bg-accent/10 ring-accent/20 ring-2"
                  : "border-border bg-card hover:border-border-strong"
              }`}
            >
              <p className={`text-sm font-medium ${active ? "text-accent" : "text-text-primary"}`}>
                {opt.label}
              </p>
              <p className="text-text-tertiary mt-1 text-xs">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegmentedSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-text-secondary block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <div className="bg-card border-border inline-flex gap-1 rounded-md border p-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
