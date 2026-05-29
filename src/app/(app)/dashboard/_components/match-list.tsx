"use client";

import { motion } from "framer-motion";
import { spring } from "@/styles/tokens";
import { MatchCard, type MatchCardProps } from "./match-card";

type MatchListProps = {
  matches: MatchCardProps[];
};

const containerVariants = {
  hidden: { opacity: 1 }, // parent doesn't animate itself — only orchestrates children
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 80ms between cards
      delayChildren: 0.05, // small lead-in before first card
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.smooth,
  },
};

export function MatchList({ matches }: MatchListProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {matches.map((m) => (
        <motion.div key={m.matchId} variants={itemVariants}>
          <MatchCard {...m} />
        </motion.div>
      ))}
    </motion.div>
  );
}
