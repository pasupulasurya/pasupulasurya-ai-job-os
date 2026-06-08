"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/shared/data/application-status";
import { updateApplicationStatusAction } from "@/server/actions/application";
import { spring } from "@/styles/tokens";

type Item = {
  id: string;
  status: string;
  appliedAt: string | null;
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string;
};

export function ApplicationsList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function changeStatus(id: string, newStatus: ApplicationStatus) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
    startTransition(async () => {
      await updateApplicationStatusAction(id, newStatus);
    });
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-text-tertiary mt-4 text-sm">
          Nothing here yet. Apply to a match from your dashboard and it will show up here to track.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-text-primary mb-8 text-2xl font-semibold tracking-tight">Applications</h1>

      <div className="space-y-10">
        {APPLICATION_STATUSES.map((status) => {
          const group = items.filter((it) => it.status === status);
          if (group.length === 0) return null;
          return (
            <section key={status}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-text-secondary text-xs font-semibold tracking-widest uppercase">
                  {APPLICATION_STATUS_LABELS[status]}
                </h2>
                <span className="text-text-tertiary text-xs tabular-nums">{group.length}</span>
              </div>

              <div className="space-y-2">
                {group.map((it) => (
                  <motion.div
                    key={it.id}
                    layout
                    transition={spring.snappy}
                    className="bg-card border-border flex items-center gap-4 rounded-xl border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={it.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-primary hover:text-accent block truncate text-sm font-medium transition-colors"
                      >
                        {it.title}
                      </a>
                      <div className="text-text-tertiary truncate text-xs">
                        {it.company}
                        {it.location ? " \u00b7 " + it.location : ""}
                      </div>
                    </div>

                    <select
                      value={it.status}
                      disabled={isPending}
                      onChange={(e) => changeStatus(it.id, e.target.value as ApplicationStatus)}
                      className="bg-surface border-border text-text-secondary rounded-md border px-2 py-1 text-xs outline-none disabled:opacity-50"
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {APPLICATION_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
