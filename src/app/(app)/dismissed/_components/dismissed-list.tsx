"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { undismissMatchAction } from "@/server/actions/match";
import { spring } from "@/styles/tokens";

type Dismissed = {
  id: string;
  score: number;
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string;
};

export function DismissedList({ dismissed: initial }: { dismissed: Dismissed[] }) {
  const [dismissed, setDismissed] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function undismiss(id: string) {
    setDismissed((prev) => prev.filter((d) => d.id !== id));
    startTransition(async () => {
      await undismissMatchAction(id);
    });
  }

  if (dismissed.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Dismissed</h1>
        <p className="text-text-tertiary mt-4 text-sm">
          Nothing dismissed. Jobs you pass on from your dashboard show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-text-primary mb-2 text-2xl font-semibold tracking-tight">Dismissed</h1>
      <p className="text-text-tertiary mb-8 text-sm">
        Jobs you passed on, with their match score. Undismiss to bring one back to your matches.
      </p>
      <div className="space-y-2">
        {dismissed.map((d) => (
          <motion.div
            key={d.id}
            layout
            transition={spring.snappy}
            className="bg-card border-border flex items-center gap-4 rounded-xl border p-4"
          >
            <span className="text-text-tertiary bg-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
              {d.score}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={d.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-accent block truncate text-sm font-medium transition-colors"
              >
                {d.title}
              </a>
              <div className="text-text-tertiary truncate text-xs">
                {d.company}
                {d.location ? " · " + d.location : ""}
              </div>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => undismiss(d.id)}
              className="border-border text-text-secondary hover:border-accent hover:text-accent rounded-md border px-3 py-1 text-xs transition-colors disabled:opacity-50"
            >
              Undismiss
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
