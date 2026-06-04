"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { AuthBanner } from "@/components/auth/auth-banner";
import { ChipInput } from "@/components/onboarding/chip-input";
import { ExperienceRange } from "@/components/onboarding/experience-range";
import { JobTypeSelect } from "@/components/onboarding/job-type-select";
import { PreferenceToggle } from "@/components/onboarding/preference-toggle";
import { preferencesSchema } from "@/shared/schemas/preferences";
import { savePreferencesAction } from "@/server/actions/preferences";
import { spring } from "@/styles/tokens";

type JobType = "full-time" | "internship" | "contract" | "part-time";

type Props = {
  suggestedKeywords?: string[];
  suggestedTargetRoles?: string[];
};

export function PreferencesClientForm({
  suggestedKeywords = [],
  suggestedTargetRoles = [],
}: Props) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [experienceMin, setExperienceMin] = useState<number | null>(null);
  const [experienceMax, setExperienceMax] = useState<number | null>(null);
  const [visaSponsorship, setVisaSponsorship] = useState(true);
  const [stemOptOnly, setStemOptOnly] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter suggestions: hide chips already added to keywords (case-insensitive).
  const lowerKeywords = new Set(keywords.map((k) => k.toLowerCase()));
  const visibleSuggestions = suggestedKeywords.filter((s) => !lowerKeywords.has(s.toLowerCase()));
  const lowerTargetRoles = new Set(targetRoles.map((t) => t.toLowerCase()));
  const visibleRoleSuggestions = suggestedTargetRoles.filter(
    (s) => !lowerTargetRoles.has(s.toLowerCase()),
  );

  function addSuggestion(s: string) {
    setKeywords((prev) => [...prev, s]);
  }

  function addRoleSuggestion(s: string) {
    setTargetRoles((prev) => [...prev, s]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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
    };

    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your preferences");
      return;
    }

    startTransition(async () => {
      const res = await savePreferencesAction(input);
      if (res && "error" in res) {
        setError(res.error);
      }
    });
  }

  return (
    <AuthShell
      title="Tell us what you're hunting for"
      subtitle="We'll match jobs against this — you can edit any time."
      header={<OnboardingProgress current={4} total={4} />}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <AuthBanner variant="error" title="Couldn't save" message={error} />}

        {visibleSuggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-tertiary text-xs tracking-widest uppercase">
              From your resume — tap to add
            </p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {visibleSuggestions.map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring.snappy}
                    onClick={() => addSuggestion(s)}
                    className="border-border text-text-secondary hover:border-accent hover:text-accent inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  >
                    <Plus size={10} strokeWidth={2} />
                    {s}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <ChipInput
          label="Keywords"
          placeholder="e.g. AI, ML, frontend, React"
          hint="Add roles, skills, or tech you want jobs to match."
          values={keywords}
          onChange={setKeywords}
        />

        <ChipInput
          label="Exclude keywords (optional)"
          placeholder="e.g. senior, staff, principal"
          hint="Skip jobs that mention these terms."
          values={excludeKeywords}
          onChange={setExcludeKeywords}
        />

        {visibleRoleSuggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-tertiary text-xs tracking-widest uppercase">
              Roles from your resume — tap to add
            </p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {visibleRoleSuggestions.map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring.snappy}
                    onClick={() => addRoleSuggestion(s)}
                    className="border-border text-text-secondary hover:border-accent hover:text-accent inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  >
                    <Plus size={10} strokeWidth={2} />
                    {s}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <ChipInput
          label="Target roles (optional)"
          placeholder="e.g. Senior ML Engineer, Staff Data Scientist"
          hint="Specific job titles you want to target."
          values={targetRoles}
          onChange={setTargetRoles}
        />

        <ExperienceRange
          min={experienceMin}
          max={experienceMax}
          onChange={(min, max) => {
            setExperienceMin(min);
            setExperienceMax(max);
          }}
        />

        <JobTypeSelect values={jobTypes} onChange={setJobTypes} />

        <ChipInput
          label="Preferred locations (optional)"
          placeholder="e.g. Remote, NYC, SF"
          hint="Leave empty to include any US location."
          values={locations}
          onChange={setLocations}
        />

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.smooth}
          className="space-y-3"
        >
          <PreferenceToggle
            label="I need visa sponsorship"
            description="We'll filter out jobs that explicitly say they don't sponsor."
            value={visaSponsorship}
            onChange={setVisaSponsorship}
          />

          <PreferenceToggle
            label="STEM OPT only"
            description="Only show jobs with STEM OPT–compatible classifications."
            value={stemOptOnly}
            onChange={setStemOptOnly}
          />
        </motion.div>

        <motion.button
          type="submit"
          disabled={isPending}
          whileTap={{ scale: isPending ? 1 : 0.98 }}
          transition={spring.snappy}
          className="bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-pressed flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Saving and re-matching jobs…" : "Save and continue"}
        </motion.button>
      </form>
    </AuthShell>
  );
}
