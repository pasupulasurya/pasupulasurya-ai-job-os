"use client";

import { useEffect, useReducer } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { spring } from "@/styles/tokens";

type Step = "idle" | "card0" | "card1" | "card2" | "return" | "click" | "applied";

const CARDS = [
  { role: "Backend Engineer", company: "Ramp", score: 88, hue: "var(--accent)" },
  { role: "ML Engineer", company: "Anthropic", score: 94, hue: "var(--success)" },
  { role: "Data Scientist", company: "Databricks", score: 81, hue: "var(--warning)" },
];
const HERO_INDEX = 1;

// Which card index is "active" (lifted/colored) at each step.
const ACTIVE_AT: Partial<Record<Step, number>> = {
  card0: 0,
  card1: 1,
  card2: 2,
  return: HERO_INDEX,
  click: HERO_INDEX,
  applied: HERO_INDEX,
};

const SEQUENCE: { step: Step; delay: number }[] = [
  { step: "card0", delay: 700 },
  { step: "card1", delay: 1100 },
  { step: "card2", delay: 1100 },
  { step: "return", delay: 1100 },
  { step: "click", delay: 900 },
  { step: "applied", delay: 600 },
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

  const activeIdx = ACTIVE_AT[step] ?? -1;
  const applied = step === "applied";

  return (
    <div className="relative mt-20 w-full max-w-2xl">
      {/* ambient multi-hue glow behind the stage */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 opacity-40 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 70% 70%, var(--success) 0%, transparent 50%)",
        }}
      />

      {/* the stage */}
      <div className="border-border-strong bg-surface/80 relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-text-secondary text-xs font-medium tracking-widest uppercase">
            Your matches
          </span>
          <span className="text-text-tertiary text-xs tabular-nums">3 today</span>
        </div>

        <div className="space-y-3">
          {CARDS.map((card, i) => {
            const isActive = i === activeIdx;
            const isHero = i === HERO_INDEX;
            return (
              <motion.div
                key={card.company}
                animate={{
                  scale: isActive ? 1.04 : 1,
                  y: isActive ? -2 : 0,
                  borderColor: isActive ? card.hue : "var(--border)",
                  boxShadow: isActive ? `0 12px 32px -8px ${card.hue}66` : "0 0 0 0 transparent",
                }}
                transition={spring.snappy}
                className="bg-card relative flex items-center gap-4 rounded-xl border p-4"
              >
                <ScoreRing score={card.score} color={card.hue} active={isActive} />
                <div className="min-w-0 flex-1">
                  <div className="text-text-primary truncate text-sm font-medium">{card.role}</div>
                  <div className="text-text-tertiary truncate text-xs">{card.company}</div>
                </div>
                {isHero ? (
                  <div className="relative">
                    <motion.div
                      animate={{ scale: step === "click" ? 0.9 : 1 }}
                      transition={spring.snappy}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold ${
                        applied ? "bg-success/20 text-success" : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {applied ? "Applied" : "Apply"}
                    </motion.div>
                    <AnimatePresence>{applied && <Confetti />}</AnimatePresence>
                  </div>
                ) : (
                  <div className="border-border text-text-tertiary rounded-lg border px-4 py-2 text-xs">
                    Apply
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, color, active }: { score: number; color: string; active: boolean }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={active ? color : "var(--text-tertiary)"}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - score / 100) }}
        transition={spring.gentle}
        transform="rotate(-90 22 22)"
      />
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-text-primary text-[11px] font-semibold tabular-nums"
      >
        {score}
      </text>
    </svg>
  );
}

function Confetti() {
  const colors = ["var(--accent)", "var(--success)", "var(--warning)", "var(--danger)"];
  const pieces = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 z-30">
      {pieces.map((i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 40 + (i % 4) * 14;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist + 20,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
