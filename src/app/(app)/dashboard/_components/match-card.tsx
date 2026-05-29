"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, ExternalLink, CheckCircle2, ChevronDown } from "lucide-react";
import { ScoreRing } from "./score-ring";
import { ScoreBreakdown } from "./score-breakdown";
import { spring } from "@/styles/tokens";
import {
  markMatchViewedAction,
  dismissMatchAction,
  markMatchAppliedAction,
} from "@/server/actions/match";

export type MatchCardProps = {
  matchId: string;
  score: number;
  status: string; // "fresh" | "viewed" | "applied" | "dismissed" | "rejected"
  reason: string | null;
  scoreBreakdown: unknown;
  job: {
    title: string;
    company: string;
    location: string | null;
    remote: boolean;
    sourceUrl: string;
  };
};

type LocalState = "visible" | "dismissed";

export function MatchCard(props: MatchCardProps) {
  const [localState, setLocalState] = useState<LocalState>("visible");
  const [localStatus, setLocalStatus] = useState(props.status);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  if (localState === "dismissed") return null;

  const handleView = () => {
    if (localStatus === "viewed" || localStatus === "applied") return;
    setLocalStatus("viewed");
    startTransition(async () => {
      const result = await markMatchViewedAction(props.matchId);
      if ("error" in result) setLocalStatus(props.status); // revert
    });
  };

  const handleDismiss = () => {
    setLocalState("dismissed");
    startTransition(async () => {
      const result = await dismissMatchAction(props.matchId);
      if ("error" in result) setLocalState("visible"); // revert
    });
  };

  const handleApply = () => {
    window.open(props.job.sourceUrl, "_blank", "noopener,noreferrer");
    setLocalStatus("applied");
    startTransition(async () => {
      const result = await markMatchAppliedAction(props.matchId);
      if ("error" in result) setLocalStatus(props.status); // revert
    });
  };

  const locationStr = props.job.remote
    ? props.job.location
      ? `${props.job.location} · Remote`
      : "Remote"
    : (props.job.location ?? "");

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.05]">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-medium text-white">{props.job.title}</h2>
          <p className="mt-1 text-sm text-white/60">
            {props.job.company}
            {locationStr && <span className="text-white/40"> · {locationStr}</span>}
          </p>
        </div>
        <div className="shrink-0">
          <ScoreRing score={props.score} />
        </div>
      </header>

      {props.reason && <p className="mb-5 text-sm leading-relaxed text-white/75">{props.reason}</p>}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="breakdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <ScoreBreakdown data={props.scoreBreakdown} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {localStatus === "viewed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-white/50">
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> Viewed
            </span>
          )}
          {localStatus === "applied" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0A84FF]/10 px-2 py-1 text-xs text-[#0A84FF]">
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> Applied
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/80"
          >
            {expanded ? "Hide details" : "Why this score?"}
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              className={"transition-transform " + (expanded ? "rotate-180" : "")}
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={handleView}
            aria-label="Mark as viewed"
            disabled={localStatus === "viewed" || localStatus === "applied"}
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/80 disabled:opacity-30"
          >
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={handleApply}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A84FF] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0A84FF]/90"
          >
            Apply <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </footer>
    </article>
  );
}
