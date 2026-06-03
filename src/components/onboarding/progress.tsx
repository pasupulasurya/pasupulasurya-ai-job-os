"use client";

import { motion } from "framer-motion";
import { spring } from "@/styles/tokens";

type Props = {
  current: number; // 1-indexed (Step 1 = current=1)
  total: number;
};

export function OnboardingProgress({ current, total }: Props) {
  const pct = Math.min(100, Math.max(0, Math.round((current / total) * 100)));

  return (
    <div className="mb-8 w-full max-w-md">
      <div className="bg-border h-1 w-full overflow-hidden rounded-full">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={spring.snappy}
          className="bg-accent h-full rounded-full"
        />
      </div>
      <div className="text-text-tertiary mt-2 flex items-center justify-between text-xs tracking-widest uppercase">
        <span>
          Step {current} of {total}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}
