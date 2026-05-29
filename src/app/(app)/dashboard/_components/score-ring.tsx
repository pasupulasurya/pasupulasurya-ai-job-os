"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useTransform, useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";

type ScoreRingProps = {
  score: number; // 0..100
};

const SIZE = 48;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({ score }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const reducedMotion = useReducedMotion();

  // Motion value driving both the number and the ring fill.
  const progress = useMotionValue(reducedMotion ? clamped : 0);
  const displayNumber = useTransform(progress, (v) => Math.round(v));
  const strokeOffset = useTransform(progress, (v) => CIRCUMFERENCE * (1 - v / 100));

  const [shown, setShown] = useState(reducedMotion ? Math.round(clamped) : 0);

  useEffect(() => {
    const unsubscribe = displayNumber.on("change", (latest) => setShown(latest));
    return () => unsubscribe();
  }, [displayNumber]);

  useEffect(() => {
    if (reducedMotion) return;
    const controls = animate(progress, clamped, {
      type: "spring",
      stiffness: 120,
      damping: 20,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highScore = clamped >= 70;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      aria-label={`Match score ${Math.round(clamped)} out of 100`}
      role="img"
    >
      <svg
        width={SIZE}
        height={SIZE}
        className={highScore ? "drop-shadow-[0_0_8px_rgba(10,132,255,0.5)]" : ""}
      >
        {/* Background ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={STROKE}
        />
        {/* Foreground ring */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#0A84FF"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: strokeOffset }}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="absolute text-sm font-medium text-[#0A84FF] tabular-nums" aria-hidden="true">
        {shown}
      </span>
    </div>
  );
}
