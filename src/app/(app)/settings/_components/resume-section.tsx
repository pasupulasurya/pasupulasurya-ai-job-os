"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2 } from "lucide-react";
import { setMasterResumeAction } from "@/server/actions/resume";
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

  if (resumes.length === 0) {
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
        {resumes.map((row) => {
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
              <div className="shrink-0">
                {row.isMaster ? (
                  <span className="text-text-tertiary text-xs">Active</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMakeMaster(row)}
                    disabled={isPending || pendingId !== null}
                    className="text-text-secondary hover:text-accent inline-flex items-center gap-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    {isPending ? "Switching…" : "Make master"}
                  </button>
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
