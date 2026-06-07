"use client";

import { useEffect, useReducer } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/styles/tokens";

type Step = "idle" | "scroll" | "hover" | "click" | "applied";

const CARDS = [
  { role: "Backend Engineer", company: "Ramp", score: 88 },
  { role: "ML Engineer", company: "Anthropic", score: 94 },
  { role: "Data Scientist", company: "Databricks", score: 81 },
];
const HERO_INDEX = 1; // the card the cursor applies to

// Cursor target positions (% of demo box) per step.
const CURSOR_POS: Record<Step, { x: string; y: string }> = {
  idle: { x: "12%", y: "14%" },
  scroll: { x: "50%", y: "40%" },
  hover: { x: "46%", y: "47%" },
  click: { x: "78%", y: "47%" },
  applied: { x: "78%", y: "47%" },
};

const SEQUENCE: { step: Step; delay: number }[] = [
  { step: "scroll", delay: 900 },
  { step: "hover", delay: 1500 },
  { step: "click", delay: 1100 },
  { step: "applied", delay: 700 },
];

function reducer(_: Step, next: Step): Step {
  return next;
}

export function ProductDemo() {
  const reduceMotion = useReducedMotion();
  const [step, dispatch] = useReducer(reducer, reduceMotion ? "applied" : "idle");

  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (const { step: s, delay } of SEQUENCE) {
      elapsed += delay;
      timers.push(setTimeout(() => dispatch(s), elapsed));
    }
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  const applied = step === "applied";
  const scrolled = step !== "idle";

  return (
    <div className="border-border bg-card/40 relative mt-16 h-80 w-full max-w-md overflow-hidden rounded-2xl border p-4">
      {/* mini dashboard header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-text-tertiary text-[10px] font-medium tracking-widest uppercase">
          Your matches
        </span>
        <span className="text-text-tertiary text-[10px] tabular-nums">3 today</span>
      </div>

      {/* card stack — slides up slightly on "scroll" */}
      <motion.div
        className="space-y-2"
        animate={{ y: scrolled ? -8 : 0 }}
        transition={spring.smooth}
      >
        {CARDS.map((card, i) => {
          const isHero = i === HERO_INDEX;
          const lifted = isHero && (step === "hover" || step === "click" || applied);
          return (
            <motion.div
              key={card.company}
              animate={{
                scale: lifted ? 1.03 : 1,
                borderColor: lifted ? "var(--accent)" : "var(--border)",
              }}
              transition={spring.snappy}
              className="bg-card flex items-center gap-3 rounded-lg border p-3"
            >
              {/* score ring */}
              <ScoreDot score={card.score} highlight={lifted} />
              <div className="min-w-0 flex-1">
                <div className="text-text-primary truncate text-xs font-medium">{card.role}</div>
                <div className="text-text-tertiary truncate text-[10px]">{card.company}</div>
              </div>
              {isHero ? (
                <motion.div
                  animate={{ scale: step === "click" ? 0.92 : 1 }}
                  transition={spring.snappy}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${
                    applied ? "bg-success/15 text-success" : "bg-accent text-accent-foreground"
                  }`}
                >
                  {applied ? "Applied" : "Apply"}
                </motion.div>
              ) : (
                <div className="border-border text-text-tertiary rounded-md border px-2.5 py-1 text-[10px]">
                  Apply
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* fake cursor */}
      {!reduceMotion && (
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute z-20 drop-shadow-lg"
          initial={CURSOR_POS.idle}
          animate={CURSOR_POS[step]}
          transition={spring.gentle}
          style={{ translateX: "-2px", translateY: "-2px" }}
        >
          <path
            d="M5 3l14 7-6 2-2 6-6-15z"
            fill="var(--text-primary)"
            stroke="var(--background)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </motion.svg>
      )}
    </div>
  );
}

function ScoreDot({ score, highlight }: { score: number; highlight: boolean }) {
  const r = 12;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <motion.circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={highlight ? "var(--accent)" : "var(--text-tertiary)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - score / 100) }}
        transition={spring.gentle}
        transform="rotate(-90 16 16)"
      />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-text-primary text-[9px] font-semibold tabular-nums"
      >
        {score}
      </text>
    </svg>
  );
}
