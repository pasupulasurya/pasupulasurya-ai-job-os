"use client";

import { motion } from "framer-motion";
import { FileText, Wand2, Inbox } from "lucide-react";
import { spring } from "@/styles/tokens";

const ITEMS = [
  {
    icon: FileText,
    name: "Resume tailoring",
    copy: "Generate a tailored resume for any match — re-emphasizing your real experience, never inventing it.",
  },
  {
    icon: Wand2,
    name: "Application auto-fill",
    copy: "Let the assistant fill applications for you. You review and submit, always.",
  },
  {
    icon: Inbox,
    name: "Email intelligence",
    copy: "Track every application's status straight from your inbox.",
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
};

export function WhatsNext() {
  return (
    <section className="relative w-full px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-text-primary mb-16 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          What&apos;s next.{" "}
          <span className="text-text-tertiary">The roadmap we&apos;re building toward.</span>
        </h2>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 gap-5 md:grid-cols-3"
        >
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <motion.div
                key={it.name}
                variants={item}
                className="bg-surface/50 relative flex flex-col rounded-2xl border p-6"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <Icon size={22} strokeWidth={1.5} className="text-text-tertiary" />
                  <span className="border-border text-text-tertiary rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-widest uppercase">
                    Coming soon
                  </span>
                </div>
                <h3 className="text-text-primary mb-2 text-base font-medium">{it.name}</h3>
                <p className="text-text-tertiary text-sm leading-relaxed">{it.copy}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
