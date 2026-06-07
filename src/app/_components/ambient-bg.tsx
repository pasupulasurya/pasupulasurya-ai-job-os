"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Page-wide ambient atmosphere — large, soft, slow-drifting gradient orbs.
 * Sits behind all content (-z-10), pointer-events-none. Killed under
 * prefers-reduced-motion: orbs render static at their start position.
 */
export function AmbientBg() {
  const reduce = useReducedMotion();

  const drift = (path: { x: number[]; y: number[] }, duration: number) =>
    reduce
      ? {}
      : {
          x: path.x,
          y: path.y,
          transition: {
            duration,
            repeat: Infinity,
            repeatType: "mirror" as const,
            ease: "easeInOut" as const,
          },
        };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute h-[40vw] w-[40vw] rounded-full opacity-[0.20] blur-[110px]"
        style={{ background: "var(--accent)", top: "5%", left: "10%" }}
        animate={drift({ x: [0, 60, -30, 0], y: [0, -40, 30, 0] }, 22)}
      />
      <motion.div
        className="absolute h-[35vw] w-[35vw] rounded-full opacity-[0.16] blur-[110px]"
        style={{ background: "var(--success)", top: "50%", left: "60%" }}
        animate={drift({ x: [0, -50, 40, 0], y: [0, 40, -30, 0] }, 26)}
      />
      <motion.div
        className="absolute h-[30vw] w-[30vw] rounded-full opacity-[0.14] blur-[110px]"
        style={{ background: "#bf5af2", top: "75%", left: "20%" }}
        animate={drift({ x: [0, 40, -40, 0], y: [0, -30, 20, 0] }, 30)}
      />
    </div>
  );
}
