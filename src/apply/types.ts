// 2H apply engine — shared types.
// PURE browser-context module: no Node, no Prisma, no server imports.
// This file ships verbatim into the Chrome extension in 2H.1.

export type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "file"
  | "unknown";

export interface DetectedField {
  /** Stable index into the engine's element registry for this scan. */
  ref: number;
  kind: FieldKind;
  /** Best-effort human label (label[for], aria-label, placeholder, name). */
  label: string;
  name: string;
  /** Element id — Greenhouse's primary field identifier. */
  id: string;
  required: boolean;
  /** Current value, to skip fields the portal's own autofill already set. */
  currentValue: string;
  /** For selects/radios: the visible option labels. */
  options?: string[];
}

export type PlannedAction =
  | { ref: number; action: "fill"; value: string; sourceKey: ProfileKey }
  | { ref: number; action: "select"; optionLabel: string; sourceKey: ProfileKey }
  | { ref: number; action: "upload_resume" }
  | { ref: number; action: "skip_prefilled" }
  | { ref: number; action: "defer_to_human"; reason: string };

/** Keys an answer may trace to. NOTHING outside this set is ever filled. */
export type ProfileKey =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "website";

export interface ApplicantProfile {
  values: Partial<Record<ProfileKey, string>>;
}

export interface FillResult {
  filled: number;
  skippedPrefilled: number;
  deferred: { label: string; reason: string }[];
}
