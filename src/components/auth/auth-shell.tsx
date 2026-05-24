"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { duration, spring } from "@/styles/tokens";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional footer link (e.g., "Don't have an account?") */
  footer?: {
    text: string;
    linkText: string;
    href: string;
  };
}

/**
 * Reusable wrapper for auth pages.
 * Centers content, applies entrance animation, displays branded header.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.smooth, delay: 0.1 }}
        className="w-full max-w-md"
      >
        {/* Brand mark */}
        <div className="mb-12 text-center">
          <Link href="/" className="inline-block">
            <div className="text-text-tertiary text-sm tracking-wider uppercase">AI Job OS</div>
          </Link>
        </div>

        {/* Title block */}
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-text-primary text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-text-secondary text-sm leading-relaxed">{subtitle}</p>}
        </div>

        {/* Form / content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.medium, delay: 0.2 }}
        >
          {children}
        </motion.div>

        {/* Footer */}
        {footer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: duration.medium, delay: 0.3 }}
            className="text-text-tertiary mt-8 text-center text-sm"
          >
            {footer.text}{" "}
            <Link
              href={footer.href}
              className="text-accent hover:text-accent-hover underline-offset-4 hover:underline"
            >
              {footer.linkText}
            </Link>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
