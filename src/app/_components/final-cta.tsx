"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { spring } from "@/styles/tokens";

export function FinalCta() {
  return (
    <section className="relative w-full px-6 py-40">
      {/* warm closing glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, var(--accent) 0%, var(--success) 60%, transparent 80%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={spring.gentle}
        className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center"
      >
        <h2 className="text-text-primary text-4xl font-bold tracking-[-0.03em] sm:text-6xl">
          Ready to stop scrolling?
        </h2>
        <p className="text-text-secondary mt-6 max-w-md text-base leading-relaxed sm:text-lg">
          Set up your profile once. We&apos;ll surface the roles worth your time — free, while
          we&apos;re in beta.
        </p>
        <Link
          href="/signup"
          className="bg-accent text-accent-foreground hover:bg-accent-hover mt-10 rounded-md px-8 py-4 text-base font-medium transition-colors"
        >
          Get started
        </Link>
      </motion.div>
    </section>
  );
}
