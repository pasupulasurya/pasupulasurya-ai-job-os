"use client";

import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { spring } from "@/styles/tokens";

interface SubmitButtonProps {
  children: React.ReactNode;
  /** Variant: primary uses accent color, secondary uses surface */
  variant?: "primary" | "secondary";
}

/**
 * Form submit button with built-in loading state via useFormStatus.
 * Use inside a <form action={...}>.
 */
export function SubmitButton({ children, variant = "primary" }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const base =
    "flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary: "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-pressed",
    secondary: "bg-card text-text-primary border border-border hover:border-border-strong",
  };

  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileTap={{ scale: pending ? 1 : 0.98 }}
      transition={spring.snappy}
      className={`${base} ${variants[variant]}`}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}
