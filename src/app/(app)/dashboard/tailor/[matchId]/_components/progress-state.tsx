"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const PHASES = [
  "Analyzing skill gaps…",
  "Rewriting your summary…",
  "Tailoring role bullets…",
  "Verifying every claim against your master…",
  "Almost there…",
];

// ~60s generation: rotate phases every 12s. Purely cosmetic — the real
// work is one server action; we can't stream progress from it (yet).
export function ProgressState() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 12000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
      <motion.div
        className="h-10 w-10 rounded-full border-2 border-white/10 border-t-[#0A84FF]"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <motion.p
        key={phase}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-white/60"
      >
        {PHASES[phase]}
      </motion.p>
      <p className="text-xs text-white/30">This takes about a minute. Every claim is verified.</p>
    </div>
  );
}
