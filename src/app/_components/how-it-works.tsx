"use client";

import { motion } from "framer-motion";
import { Globe, Sparkles, Target, Send } from "lucide-react";
import { spring } from "@/styles/tokens";

const STAGES = [
  {
    icon: Globe,
    label: "01",
    name: "Scrape",
    copy: "We pull fresh roles from ~30 sponsor-friendly companies, every day.",
    hue: "var(--accent)",
  },
  {
    icon: Sparkles,
    label: "02",
    name: "Enrich",
    copy: "AI reads each posting and extracts skills, seniority, and visa signals.",
    hue: "#bf5af2",
  },
  {
    icon: Target,
    label: "03",
    name: "Match",
    copy: "Every role is scored against your profile across six dimensions.",
    hue: "var(--success)",
  },
  {
    icon: Send,
    label: "04",
    name: "Apply",
    copy: "You review your top matches and apply. Nothing is auto-submitted.",
    hue: "var(--warning)",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const card = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
};

export function HowItWorks() {
  return (
    <section className="relative w-full px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-text-primary mb-16 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works.{" "}
          <span className="text-text-tertiary">From job board to applied, automatically.</span>
        </h2>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.name}
                variants={card}
                className="group bg-card relative flex flex-col overflow-hidden rounded-3xl border p-7 transition-all duration-300"
                style={{ borderColor: "var(--border)" }}
                whileHover={{ y: -6 }}
              >
                {/* per-stage glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-40"
                  style={{ background: stage.hue }}
                />

                <div className="relative z-10 flex flex-col">
                  <span className="text-text-tertiary mb-6 text-xs font-semibold tracking-[0.2em] tabular-nums">
                    {stage.label}
                  </span>

                  <h3 className="text-text-primary mb-3 text-2xl font-semibold tracking-tight">
                    {stage.name}
                  </h3>

                  <p className="text-text-secondary mb-10 text-sm leading-relaxed">{stage.copy}</p>

                  {/* hero element — large iconized tile in the stage hue */}
                  <div
                    className="mt-auto flex h-28 items-center justify-center rounded-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${stage.hue}22, transparent)`,
                      border: `1px solid ${stage.hue}33`,
                    }}
                  >
                    <Icon size={40} strokeWidth={1.5} style={{ color: stage.hue }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
