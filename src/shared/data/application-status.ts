// Single source of truth for application lifecycle statuses.
// Stored lowercase+underscore in Application.status; labels are display-only.

export const APPLICATION_STATUSES = [
  "applied",
  "under_consideration",
  "interview",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  under_consideration: "Under Consideration",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
