"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, ExternalLink, CheckCircle2, ChevronDown, Wand2 } from "lucide-react";
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
  status: string;
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

  const handleView = () => {
    if (localStatus === "viewed" || localStatus === "applied") return;
    setLocalStatus("viewed");
    startTransition(async () => {
      const result = await markMatchViewedAction(props.matchId);
      if ("error" in result) setLocalStatus(props.status);
    });
  };

  const handleDismiss = () => {
    setLocalState("dismissed");
    startTransition(async () => {
      const result = await dismissMatchAction(props.matchId);
      if ("error" in result) setLocalState("visible");
    });
  };

  const handleApply = () => {
    setLocalStatus("applied");
    startTransition(async () => {
      const result = await markMatchAppliedAction(props.matchId);
      if ("error" in result) setLocalStatus(props.status);
    });
  };

  const locationStr = props.job.remote
    ? props.job.location
      ? `${props.job.location} · Remote`
      : "Remote"
    : (props.job.location ?? "");

  const ApplyTag = "a";

  return (
    <AnimatePresence>
      {localState === "visible" && (
        <motion.article
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
          whileHover={{ y: -3 }}
          transition={spring.smooth}
          className="group rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-7 transition-[border-color,box-shadow] duration-300 hover:border-[#0A84FF]/35 hover:shadow-[0_0_0_1px_rgba(10,132,255,0.15),0_12px_32px_rgba(0,0,0,0.45),0_4px_16px_rgba(10,132,255,0.12)]"
        >
          <header className="mb-4 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] leading-snug font-semibold tracking-tight text-white">
                {props.job.title}
              </h2>
              <p className="mt-1.5 text-sm text-white/45">
                {props.job.company}
                {locationStr && <span className="text-white/35"> · {locationStr}</span>}
              </p>
            </div>
            <div className="shrink-0">
              <ScoreRing score={props.score} size={52} />
            </div>
          </header>

          {props.reason && (
            <p className="mb-5 max-w-[68ch] text-sm leading-relaxed text-white/70">
              {props.reason}
            </p>
          )}

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

          <div className="mt-1 mb-4 flex items-center gap-3">
            {localStatus === "viewed" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-white/50"
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> Viewed
              </motion.span>
            )}
            {localStatus === "applied" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-[#0A84FF]/10 px-2 py-1 text-xs text-[#0A84FF]"
              >
                <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} /> Applied
              </motion.span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/85"
            >
              {expanded ? "Hide details" : "Why this score?"}
              <ChevronDown
                size={12}
                strokeWidth={1.5}
                className={"transition-transform duration-200 " + (expanded ? "rotate-180" : "")}
              />
            </button>
            <div className="ml-auto flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleDismiss}
                aria-label="Dismiss"
                className="flex size-9 items-center justify-center rounded-[10px] text-white/35 transition-colors hover:bg-[rgba(255,69,58,0.14)] hover:text-[#FF453A]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleView}
                aria-label="Mark as viewed"
                disabled={localStatus === "viewed" || localStatus === "applied"}
                className="flex size-9 items-center justify-center rounded-[10px] text-white/35 transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white disabled:opacity-30"
              >
                <Eye className="h-4 w-4" strokeWidth={1.5} />
              </motion.button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/tailor/${props.matchId}`}
              className="inline-flex items-center gap-2 px-1 py-3 text-sm font-medium text-white/60 transition-colors hover:text-[#0A84FF]"
            >
              <Wand2 className="h-4 w-4" strokeWidth={1.5} /> Tailor
            </Link>
            <motion.div whileTap={{ scale: 0.97 }} className="ml-auto">
              <ApplyTag
                href={props.job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleApply}
                className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-xl bg-[#0A84FF] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#0A84FF]/90"
              >
                Apply <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              </ApplyTag>
            </motion.div>
          </div>
        </motion.article>
      )}
    </AnimatePresence>
  );
}
