"use client";

import { motion } from "framer-motion";
import { spring } from "@/styles/tokens";

interface PreferenceToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export function PreferenceToggle({ label, description, value, onChange }: PreferenceToggleProps) {
  return (
    <div className="bg-card border-border flex items-start justify-between gap-4 rounded-md border px-4 py-4">
      <div className="space-y-1">
        <div className="text-text-primary text-sm font-medium">{label}</div>
        {description && (
          <div className="text-text-tertiary text-xs leading-relaxed">{description}</div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${
          value ? "bg-accent" : "bg-border-strong"
        }`}
      >
        <motion.span
          layout
          transition={spring.snappy}
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ${
            value ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
