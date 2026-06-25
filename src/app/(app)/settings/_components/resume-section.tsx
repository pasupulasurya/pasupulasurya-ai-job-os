"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { setMasterResumeAction, deleteResumeAction } from "@/server/actions/resume";
import { ResumeUploadCard } from "./resume-upload-card";
import { spring } from "@/styles/tokens";

export type ResumeRow = {
  id: string;
  fileName: string | null;
  isMaster: boolean;
  parsedAt: Date | null;
  fileSize: number | null;
  createdAt: Date;
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBytes(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

export function ResumeSection({ resumes }: { resumes: ResumeRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    fileName: string;
    matchSummary?: { jobsConsidered: number; upserted: number; scoredAbove: number };
  } | null>(null);
  const [, startTransition] = useTransition();

  function handleMakeMaster(row: ResumeRow) {
    setError(null);
    setToast(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await setMasterResumeAction(row.id);
      setPendingId(null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setToast({ fileName: row.fileName ?? "Resume", matchSummary: res.matchSummary });
      router.refresh();
    });
  }

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Track optimistically-removed rows. The list is DERIVED from the `resumes`
  // prop on every render (never mirrored into state), so uploads / make-master
  // that trigger router.refresh() update it automatically. deletedIds only
  // covers the brief window between clicking Delete and the refresh landing.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const visibleRows = resumes.filter((r) => !deletedIds.has(r.id));

  function handleDelete(row: ResumeRow) {
    setError(null);
    setToast(null);
    setDeletingId(row.id);
    setConfirmingId(null);
    startTransition(async () => {
      const res = await deleteResumeAction(row.id);
      setDeletingId(null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Optimistically hide the row, then refresh from the server (which will
      // return the list without it, making the deletedIds entry a no-op).
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
      router.refresh();
    });
  }

  if (visibleRows.length === 0) {
    return (
      <div className="space-y-4">
        <ResumeUploadCard />
        <div className="bg-card border-border rounded-2xl border p-5">
          <p className="text-text-secondary text-sm">No resumes yet.</p>
          <p className="text-text-tertiary mt-2 text-xs">
            Upload your first resume to get matched against jobs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResumeUploadCard />
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="border-accent/30 bg-accent/5 text-text-secondary rounded-lg border px-4 py-3 text-sm"
          >
            {toast.matchSummary
              ? `Master switched to ${toast.fileName}. Re-scored ${toast.matchSummary.jobsConsidered} jobs · ${toast.matchSummary.scoredAbove} above threshold.`
              : `Master switched to ${toast.fileName}.`}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border">
        {visibleRows.map((row) => {
          const isPending = pendingId === row.id;
          return (
            <div key={row.id} className="flex items-center gap-4 p-4">
              <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <FileText size={18} strokeWidth={1.5} className="text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`truncate text-sm font-medium ${row.isMaster ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    {row.fileName ?? "Untitled resume"}
                  </p>
                  {row.isMaster && (
                    <span className="border-accent/40 text-accent inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                      Master
                    </span>
                  )}
                </div>
                <p className="text-text-tertiary mt-0.5 text-xs">
                  {row.parsedAt
                    ? `Parsed ${formatDate(row.parsedAt)}`
                    : `Added ${formatDate(row.createdAt)}`}
                  {row.fileSize ? ` · ${formatBytes(row.fileSize)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {row.isMaster ? (
                  <span className="text-text-tertiary text-xs">Active</span>
                ) : confirmingId === row.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-text-tertiary text-xs">Delete?</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={pendingId !== null || deletingId !== null}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-400 transition-colors hover:text-red-300 disabled:opacity-40"
                    >
                      {deletingId === row.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleMakeMaster(row)}
                      disabled={isPending || pendingId !== null}
                      className="text-text-secondary hover:text-accent inline-flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pendingId === row.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      {pendingId === row.id ? "Switching…" : "Make master"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(row.id)}
                      disabled={pendingId !== null || deletingId !== null}
                      aria-label="Delete resume"
                      title="Delete this resume"
                      className="text-text-tertiary inline-flex items-center transition-colors hover:text-red-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-text-tertiary text-xs">
        Switching master re-scores all your matches against the new resume.
      </p>
    </div>
  );
}
