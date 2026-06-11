"use client";

import { useState, useTransition } from "react";
import { saveApplyProfileAction } from "@/server/actions/apply-profile";
import type { ApplyProfileInput } from "@/shared/schemas/apply-profile";

/** Pill-row selector. null = unanswered (nothing highlighted) — the
 *  fill engine defers unanswered fields to the human. Never preselects. */
function OptionRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-text-primary text-sm">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? null : opt.value)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-text-secondary hover:border-border-strong"
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

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const DECLINE = { value: "decline", label: "Prefer not to answer" };
const YES_NO_DECLINE = [...YES_NO, DECLINE];
const DEGREE_OPTIONS = [
  { value: "high_school", label: "High School" },
  { value: "associate", label: "Associate" },
  { value: "bachelors", label: "Bachelor's" },
  { value: "masters", label: "Master's" },
  { value: "doctorate", label: "Doctorate" },
];
const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  DECLINE,
];
const RACE_OPTIONS = [
  { value: "american_indian_alaska_native", label: "American Indian or Alaska Native" },
  { value: "asian", label: "Asian" },
  { value: "black_african_american", label: "Black or African American" },
  { value: "native_hawaiian_pacific_islander", label: "Native Hawaiian or Pacific Islander" },
  { value: "white", label: "White" },
  { value: "two_or_more", label: "Two or more races" },
  DECLINE,
];
const VETERAN_OPTIONS = [
  { value: "not_veteran", label: "I am not a veteran" },
  { value: "veteran", label: "I am a veteran" },
  DECLINE,
];

/** Boolean DB fields surface as yes/no pills; map at the edges. */
function boolToPill(v: boolean | null): string | null {
  return v === null ? null : v ? "yes" : "no";
}
function pillToBool(v: string | null): boolean | null {
  return v === null ? null : v === "yes";
}

export function ApplyProfileForm({
  initial,
  suggestedSchool,
  suggestedLinks,
}: {
  initial: ApplyProfileInput;
  suggestedSchool: string | null;
  suggestedLinks: { linkedin: string | null; github: string | null; portfolio: string | null };
}) {
  const [form, setForm] = useState<ApplyProfileInput>(initial);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function set<K extends keyof ApplyProfileInput>(key: K, value: ApplyProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveApplyProfileAction(form);
      setToast("error" in result ? result.error : "Saved.");
    });
  }

  return (
    <div className="space-y-8">
      <div className="bg-card border-border space-y-5 rounded-md border p-5">
        <OptionRow
          label="Are you legally authorized to work in the United States?"
          options={YES_NO}
          value={boolToPill(form.workAuthorizedUS)}
          onChange={(v) => set("workAuthorizedUS", pillToBool(v))}
        />
        <OptionRow
          label="Will you now or in the future require sponsorship for employment visa status?"
          options={YES_NO}
          value={boolToPill(form.requiresSponsorship)}
          onChange={(v) => set("requiresSponsorship", pillToBool(v))}
        />
        <OptionRow
          label="Are you at least 18 years of age?"
          options={YES_NO}
          value={boolToPill(form.over18)}
          onChange={(v) => set("over18", pillToBool(v))}
        />
      </div>

      <div className="bg-card border-border space-y-5 rounded-md border p-5">
        <OptionRow
          label="Highest level of education"
          options={DEGREE_OPTIONS}
          value={form.degreeLevel}
          onChange={(v) => set("degreeLevel", v as ApplyProfileInput["degreeLevel"])}
        />
        <div className="space-y-2">
          <label htmlFor="schoolName" className="text-text-primary block text-sm">
            School
          </label>
          <input
            id="schoolName"
            type="text"
            value={form.schoolName ?? ""}
            onChange={(e) => set("schoolName", e.target.value || null)}
            className="bg-background border-border text-text-primary w-full rounded-md border px-3 py-2 text-sm"
          />
          {suggestedSchool && !form.schoolName && (
            <button
              type="button"
              onClick={() => set("schoolName", suggestedSchool)}
              className="text-accent text-xs"
            >
              From your resume: {suggestedSchool}
            </button>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="gradYear" className="text-text-primary block text-sm">
            Graduation year
          </label>
          <input
            id="gradYear"
            type="number"
            value={form.graduationYear ?? ""}
            onChange={(e) =>
              set("graduationYear", e.target.value === "" ? null : Number(e.target.value))
            }
            className="bg-background border-border text-text-primary w-32 rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="bg-card border-border space-y-5 rounded-md border p-5">
        <p className="text-text-tertiary text-xs leading-relaxed">
          US employers ask these optional self-identification questions. Your answers are copied
          exactly as you set them here, and you can change them anytime. Choosing &quot;Prefer not
          to answer&quot; selects &quot;decline to self-identify&quot; on application forms.
        </p>
        <OptionRow
          label="Gender"
          options={GENDER_OPTIONS}
          value={form.gender}
          onChange={(v) => set("gender", v as ApplyProfileInput["gender"])}
        />
        <OptionRow
          label="Are you Hispanic or Latino?"
          options={YES_NO_DECLINE}
          value={form.hispanicLatino}
          onChange={(v) => set("hispanicLatino", v as ApplyProfileInput["hispanicLatino"])}
        />
        <OptionRow
          label="Race / ethnicity"
          options={RACE_OPTIONS}
          value={form.raceEthnicity}
          onChange={(v) => set("raceEthnicity", v as ApplyProfileInput["raceEthnicity"])}
        />
        <OptionRow
          label="Veteran status"
          options={VETERAN_OPTIONS}
          value={form.veteranStatus}
          onChange={(v) => set("veteranStatus", v as ApplyProfileInput["veteranStatus"])}
        />
        <OptionRow
          label="Do you have a disability?"
          options={YES_NO_DECLINE}
          value={form.disabilityStatus}
          onChange={(v) => set("disabilityStatus", v as ApplyProfileInput["disabilityStatus"])}
        />
      </div>

      <div className="bg-card border-border space-y-5 rounded-md border p-5">
        <TextField
          id="linkedinUrl"
          label="LinkedIn URL"
          value={form.linkedinUrl}
          suggestion={suggestedLinks.linkedin}
          onChange={(v) => set("linkedinUrl", v)}
        />
        <TextField
          id="githubUrl"
          label="GitHub URL"
          value={form.githubUrl}
          suggestion={suggestedLinks.github}
          onChange={(v) => set("githubUrl", v)}
        />
        <TextField
          id="portfolioUrl"
          label="Portfolio URL"
          value={form.portfolioUrl}
          suggestion={suggestedLinks.portfolio}
          onChange={(v) => set("portfolioUrl", v)}
        />
      </div>

      <div className="bg-card border-border space-y-5 rounded-md border p-5">
        <TextField
          id="salaryExpectation"
          label="Salary expectation"
          value={form.salaryExpectation}
          placeholder='e.g. "Negotiable"'
          onChange={(v) => set("salaryExpectation", v)}
        />
        <TextField
          id="earliestStartDate"
          label="Earliest start date / notice period"
          value={form.earliestStartDate}
          placeholder='e.g. "2 weeks"'
          onChange={(v) => set("earliestStartDate", v)}
        />
        <OptionRow
          label="Willing to relocate?"
          options={YES_NO}
          value={boolToPill(form.willingToRelocate)}
          onChange={(v) => set("willingToRelocate", pillToBool(v))}
        />
        <OptionRow
          label="Have you previously been employed by the company you apply to? (general answer — deferred to you when it matters)"
          options={YES_NO}
          value={boolToPill(form.previouslyEmployed)}
          onChange={(v) => set("previouslyEmployed", pillToBool(v))}
        />
        <TextField
          id="referredByEmployee"
          label="Referred by an employee (name)"
          value={form.referredByEmployee}
          onChange={(v) => set("referredByEmployee", v)}
        />
        <TextField
          id="howDidYouHear"
          label="How did you hear about us — default answer"
          value={form.howDidYouHear}
          placeholder='e.g. "Job board"'
          onChange={(v) => set("howDidYouHear", v)}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="bg-accent rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save answers"}
        </button>
        {toast && <span className="text-text-tertiary text-xs">{toast}</span>}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  suggestion,
  placeholder,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  suggestion?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-text-primary block text-sm">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-background border-border text-text-primary w-full rounded-md border px-3 py-2 text-sm"
      />
      {suggestion && !value && (
        <button type="button" onClick={() => onChange(suggestion)} className="text-accent text-xs">
          From your resume: {suggestion}
        </button>
      )}
    </div>
  );
}
